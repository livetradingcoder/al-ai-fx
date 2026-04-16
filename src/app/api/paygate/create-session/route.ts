import { NextResponse } from "next/server";

const PAYGATE_WALLET_ENDPOINT = "https://api.paygate.to/control/wallet.php";
const PAYGATE_PROCESS_PAYMENT_ENDPOINT = "https://checkout.paygate.to/process-payment.php";

type TierId = "free-trial" | "1-month" | "6-months" | "lifetime";

const TIER_AMOUNTS: Record<TierId, number> = {
  "free-trial": 0,
  "1-month": 149,
  "6-months": 499,
  lifetime: 999,
};

type CreateSessionPayload = {
  email?: string;
  tier?: TierId;
  provider?: string;
  currency?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateSessionPayload;
    const tier = (body.tier || "1-month") as TierId;
    const email = (body.email || "").trim().toLowerCase();
    const provider = (body.provider || "moonpay").trim().toLowerCase();
    const currency = (body.currency || "USD").trim().toUpperCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    if (!Object.prototype.hasOwnProperty.call(TIER_AMOUNTS, tier)) {
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

    const amount = TIER_AMOUNTS[tier].toFixed(2);
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
    paymentUrl.searchParams.set("address", walletJson.address_in);
    paymentUrl.searchParams.set("amount", amount);
    paymentUrl.searchParams.set("provider", provider);
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
