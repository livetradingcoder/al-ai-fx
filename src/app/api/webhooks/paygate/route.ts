import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { provisionSubscription } from "@/lib/subscriptions";
import { UnknownTierError } from "@/lib/pricing-tiers";
import { verifyPaygateSignature } from "@/lib/webhook-signature";
import { checkWebhookRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail, validateAmount } from "@/lib/validation";

/**
 * Paygate.to callback endpoint.
 *
 * Paygate.to invokes this GET-only (verified against their WordPress + WHMCS
 * plugin source): it appends value_coin/coin/txid_in to the merchant-registered
 * callback URL. There is no signature header, no timestamp, no nonce — so we
 * embed our own HMAC `signature` query param at create-session time and verify
 * it here, fail-closed, BEFORE any provisioning. The old POST handler was dead
 * code (no legitimate caller) and a Vercel 4.5 MB body-limit hazard — deleted.
 */
export async function GET(req: Request) {
  const identifier = getClientIdentifier(req);
  const { success: rlOk } = await checkWebhookRateLimit(identifier);
  if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  try {
    const url = new URL(req.url);
    const orderRef = url.searchParams.get("order_ref") || "";
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();
    const tier = url.searchParams.get("tier") || "";
    const currency = (url.searchParams.get("currency") || "USD").toUpperCase();
    const callbackAmount =
      url.searchParams.get("value_coin") || url.searchParams.get("amount") || "0";
    const signature = url.searchParams.get("signature");

    const signaturePayload = `${orderRef}${email}${tier}${callbackAmount}`;
    const verified = verifyPaygateSignature(signaturePayload, signature);
    if (!verified.ok) {
      console.error(
        "[paygate] webhook rejected — reason=%s orderRef=%s",
        verified.reason,
        orderRef,
      );
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (!orderRef || !email) {
      return NextResponse.json(
        { error: "Missing required callback parameters." },
        { status: 400 },
      );
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    const amount = Number.parseFloat(callbackAmount);
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return NextResponse.json({ error: amountValidation.error }, { status: 400 });
    }

    if (!tier) {
      return NextResponse.json({ error: "Missing tier parameter." }, { status: 400 });
    }

    // Replay + idempotency: signature is a natural per-delivery nonce (embeds
    // PAYGATE_WEBHOOK_SECRET). Try to record the delivery; on P2002 (unique
    // constraint violation), this is a replay — return 200 duplicated:true
    // WITHOUT calling provisionSubscription. Race-safe across concurrent
    // Paygate retries because Postgres handles the unique-index check atomically.
    try {
      await prisma.webhookDelivery.create({
        data: {
          signature: signature!,
          orderRef,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        console.log(
          "[paygate] duplicate delivery — orderRef=%s (P2002 short-circuit)",
          orderRef,
        );
        return NextResponse.json(
          { success: true, duplicated: true, source: "paygate-get-callback" },
          { status: 200 },
        );
      }
      throw err;
    }

    let result;
    try {
      result = await provisionSubscription(email, tier, orderRef, amount, currency);
    } catch (err) {
      if (err instanceof UnknownTierError) {
        console.error("[paygate] unknown tier — orderRef=%s tier=%s", orderRef, tier);
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    return NextResponse.json(
      { success: true, source: "paygate-get-callback", ...result },
      { status: 200 },
    );
  } catch (error) {
    console.error("Paygate GET callback error:", error);
    return NextResponse.json(
      { error: "Webhook payload processing failed." },
      { status: 500 },
    );
  }
}

// POST handler intentionally not exported — dead code deleted (Paygate.to sends
// GET-only per their WordPress + WHMCS plugin source).
