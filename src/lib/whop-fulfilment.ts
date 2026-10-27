import { redeemCoupon, validateCoupon } from "@/lib/coupons";
import { ACCOUNT_CHANGE_TIER, grantChangeCredit } from "@/lib/mt5-changes";
import { provisionSubscription } from "@/lib/subscriptions";
import { validateEmail } from "@/lib/validation";
import {
  fetchWhopPayment,
  isWhopPaid,
  resolveWhopPaymentTarget,
  whopOrderRef,
  whopPaymentAmount,
  type WhopPaymentTarget,
} from "@/lib/whop";

/**
 * Turns a paid Whop purchase into a licence: the order, the subscription and
 * the coupon redemption. Shared by the webhook and by the thank-you page's own
 * confirmation, so whichever hears about the payment first does the work and
 * the other is a no-op (provisionSubscription dedupes on WHOP-<order_ref>).
 */
export async function fulfilWhopPayment(
  target: WhopPaymentTarget & { email: string },
  paid: { amount: number; currency: string },
) {
  // A fee for moving a licence to another MT5 account, not a purchase of one.
  if (target.tierSlug === ACCOUNT_CHANGE_TIER) {
    return grantChangeCredit({
      email: target.email,
      subscriptionId: target.subscriptionId,
      orderRef: whopOrderRef(target.orderRef),
      amount: paid.amount,
      currency: paid.currency,
    });
  }
  const result = await provisionSubscription(
    target.email,
    target.tierSlug,
    target.robotSlug,
    whopOrderRef(target.orderRef),
    paid.amount,
    paid.currency,
    target.refCode,
  );
  if (target.couponCode && !result.duplicated) {
    const check = await validateCoupon({
      code: target.couponCode,
      robotSlug: target.robotSlug,
      tier: target.tierSlug,
      email: target.email,
    });
    if (check.ok) {
      await redeemCoupon({
        couponId: check.couponId,
        email: target.email,
        robotSlug: target.robotSlug,
        tier: target.tierSlug,
        amountBefore: check.priceBefore,
        amountAfter: paid.amount,
        userId: result.userId,
        orderId: result.orderId ?? null,
      });
    }
  }
  return result;
}

// One check per order every few seconds, however fast the page polls.
const lastChecked = new Map<string, number>();
const CHECK_EVERY_MS = 8000;

/**
 * The buyer came back from Whop's checkout with `payment=pay_…`. Ask Whop
 * whether that payment is paid and is this order's, and if so fulfil it now.
 * True only when an order has been written. The payment id is the buyer's
 * claim, so nothing is trusted from the URL: the payment is read from Whop
 * with our key, and must carry the order_ref we put in its metadata.
 */
export async function confirmWhopReturn(orderRef: string, paymentId: string): Promise<boolean> {
  const now = Date.now();
  if (now - (lastChecked.get(orderRef) ?? 0) < CHECK_EVERY_MS) return false;
  lastChecked.set(orderRef, now);
  if (lastChecked.size > 500) lastChecked.clear();

  try {
    const payment = await fetchWhopPayment(paymentId);
    const target = resolveWhopPaymentTarget(payment);
    if (!target || whopOrderRef(target.orderRef) !== orderRef) return false;
    if (!isWhopPaid(payment) || !target.email || !validateEmail(target.email).valid) return false;
    const paid = whopPaymentAmount(payment);
    if (!paid) return false;
    await fulfilWhopPayment({ ...target, email: target.email }, paid);
    return true;
  } catch (err) {
    console.error("[Whop] return confirmation failed:", err);
    return false;
  }
}
