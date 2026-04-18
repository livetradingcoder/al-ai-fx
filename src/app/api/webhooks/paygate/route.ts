import { NextResponse } from "next/server";
import { provisionSubscription } from "@/lib/subscriptions";
import { createHmac } from "crypto";
import { checkWebhookRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail, validateAmount } from "@/lib/validation";

async function provisionPayment(input: {
  email: string;
  tierRaw: string;
  amount: number;
  currency: string;
  paygateId: string;
}) {
  return provisionSubscription(input.email, input.tierRaw, input.paygateId, input.amount, input.currency);
}

/**
 * Verifies webhook signature to prevent unauthorized access
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;
  
  const secret = process.env.PAYGATE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[Paygate Webhook] PAYGATE_WEBHOOK_SECRET not configured. Skipping signature verification.");
    return true; // Allow in development, but log warning
  }
  
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === expectedSignature;
}

export async function GET(req: Request) {
  // Rate limiting
  const identifier = getClientIdentifier(req);
  const { success } = await checkWebhookRateLimit(identifier);
  
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const url = new URL(req.url);
    const orderRef = url.searchParams.get("order_ref") || "";
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();
    const tier = url.searchParams.get("tier") || "1-month";
    const currency = (url.searchParams.get("currency") || "USD").toUpperCase();
    const callbackAmount = url.searchParams.get("value_coin") || url.searchParams.get("amount") || "0";
    const signature = url.searchParams.get("signature");

    // Verify signature if configured
    const signaturePayload = `${orderRef}${email}${tier}${callbackAmount}`;
    if (!verifyWebhookSignature(signaturePayload, signature)) {
      console.error("[Paygate Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (!orderRef || !email) {
      return NextResponse.json({ error: "Missing required callback parameters." }, { status: 400 });
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    const amount = Number.parseFloat(callbackAmount);
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return NextResponse.json({ error: amountValidation.error }, { status: 400 });
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
  // Rate limiting
  const identifier = getClientIdentifier(req);
  const { success } = await checkWebhookRateLimit(identifier);
  
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paygate-signature");
    
    // Verify signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error("[Paygate Webhook] Invalid POST signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as {
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

    // Validate email
    const emailValidation = validateEmail(customerEmail);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    // Validate amount
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid || !orderId) {
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
