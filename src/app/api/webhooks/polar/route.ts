import { NextResponse } from "next/server";
import { webhooks } from "@polar-sh/sdk/2026-10";
import { provisionSubscription, UnknownTierError } from "@/lib/subscriptions";
import { redeemCoupon, validateCoupon } from "@/lib/coupons";
import { UnknownRobotError, UnknownRobotPriceError } from "@/lib/robot-pricing";
import {
  polarOrderAmount,
  polarOrderRef,
  resolvePolarOrderTarget,
  type PolarOrder,
} from "@/lib/polar";

/**
 * Polar webhook endpoint. The signature is verified against
 * POLAR_WEBHOOK_SECRET before anything is handled. Must stay public — Polar
 * doesn't follow redirects; /api/webhooks/* is already CSRF-exempt in proxy.ts.
 */
export async function POST(req: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await req.text(); // raw body — signature fails on re-serialized JSON
  let event: Awaited<ReturnType<typeof webhooks.validateEvent>>;
  try {
    event = await webhooks.validateEvent(
      body,
      {
        "webhook-id": req.headers.get("webhook-id") ?? "",
        "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
        "webhook-signature": req.headers.get("webhook-signature") ?? "",
      },
      secret,
    );
  } catch (error) {
    if (error instanceof webhooks.PolarWebhookVerificationError) {
      return NextResponse.json({ received: false }, { status: 403 });
    }
    if (error instanceof webhooks.PolarWebhookError) {
      return NextResponse.json({ received: false }, { status: 400 });
    }
    throw error;
  }

  switch (event.type) {
    case "order.paid":
      return handleOrderPaid(event.data);
    case "customer.state_changed":
      // Nothing to sync: access is the Subscription row created on order.paid,
      // and its expiry is enforced inside the compiled EA, not from Polar.
      break;
  }

  return NextResponse.json({ received: true });
}

/**
 * Provision the (robot, tier) an order bought. Idempotent: the order ref ends
 * up in Order.paygateId and provisionSubscription short-circuits on a repeat,
 * so Polar's redeliveries are harmless. A non-2xx makes Polar retry and shows
 * the delivery as failed in its dashboard, which is what we want for an order
 * we can't fulfil (no email, no robot/tier mapping, unknown price).
 */
async function handleOrderPaid(order: PolarOrder) {
  // Only one-off purchases map to a robot tier. Nothing here is recurring, so
  // a subscription cycle would be a configuration mistake; acknowledge it
  // without provisioning rather than inventing a tier.
  if (!order.paid || order.billing_reason !== "purchase") {
    console.warn("[Polar] order %s ignored: paid=%s reason=%s", order.id, order.paid, order.billing_reason);
    return NextResponse.json({ received: true, ignored: true });
  }

  const email = order.customer.email?.trim().toLowerCase();
  if (!email) {
    console.error("[Polar] order %s has no customer email", order.id);
    return NextResponse.json({ error: "Order has no customer email" }, { status: 400 });
  }

  const target = resolvePolarOrderTarget(order);
  if (!target) {
    console.error(
      "[Polar] order %s (product %s) has no robot/tier metadata — set robot=<slug> tier=<tier> on the product",
      order.id,
      order.product_id,
    );
    return NextResponse.json({ error: "Order is not mapped to a robot and tier" }, { status: 400 });
  }

  const { amount, currency } = polarOrderAmount(order);
  try {
    const result = await provisionSubscription(
      email,
      target.tierSlug,
      target.robotSlug,
      polarOrderRef(order),
      amount,
      currency,
      target.refCode,
    );
    // The coupon that set the checkout price is consumed only now that the
    // money has landed, the same as the Paygate callback does.
    if (target.couponCode && !result.duplicated) {
      const check = await validateCoupon({
        code: target.couponCode,
        robotSlug: target.robotSlug,
        tier: target.tierSlug,
        email,
      });
      if (check.ok) {
        await redeemCoupon({
          couponId: check.couponId,
          email,
          robotSlug: target.robotSlug,
          tier: target.tierSlug,
          amountBefore: check.priceBefore,
          amountAfter: amount,
          userId: result.userId,
          orderId: result.orderId ?? null,
        });
      }
    }
    console.log(
      "[Polar] order %s → %s/%s user=%s duplicated=%s",
      order.id,
      target.robotSlug,
      target.tierSlug,
      result.userId,
      result.duplicated,
    );
    return NextResponse.json({ received: true, source: "polar-order-paid", ...result });
  } catch (err) {
    if (
      err instanceof UnknownTierError ||
      err instanceof UnknownRobotError ||
      err instanceof UnknownRobotPriceError
    ) {
      console.error("[Polar] order %s refused: %s", order.id, err.message);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[Polar] order %s provisioning failed:", order.id, err);
    return NextResponse.json({ error: "Order processing failed" }, { status: 500 });
  }
}
