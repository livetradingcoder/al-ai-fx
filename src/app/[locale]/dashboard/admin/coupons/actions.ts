"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCode } from "@/lib/coupons";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") throw new Error("Admins only");
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
}) {
  await requireAdmin();

  const code = normalizeCode(input.code);
  if (code.length < 4) throw new Error("Use at least 4 characters");
  if (!/^[A-Z0-9-]+$/.test(code)) throw new Error("Letters, numbers and dashes only");

  if (input.kind === "PERCENT" && (input.value <= 0 || input.value > 100)) {
    throw new Error("A percentage must be between 1 and 100");
  }
  if (input.kind === "FIXED" && input.value <= 0) {
    throw new Error("A fixed discount must be more than 0");
  }

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) throw new Error(`${code} already exists`);

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
  return { code };
}

export async function setCouponActive(couponId: string, active: boolean) {
  await requireAdmin();
  await prisma.coupon.update({ where: { id: couponId }, data: { active } });
  refresh();
}

/** Deleting takes its redemption history with it, so it is only offered for
 *  codes nobody has used. Everything else gets switched off instead. */
export async function deleteCoupon(couponId: string) {
  await requireAdmin();
  const used = await prisma.couponRedemption.count({ where: { couponId } });
  if (used > 0) throw new Error("That code has been used — switch it off instead");
  await prisma.coupon.delete({ where: { id: couponId } });
  refresh();
}
