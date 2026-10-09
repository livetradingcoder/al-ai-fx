import { NextResponse } from "next/server";
import { redeemCoupon, validateCoupon } from "@/lib/coupons";
import {
  isOxapayPaid,
  oxapayKey,
  oxapayOrderRef,
  verifyCallbackParams,
  verifyOxapayBody,
  type OxapayCallback,
} from "@/lib/oxapay";
import { UnknownTierError } from "@/lib/pricing-tiers";
import { checkWebhookRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { UnknownRobotError, UnknownRobotPriceError } from "@/lib/robot-pricing";
import { provisionSubscription } from "@/lib/subscriptions";
import { validateAmount, validateEmail } from "@/lib/validation";

// OxaPay expects a 200 with body "ok"; anything else is retried (5 attempts).
const ok = (extra?: Record<string, unknown>) =>
  extra ? NextResponse.json({ ok: true, ...extra }) : new NextResponse("ok", { status: 200 });

/**
 * OxaPay callback endpoint (https://docs.oxapay.com/webhook).
 *
 * Two signatures are checked before anything happens:
 *  1. OxaPay's: header `HMAC` = HMAC-SHA512 of the raw body with the merchant
 *     key. Proves the payment event is theirs.
 *  2. Ours: `signature` over the order_ref/email/robot/tier/amount query
 *     params set at invoice time. Proves nobody replayed a genuine body
 *     against different licence parameters. order_id in the body must equal
 *     order_ref in the query.
 * Only status "Paid" provisions; "Paying" (confirming) and the rest are
 * acknowledged so OxaPay stops retrying them. Redeliveries of "Paid" are
 * harmless: provisionSubscription dedupes on Order.paygateId = OXAPAY-<ref>.
 * Must stay public — /api/webhooks/* is CSRF-exempt in proxy.ts.
 */
export async function POST(req: Request) {
  const { success: rlOk } = await checkWebhookRateLimit(getClientIdentifier(req));
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const key = oxapayKey();
  if (!key) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await req.text(); // raw — the HMAC is over the exact bytes
  if (!verifyOxapayBody(key, rawBody, req.headers.get("hmac"))) {
    console.error("[OxaPay] callback rejected: bad HMAC");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let body: OxapayCallback;
  try {
    body = JSON.parse(rawBody) as OxapayCallback;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.type !== "invoice") {
    // Payout callbacks share the merchant account but not this flow.
    return ok();
  }

  const url = new URL(req.url);
  const q = (name: string) => (url.searchParams.get(name) || "").trim();
  const params = {
    order_ref: q("order_ref"),
    email: q("email").toLowerCase(),
    robot: q("robot").toLowerCase(),
    tier: q("tier").toLowerCase(),
    amount: q("amount"),
  };
  if (!verifyCallbackParams(key, params, url.searchParams.get("signature"))) {
    console.error("[OxaPay] callback rejected: bad param signature (track %s)", body.track_id);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  if (!params.order_ref || body.order_id !== params.order_ref) {
    console.error("[OxaPay] callback rejected: order_id %s ≠ order_ref %s", body.order_id, params.order_ref);
    return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
  }

  if (!isOxapayPaid(body.status)) {
    console.log("[OxaPay] track %s order %s status=%s — waiting", body.track_id, body.order_id, body.status);
    return ok();
  }

  const emailValidation = validateEmail(params.email);
  if (!emailValidation.valid) {
    return NextResponse.json({ error: emailValidation.error }, { status: 400 });
  }
  if (!params.robot || !params.tier) {
    return NextResponse.json({ error: "Missing robot or tier." }, { status: 400 });
  }
  // What the buyer paid, in USD; fall back to what we invoiced.
  const paid = typeof body.amount === "number" ? body.amount : Number.parseFloat(String(body.amount ?? params.amount));
  const amountValidation = validateAmount(paid);
  if (!amountValidation.valid) {
    return NextResponse.json({ error: amountValidation.error }, { status: 400 });
  }

  try {
    const result = await provisionSubscription(
      params.email,
      params.tier,
      params.robot,
      oxapayOrderRef(params.order_ref),
      paid,
      "USD",
      url.searchParams.get("ref"),
    );
    const couponCode = url.searchParams.get("coupon");
    if (couponCode && !result.duplicated) {
      const check = await validateCoupon({
        code: couponCode,
        robotSlug: params.robot,
        tier: params.tier,
        email: params.email,
      });
      if (check.ok) {
        await redeemCoupon({
          couponId: check.couponId,
          email: params.email,
          robotSlug: params.robot,
          tier: params.tier,
          amountBefore: check.priceBefore,
          amountAfter: paid,
          userId: result.userId,
          orderId: result.orderId ?? null,
        });
      }
    }
    console.log(
      "[OxaPay] track %s → %s/%s user=%s duplicated=%s",
      body.track_id,
      params.robot,
      params.tier,
      result.userId,
      result.duplicated,
    );
    return ok({ source: "oxapay-callback", ...result });
  } catch (err) {
    if (
      err instanceof UnknownTierError ||
      err instanceof UnknownRobotError ||
      err instanceof UnknownRobotPriceError
    ) {
      console.error("[OxaPay] track %s refused: %s", body.track_id, err.message);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[OxaPay] track %s provisioning failed:", body.track_id, err);
    return NextResponse.json({ error: "Webhook payload processing failed." }, { status: 500 });
  }
}
