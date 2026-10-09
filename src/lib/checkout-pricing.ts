import { referredDiscountForCheckout } from "@/lib/affiliate";
import { redeemCoupon, validateCoupon, type CouponCheck } from "@/lib/coupons";
import { resolveRobotPrice } from "@/lib/robot-pricing";
import { provisionSubscription } from "@/lib/subscriptions";

// Pricing shared by every paid checkout path (Paygate, Polar). The amount is
// ALWAYS resolved server-side; a client-supplied price is never trusted.

export type ValidCoupon = Extract<CouponCheck, { ok: true }>;

export interface PricedCheckout {
  listPrice: number;
  chargeable: number;
  discountPercent: number;
  coupon: ValidCoupon | null;
  couponWon: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve what a buyer pays for (robot, tier). Throws UnknownTierError /
 * UnknownRobotError / UnknownRobotPriceError from resolveRobotPrice; callers
 * translate those to 400. An invalid coupon code is returned, not thrown.
 *
 * Two possible discounts, and they do NOT stack: whichever is cheaper for the
 * customer wins. Stacking a 35% affiliate rate on top of a 15% referral
 * discount on top of a coupon is how a sale ends up costing money.
 */
export async function priceCheckout(input: {
  email: string;
  robotSlug: string;
  tier: string;
  couponCode?: string | null;
  refCode: string | null;
}): Promise<{ ok: true; priced: PricedCheckout } | { ok: false; error: string }> {
  const resolved = await resolveRobotPrice(input.robotSlug, input.tier);

  const discountPercent = await referredDiscountForCheckout({ email: input.email, code: input.refCode });
  const referralPrice =
    discountPercent > 0 ? round2((resolved.amount * (100 - discountPercent)) / 100) : resolved.amount;

  const couponCode = (input.couponCode ?? "").trim();
  let coupon: ValidCoupon | null = null;
  let couponPrice = resolved.amount;
  if (couponCode) {
    const check = await validateCoupon({
      code: couponCode,
      robotSlug: input.robotSlug,
      tier: input.tier,
      email: input.email,
    });
    if (!check.ok) return { ok: false, error: check.reason };
    coupon = check;
    couponPrice = check.priceAfter;
  }

  const chargeable = Math.min(referralPrice, couponPrice);
  return {
    ok: true,
    priced: {
      listPrice: resolved.amount,
      chargeable,
      discountPercent,
      coupon,
      couponWon: coupon !== null && couponPrice <= referralPrice,
    },
  };
}

/**
 * A code that zeroes the price skips the payment provider — there is nothing
 * to charge — but goes through the SAME provisioning call a paid order does,
 * so the licence, email, MT5 lock, compile and download all behave
 * identically. That is the point: a test buyer exercises the real funnel,
 * not a stub. Throws the same Unknown*Errors as provisionSubscription.
 */
export async function provisionFreeCouponCheckout(input: {
  email: string;
  tier: string;
  robotSlug: string;
  currency: string;
  refCode: string | null;
  coupon: ValidCoupon;
}) {
  const orderRef = crypto.randomUUID();
  const result = await provisionSubscription(
    input.email,
    input.tier,
    input.robotSlug,
    `COUPON-${input.coupon.code}-${orderRef}`,
    0,
    input.currency,
    input.refCode,
  );
  await redeemCoupon({
    couponId: input.coupon.couponId,
    email: input.email,
    robotSlug: input.robotSlug,
    tier: input.tier,
    amountBefore: input.coupon.priceBefore,
    amountAfter: 0,
    userId: result.userId,
    orderId: result.orderId ?? null,
  });
  console.warn(`[coupon] FREE checkout ${input.coupon.code} -> ${input.email} (${input.robotSlug}/${input.tier})`);
  return {
    freeCheckout: true as const,
    orderRef,
    amount: "0.00",
    currency: input.currency,
    couponCode: input.coupon.code,
  };
}
