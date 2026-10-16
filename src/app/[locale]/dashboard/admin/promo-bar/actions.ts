"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import type { ActionResult } from "@/lib/action-result";
import { authOptions } from "@/lib/auth";
import { normalizeCode } from "@/lib/coupons";
import { prisma } from "@/lib/prisma";
import { couponLabel, couponShowable, safeSitePath, suggestedBannerMessage } from "@/lib/promo-banner";

async function requireAdmin(): Promise<ActionResult | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN" ? null : { ok: false, error: "Admins only" };
}

function refresh() {
  revalidatePath("/dashboard/admin/promo-bar");
}

export async function createBanner(input: {
  message: string;
  couponCode: string;
  ctaLabel: string;
  ctaPath: string;
  endsAt: string;
}): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const message = input.message.trim();
  if (message.length < 3 || message.length > 90) return { ok: false, error: "The message needs 3–90 characters" };

  const ctaLabel = input.ctaLabel.trim().slice(0, 24) || null;

  let ctaHref: string | null = null;
  if (input.ctaPath.trim()) {
    ctaHref = safeSitePath(input.ctaPath, "");
    if (!ctaHref) return { ok: false, error: "The link must be a page on this site, starting with / (for example /catalog)" };
  }

  let endsAt: Date | null = null;
  if (input.endsAt) {
    endsAt = new Date(input.endsAt);
    if (Number.isNaN(endsAt.getTime())) return { ok: false, error: "Check the end date" };
    if (endsAt.getTime() <= Date.now()) return { ok: false, error: "The end date must be in the future" };
  }

  let couponCode: string | null = null;
  if (input.couponCode.trim()) {
    couponCode = normalizeCode(input.couponCode);
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
    if (!coupon) return { ok: false, error: `No coupon called ${couponCode}. Create it under Coupons first` };
    if (!couponShowable(coupon)) {
      return {
        ok: false,
        error: "That code cannot be shown publicly: free codes, codes tied to one person, and codes that are off, expired or used up are not allowed",
      };
    }
  }

  await prisma.promoBanner.create({ data: { message, couponCode, ctaLabel, ctaHref, endsAt } });
  refresh();
  return { ok: true, message: "Added. It shows in the top bar straight away." };
}

/** One click: put an existing public coupon in the bar with a sensible message. */
export async function addCouponToBar(input: { code: string }): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const code = normalizeCode(input.code);
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return { ok: false, error: `No coupon called ${code}` };
  if (!couponShowable(coupon)) {
    return { ok: false, error: "That code cannot be shown publicly (free, tied to one person, off, expired or used up)" };
  }

  const already = await prisma.promoBanner.findFirst({
    where: { couponCode: code, active: true, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
    select: { id: true },
  });
  if (already) return { ok: false, error: `${code} is already in the bar` };

  await prisma.promoBanner.create({
    data: { message: suggestedBannerMessage(couponLabel(coupon.kind, coupon.value)), couponCode: code },
  });
  refresh();
  return { ok: true, message: `${code} is now in the top bar and the leaving pop-up.` };
}

export async function setBannerActive(input: { id: string; active: boolean }): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const row = await prisma.promoBanner.findUnique({ where: { id: input.id }, select: { id: true } });
  if (!row) return { ok: false, error: "That message no longer exists" };
  await prisma.promoBanner.update({ where: { id: input.id }, data: { active: input.active } });
  refresh();
  return { ok: true, message: input.active ? "Showing in the top bar." : "Hidden from the top bar." };
}

export async function deleteBanner(input: { id: string }): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  await prisma.promoBanner.deleteMany({ where: { id: input.id } });
  refresh();
  return { ok: true, message: "Deleted." };
}
