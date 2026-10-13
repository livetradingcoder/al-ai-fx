import { NextResponse } from "next/server";
import { redeemCoupon, validateCoupon } from "@/lib/coupons";
import { UnknownTierError } from "@/lib/pricing-tiers";
import { checkWebhookRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { UnknownRobotError, UnknownRobotPriceError } from "@/lib/robot-pricing";
import { provisionSubscription } from "@/lib/subscriptions";
import { validateAmount, validateEmail } from "@/lib/validation";
import {
  isWhopPaid,
  resolveWhopPaymentTarget,
  verifyWhopWebhook,
  whopOrderRef,
  whopPaymentAmount,
  whopWebhookSecret,
  type WhopEvent,
} from "@/lib/whop";

/**
 * Whop webhook endpoint (https://docs.whop.com/developer/guides/webhooks).
 *
 * The signature (HMAC-SHA256 over id.timestamp.rawBody, `ws_…` secret) is checked
 * before anything is read. Whop delivers at least once and retries non-2xx for
 * ~71 hours, then disables the endpoint — so this answers 2xx for everything it
 * deliberately ignores. In particular the Whop company is shared with other apps,
 * and this endpoint also receives their payments: those carry no `source`
 * metadata of ours and are acknowledged without action.
 *
 * Only `payment.succeeded` provisions. The licence parameters come from the
 * metadata we set when creating the checkout (so they can't be altered by the
 * buyer); the amount recorded is what was actually paid, which is 0 when a Whop
 * promo code covered it. Redeliveries are harmless: provisionSubscription dedupes
 * on Order.paygateId = WHOP-<order_ref>. Must stay public — /api/webhooks/* is
 * CSRF-exempt in proxy.ts.
 */
export async function POST(req: Request) {
  const { success: rlOk } = await checkWebhookRateLimit(getClientIdentifier(req));
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const secret = whopWebhookSecret();
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await req.text(); // raw — the signature is over the exact bytes
  const verified = verifyWhopWebhook(secret, rawBody, {
    id: req.headers.get("webhook-id"),
    timestamp: req.headers.get("webhook-timestamp"),
    signature: req.headers.get("webhook-signature"),
  });
  if (!verified) {
    console.error("[Whop] callback rejected: bad signature or timestamp");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let event: WhopEvent;
  try {
    event = JSON.parse(rawBody) as WhopEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (event.type !== "payment.succeeded" || !event.data) {
    return NextResponse.json({ received: true, ignored: event.type ?? "unknown" });
  }

  const payment = event.data;
  const target = resolveWhopPaymentTarget(payment);
  if (!target) {
    console.log("[Whop] payment %s is not an al-ai-fx checkout — ignored", payment.id);
    return NextResponse.json({ received: true, ignored: "not-ours" });
  }
  if (!isWhopPaid(payment)) {
    console.warn("[Whop] payment %s status=%s/%s — not fulfilled", payment.id, payment.status, payment.substatus);
    return NextResponse.json({ received: true, ignored: "not-paid" });
  }

  const paid = whopPaymentAmount(payment);
  if (!paid) {
    console.error("[Whop] payment %s has no usable total", payment.id);
    return NextResponse.json({ error: "Missing payment amount" }, { status: 400 });
  }
  const emailValidation = validateEmail(target.email ?? "");
  if (!emailValidation.valid || !target.email) {
    console.error("[Whop] payment %s has no valid email", payment.id);
    return NextResponse.json({ error: emailValidation.error ?? "Missing email" }, { status: 400 });
  }
  if (paid.amount > 0) {
    const amountValidation = validateAmount(paid.amount);
    if (!amountValidation.valid) {
      return NextResponse.json({ error: amountValidation.error }, { status: 400 });
    }
  }

  try {
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
    console.log(
      "[Whop] payment %s → %s/%s user=%s duplicated=%s",
      payment.id,
      target.robotSlug,
      target.tierSlug,
      result.userId,
      result.duplicated,
    );
    return NextResponse.json({ received: true, source: "whop-payment-succeeded", ...result });
  } catch (err) {
    if (
      err instanceof UnknownTierError ||
      err instanceof UnknownRobotError ||
      err instanceof UnknownRobotPriceError
    ) {
      console.error("[Whop] payment %s refused: %s", payment.id, err.message);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[Whop] payment %s provisioning failed:", payment.id, err);
    return NextResponse.json({ error: "Webhook payload processing failed." }, { status: 500 });
  }
}
