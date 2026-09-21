"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCode } from "@/lib/coupons";
import type { ActionResult } from "@/lib/action-result";

/** Null for an admin, otherwise the failure to hand straight back. */
async function requireAdmin(): Promise<ActionResult | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN" ? null : { ok: false, error: "Admins only" };
}

function refresh() {
  revalidatePath("/dashboard/admin/coupons");
}

export async function createCoupon(input: {
  code: string;
  kind: "PERCENT" | "FIXED" | "FREE";
  value: number;
  robotId: string | null;
  tier: string | null;
  maxRedemptions: number | null;
  oncePerEmail: boolean;
  expiresAt: string | null;
  note: string | null;
}): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const code = normalizeCode(input.code);
  if (code.length < 4) return { ok: false, error: "Use at least 4 characters" };
  if (!/^[A-Z0-9-]+$/.test(code)) return { ok: false, error: "Letters, numbers and dashes only" };

  if (input.kind === "PERCENT" && (input.value <= 0 || input.value > 100)) {
    return { ok: false, error: "A percentage must be between 1 and 100" };
  }
  if (input.kind === "FIXED" && input.value <= 0) {
    return { ok: false, error: "A fixed discount must be more than 0" };
  }

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) return { ok: false, error: `${code} already exists` };

  await prisma.coupon.create({
    data: {
      code,
      kind: input.kind,
      value: input.kind === "FREE" ? 100 : input.value,
      robotId: input.robotId || null,
      // The column is the PricingTier enum; an empty picker means "any plan".
      tier: (input.tier || null) as never,
      maxRedemptions: input.maxRedemptions && input.maxRedemptions > 0 ? input.maxRedemptions : null,
      oncePerEmail: input.oncePerEmail,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      note: input.note?.trim() || null,
    },
  });
  refresh();
  return { ok: true, message: `${code} created.` };
}

export async function setCouponActive(couponId: string, active: boolean): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const coupon = await prisma.coupon.update({ where: { id: couponId }, data: { active } });
  refresh();
  return { ok: true, message: active ? `${coupon.code} is live.` : `${coupon.code} switched off.` };
}

/** Deleting takes its redemption history with it, so it is only offered for
 *  codes nobody has used. Everything else gets switched off instead. */
export async function deleteCoupon(couponId: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const used = await prisma.couponRedemption.count({ where: { couponId } });
  if (used > 0) return { ok: false, error: "That code has been used — switch it off instead" };
  const coupon = await prisma.coupon.delete({ where: { id: couponId } });
  refresh();
  return { ok: true, message: `${coupon.code} deleted.` };
}
