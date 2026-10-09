import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";
import { UnknownTierError } from "@/lib/pricing-tiers";
import { UnknownRobotError, UnknownRobotPriceError } from "@/lib/robot-pricing";
import { cookies } from "next/headers";
import { REF_COOKIE } from "@/lib/affiliate";
import { priceCheckout, provisionFreeCouponCheckout } from "@/lib/checkout-pricing";

const PAYGATE_WALLET_ENDPOINT = "https://api.paygate.to/control/wallet.php";
const PAYGATE_PROCESS_PAYMENT_ENDPOINT = "https://checkout.paygate.to/process-payment.php";

import { TierId } from "@/config/pricing";

type CreateSessionPayload = {
  email?: string;
  tier?: TierId;
  provider?: string;
  currency?: string;
  robotSlug?: string;
  couponCode?: string;
};

export async function POST(req: Request) {
  // Rate limiting
  const identifier = getClientIdentifier(req);
  const { success } = await checkApiRateLimit(identifier);
  
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const body = (await req.json()) as CreateSessionPayload;
    const tier = (body.tier || "1-month") as TierId;
    const email = (body.email || "").trim().toLowerCase();
    const provider = (body.provider || "").trim().toLowerCase();
    const currency = (body.currency || "USD").trim().toUpperCase();
    const robotSlug = (body.robotSlug || "").trim().toLowerCase();

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    if (!robotSlug) {
      return NextResponse.json({ error: "Missing robotSlug." }, { status: 400 });
    }

    if (tier === "free-trial") {
      return NextResponse.json({ error: "Free trial does not require Paygate checkout." }, { status: 400 });
    }

    // Fail-closed, server-authoritative price resolution — refuses unknown/inactive
    // robot, unknown tier, or an untiered/inactive price row. NEVER trust a client
    // amount; NEVER coerce to a default robot. Referral discount vs coupon
    // (never stacked) is shared with the Polar route.
    const refCode = (await cookies()).get(REF_COOKIE)?.value ?? null;
    let priced;
    try {
      priced = await priceCheckout({ email, robotSlug, tier, couponCode: body.couponCode, refCode });
    } catch (err) {
      if (
        err instanceof UnknownTierError ||
        err instanceof UnknownRobotError ||
        err instanceof UnknownRobotPriceError
      ) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
    if (!priced.ok) {
      return NextResponse.json({ error: priced.error }, { status: 400 });
    }
    const { chargeable, listPrice, discountPercent, coupon, couponWon } = priced.priced;

    const payoutAddress = process.env.PAYGATE_PAYOUT_USDC_ADDRESS;
    if (!payoutAddress) {
      return NextResponse.json(
        { error: "Server not configured: PAYGATE_PAYOUT_USDC_ADDRESS is missing." },
        { status: 500 },
      );
    }

    // Fail-closed BEFORE the Paygate wallet API call: without the secret we
    // cannot sign the callback URL, and the webhook would reject every callback.
    const webhookSecret = process.env.PAYGATE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Server not configured: PAYGATE_WEBHOOK_SECRET is missing." },
        { status: 500 },
      );
    }

    const amount = chargeable.toFixed(2);
    const orderRef = crypto.randomUUID();

    // A code that zeroes the price skips Paygate — there is nothing to charge —
    // but goes through the SAME provisioning call a paid order does.
    if (chargeable <= 0) {
      if (!coupon) {
        return NextResponse.json({ error: "This plan requires payment." }, { status: 400 });
      }
      try {
        return NextResponse.json(
          await provisionFreeCouponCheckout({ email, tier, robotSlug, currency, refCode, coupon }),
        );
      } catch (err) {
        if (
          err instanceof UnknownTierError ||
          err instanceof UnknownRobotError ||
          err instanceof UnknownRobotPriceError
        ) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }
    }
    const requestUrl = new URL(req.url);
    const callbackBase =
      process.env.PAYGATE_CALLBACK_URL_BASE ||
      process.env.NEXTAUTH_URL ||
      `${requestUrl.protocol}//${requestUrl.host}`;

    const callbackUrl = new URL("/api/webhooks/paygate", callbackBase);
    callbackUrl.searchParams.set("order_ref", orderRef);
    callbackUrl.searchParams.set("tier", tier);
    callbackUrl.searchParams.set("email", email);
    callbackUrl.searchParams.set("currency", currency);
    callbackUrl.searchParams.set("amount", amount);
    callbackUrl.searchParams.set("robot", robotSlug);
    if (refCode) callbackUrl.searchParams.set("ref", refCode);
    // Redeemed on the callback, once the money actually arrives.
    if (couponWon && coupon?.ok) callbackUrl.searchParams.set("coupon", coupon.code);

    // PHASE 6 SECURITY: robotSlug is bound into the HMAC to block robot-swap
    // replay (an unsigned slug would let an attacker swap the robot identity on
    // a captured callback while the signature still verifies). Payload order is
    // LOAD-BEARING and MUST match webhooks/paygate/route.ts byte-for-byte:
    //   `${orderRef}${email}${robotSlug}${tier}${amount}`
    const signaturePayload = `${orderRef}${email}${robotSlug}${tier}${amount}`;
    const signature = createHmac("sha256", webhookSecret)
      .update(signaturePayload)
      .digest("hex");
    callbackUrl.searchParams.set("signature", signature);

    const walletUrl = new URL(PAYGATE_WALLET_ENDPOINT);
    walletUrl.searchParams.set("address", payoutAddress);
    walletUrl.searchParams.set("callback", callbackUrl.toString());

    const walletResponse = await fetch(walletUrl.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!walletResponse.ok) {
      const errorBody = await walletResponse.text();
      return NextResponse.json(
        { error: "Failed to create Paygate wallet.", details: errorBody.slice(0, 500) },
        { status: 502 },
      );
    }

    const walletJson = (await walletResponse.json()) as {
      address_in?: string;
      callback_url?: string;
      ipn_token?: string;
      polygon_address_in?: string;
    };

    if (!walletJson.address_in) {
      return NextResponse.json(
        { error: "Paygate wallet response missing address_in." },
        { status: 502 },
      );
    }

    const paymentUrl = new URL(PAYGATE_PROCESS_PAYMENT_ENDPOINT);
    // address_in is already URL-encoded from Paygate API, so we decode it first
    // to let the URL builder encode it exactly once.
    const decodedAddress = decodeURIComponent(walletJson.address_in);
    paymentUrl.searchParams.set("address", decodedAddress);
    paymentUrl.searchParams.set("amount", amount);
    // Paygate's process-payment.php REJECTS the request outright (400 "Bad
    // request method!") if provider is omitted entirely -- it is NOT optional
    // despite the docs implying otherwise. "multi" is Paygate's own documented
    // Multi-provider mode: it keeps the customer on Paygate's own hosted
    // "Complete Your Purchase" page with a choice of Credit Card/Apple Pay/
    // Google Pay/MoonPay/Robinhood, instead of hard-locking to one 3rd-party
    // brand. Never send an empty provider value.
    paymentUrl.searchParams.set("provider", provider || "multi");
    paymentUrl.searchParams.set("email", email);
    paymentUrl.searchParams.set("currency", currency);

    return NextResponse.json({
      checkoutUrl: paymentUrl.toString(),
      orderRef,
      provider,
      currency,
      amount,
      listPrice: listPrice.toFixed(2),
      discountPercent,
      couponCode: couponWon && coupon?.ok ? coupon.code : null,
      couponLabel: couponWon && coupon?.ok ? coupon.label : null,
      ipnToken: walletJson.ipn_token || null,
      callbackUrl: walletJson.callback_url || callbackUrl.toString(),
    });
  } catch (error) {
    console.error("Paygate create-session error:", error);
    return NextResponse.json({ error: "Unable to initialize Paygate checkout." }, { status: 500 });
  }
}
