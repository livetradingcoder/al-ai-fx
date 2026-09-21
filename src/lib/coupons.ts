import { prisma } from "@/lib/prisma";
import { resolveRobotPrice } from "@/lib/robot-pricing";

export type CouponCheck =
  | { ok: false; reason: string }
  | {
      ok: true;
      couponId: string;
      code: string;
      kind: "PERCENT" | "FIXED" | "FREE";
      priceBefore: number;
      priceAfter: number;
      free: boolean;
      label: string;
    };

export function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().slice(0, 40);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Never returns a negative price, and FREE always lands exactly on zero. */
function discounted(amount: number, kind: string, value: number) {
  if (kind === "FREE") return 0;
  if (kind === "PERCENT") return round2(Math.max(0, amount * (1 - value / 100)));
  return round2(Math.max(0, amount - value));
}

/**
 * Resolve a coupon against a specific robot + tier, server-side.
 *
 * The price it discounts is the catalog price from the database, never a
 * number supplied by the client — the same rule the rest of checkout follows.
 * Every rejection says why, because the person typing the code is usually the
 * person who created it.
 */
export async function validateCoupon(input: {
  code: string;
  robotSlug: string;
  tier: string;
  email?: string | null;
}): Promise<CouponCheck> {
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, reason: "Enter a coupon code." };

  const coupon = await prisma.coupon.findUnique({
    where: { code },
    include: { robot: { select: { slug: true, name: true } } },
  });
  if (!coupon || !coupon.active) return { ok: false, reason: "That code is not valid." };

  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "That code has expired." };
  }
  if (coupon.maxRedemptions != null && coupon.redeemedCount >= coupon.maxRedemptions) {
    return { ok: false, reason: "That code has been used up." };
  }
  if (coupon.robot && coupon.robot.slug !== input.robotSlug) {
    return { ok: false, reason: `That code only works on ${coupon.robot.name}.` };
  }

  // Price resolution is fail-closed: an unknown robot/tier throws rather than
  // defaulting, so a bad pair can never be discounted into existence.
  let priceBefore: number;
  let tierEnum: string;
  try {
    const resolved = await resolveRobotPrice(input.robotSlug, input.tier);
    priceBefore = resolved.amount;
    tierEnum = resolved.tier;
  } catch {
    return { ok: false, reason: "That plan is not available." };
  }

  if (coupon.tier && coupon.tier !== tierEnum) {
    return { ok: false, reason: "That code does not apply to this plan." };
  }
  if (priceBefore <= 0) {
    return { ok: false, reason: "This plan is already free." };
  }

  if (coupon.oncePerEmail && input.email) {
    const used = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, email: input.email.trim().toLowerCase() },
    });
    if (used > 0) return { ok: false, reason: "You have already used that code." };
  }

  const priceAfter = discounted(priceBefore, coupon.kind, coupon.value);
  const label =
    coupon.kind === "FREE"
      ? "Free"
      : coupon.kind === "PERCENT"
        ? `${coupon.value}% off`
        : `$${coupon.value} off`;

  return {
    ok: true,
    couponId: coupon.id,
    code: coupon.code,
    kind: coupon.kind,
    priceBefore,
    priceAfter,
    free: priceAfter <= 0,
    label,
  };
}

/**
 * Record a use and consume one redemption.
 *
 * The increment is guarded in SQL (`redeemedCount < maxRedemptions`) so two
 * simultaneous checkouts cannot both take the last seat on a limited code.
 * Returns false when the seat was already gone.
 */
export async function redeemCoupon(input: {
  couponId: string;
  email: string;
  robotSlug: string;
  tier: string;
  amountBefore: number;
  amountAfter: number;
  userId?: string | null;
  orderId?: string | null;
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.findUnique({ where: { id: input.couponId } });
      if (!coupon) return false;

      if (coupon.maxRedemptions != null) {
        const claimed = await tx.coupon.updateMany({
          where: { id: coupon.id, redeemedCount: { lt: coupon.maxRedemptions } },
          data: { redeemedCount: { increment: 1 } },
        });
        if (claimed.count === 0) return false;
      } else {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { redeemedCount: { increment: 1 } },
        });
      }

      await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          email: input.email.trim().toLowerCase(),
          userId: input.userId ?? null,
          orderId: input.orderId ?? null,
          robotSlug: input.robotSlug,
          tier: input.tier,
          amountBefore: input.amountBefore,
          amountAfter: input.amountAfter,
        },
      });
      return true;
    });
  } catch (err) {
    // A failed audit write must not strand a paid order.
    console.error("[coupon] redeem failed:", err instanceof Error ? err.message : err);
    return false;
  }
}
