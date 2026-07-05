import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";
import { TIER_METADATA } from "@/lib/pricing-tiers";

const PAYGATE_WALLET_ENDPOINT = "https://api.paygate.to/control/wallet.php";
const PAYGATE_PROCESS_PAYMENT_ENDPOINT = "https://checkout.paygate.to/process-payment.php";

import { TierId, PRICING_TIERS } from "@/config/pricing";

type CreateSessionPayload = {
  email?: string;
  tier?: TierId;
  provider?: string;
  currency?: string;
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

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    // TIER_METADATA (Plan 02-01 SSoT) is the canonical tier-validity mapping.
    if (!(tier in TIER_METADATA)) {
      return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
    }

    if (tier === "free-trial") {
      return NextResponse.json({ error: "Free trial does not require Paygate checkout." }, { status: 400 });
    }

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

    const amount = PRICING_TIERS[tier].amount.toFixed(2);
    const orderRef = crypto.randomUUID();
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

    // Sign the callback so the fail-closed webhook accepts it. Payload order
    // MUST match the webhook GET's reconstruction exactly:
    // `${orderRef}${email}${tier}${callbackAmount}`. Paygate omits value_coin
    // for USD callbacks, so the webhook falls back to our `amount` param here.
    const signaturePayload = `${orderRef}${email}${tier}${amount}`;
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
    if (provider) {
      paymentUrl.searchParams.set("provider", provider);
    }
    paymentUrl.searchParams.set("email", email);
    paymentUrl.searchParams.set("currency", currency);

    return NextResponse.json({
      checkoutUrl: paymentUrl.toString(),
      orderRef,
      provider,
      currency,
      amount,
      ipnToken: walletJson.ipn_token || null,
      callbackUrl: walletJson.callback_url || callbackUrl.toString(),
    });
  } catch (error) {
    console.error("Paygate create-session error:", error);
    return NextResponse.json({ error: "Unable to initialize Paygate checkout." }, { status: 500 });
  }
}
