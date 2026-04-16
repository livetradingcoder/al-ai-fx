import { NextResponse } from "next/server";
import { provisionSubscription } from "@/lib/subscriptions";

// ProvisionPaymentInput type removed as it's handled by provisionSubscription

async function provisionPayment(input: {
  email: string;
  tierRaw: string;
  amount: number;
  currency: string;
  paygateId: string;
}) {
  return provisionSubscription(input.email, input.tierRaw, input.paygateId, input.amount, input.currency);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orderRef = url.searchParams.get("order_ref") || "";
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();
    const tier = url.searchParams.get("tier") || "1-month";
    const currency = (url.searchParams.get("currency") || "USD").toUpperCase();
    const callbackAmount = url.searchParams.get("value_coin") || url.searchParams.get("amount") || "0";

    if (!orderRef || !email) {
      return NextResponse.json({ error: "Missing required callback parameters." }, { status: 400 });
    }

    const amount = Number.parseFloat(callbackAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid callback amount." }, { status: 400 });
    }

    const result = await provisionPayment({
      email,
      tierRaw: tier,
      amount,
      currency,
      paygateId: orderRef,
    });

    return NextResponse.json({ success: true, source: "paygate-get-callback", ...result }, { status: 200 });
  } catch (error) {
    console.error("Paygate GET callback error:", error);
    return NextResponse.json({ error: "Webhook payload processing failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      orderId?: string;
      customerEmail?: string;
      amount?: number | string;
      status?: string;
      metadata?: { tier?: string };
    };

    const status = (body.status || "").toUpperCase();
    if (status !== "PAID") {
      return NextResponse.json({ message: "Order not paid. Ignoring." }, { status: 200 });
    }

    const orderId = body.orderId || "";
    const customerEmail = (body.customerEmail || "").trim().toLowerCase();
    const tier = body.metadata?.tier || "1-month";
    const amount = Number.parseFloat(String(body.amount ?? "0"));

    if (!orderId || !customerEmail || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
    }

    const result = await provisionPayment({
      email: customerEmail,
      tierRaw: tier,
      amount,
      currency: "USD",
      paygateId: orderId,
    });

    return NextResponse.json(
      {
        success: true,
        message: result.duplicated
          ? "Payment was already processed previously."
          : "Account provisioned and subscription created.",
        ...result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Paygate POST callback error:", error);
    return NextResponse.json({ error: "Webhook payload processing failed." }, { status: 500 });
  }
}
