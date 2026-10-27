import { NextResponse } from "next/server";
import { UnknownTierError } from "@/lib/pricing-tiers";
import { checkWebhookRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { UnknownRobotError, UnknownRobotPriceError } from "@/lib/robot-pricing";
import { fulfilWhopPayment } from "@/lib/whop-fulfilment";
import { validateAmount, validateEmail } from "@/lib/validation";
import {
  isWhopMembershipLive,
  isWhopPaid,
  resolveWhopPaymentTarget,
  verifyWhopWebhook,
  whopPaymentAmount,
  whopWebhookSecret,
  type WhopEvent,
  type WhopPaymentTarget,
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
 * `payment.succeeded` and `membership.activated` provision (subscribe the
 * endpoint to both). The licence parameters come from the metadata we set when
 * creating the checkout (so they can't be altered by the buyer); the amount
 * recorded is what was actually paid, which is 0 when a Whop promo code covered
 * it. Redeliveries and the two events for one purchase are harmless:
 * provisionSubscription dedupes on Order.paygateId = WHOP-<order_ref>. Must stay
 * public — /api/webhooks/* is CSRF-exempt in proxy.ts.
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
  const data = event.data;
  if (!data || (event.type !== "payment.succeeded" && event.type !== "membership.activated")) {
    return NextResponse.json({ received: true, ignored: event.type ?? "unknown" });
  }

  const target = resolveWhopPaymentTarget(data);
  if (!target) {
    console.log("[Whop] %s %s is not an al-ai-fx checkout — ignored", event.type, data.id);
    return NextResponse.json({ received: true, ignored: "not-ours" });
  }

  let paid: { amount: number; currency: string };
  if (event.type === "payment.succeeded") {
    if (!isWhopPaid(data)) {
      console.warn("[Whop] payment %s status=%s/%s — not fulfilled", data.id, data.status, data.substatus);
      return NextResponse.json({ received: true, ignored: "not-paid" });
    }
    const amount = whopPaymentAmount(data);
    if (!amount) {
      console.error("[Whop] payment %s has no usable total", data.id);
      return NextResponse.json({ error: "Missing payment amount" }, { status: 400 });
    }
    paid = amount;
  } else {
    // membership.activated: covers a purchase with no paid payment behind it (a
    // 100%-off promo code), and a paid one whose payment event has not arrived
    // yet. Either way the order is deduped on WHOP-<order_ref>, so whichever
    // event lands first provisions and the other is a no-op. The membership
    // carries no amount, so use the price we asked Whop to charge.
    if (!isWhopMembershipLive(data)) {
      return NextResponse.json({ received: true, ignored: "membership-not-live" });
    }
    paid = { amount: target.expectedAmount ?? 0, currency: "USD" };
  }

  return provision(event.type, data.id, target, paid);
}

async function provision(
  eventType: string,
  sourceId: string | undefined,
  target: WhopPaymentTarget,
  paid: { amount: number; currency: string },
) {
  const emailValidation = validateEmail(target.email ?? "");
  if (!emailValidation.valid || !target.email) {
    console.error("[Whop] %s %s has no valid email", eventType, sourceId);
    return NextResponse.json({ error: emailValidation.error ?? "Missing email" }, { status: 400 });
  }
  if (paid.amount > 0) {
    const amountValidation = validateAmount(paid.amount);
    if (!amountValidation.valid) {
      return NextResponse.json({ error: amountValidation.error }, { status: 400 });
    }
  }

  try {
    const result = await fulfilWhopPayment({ ...target, email: target.email }, paid);
    console.log(
      "[Whop] %s %s → %s/%s user=%s duplicated=%s",
      eventType,
      sourceId,
      target.robotSlug,
      target.tierSlug,
      result.userId,
      result.duplicated,
    );
    return NextResponse.json({ received: true, source: "whop-webhook", ...result });
  } catch (err) {
    if (
      err instanceof UnknownTierError ||
      err instanceof UnknownRobotError ||
      err instanceof UnknownRobotPriceError
    ) {
      console.error("[Whop] %s %s refused: %s", eventType, sourceId, err.message);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[Whop] %s %s provisioning failed:", eventType, sourceId, err);
    return NextResponse.json({ error: "Webhook payload processing failed." }, { status: 500 });
  }
}
