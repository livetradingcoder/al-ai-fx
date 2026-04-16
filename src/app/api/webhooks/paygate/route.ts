import { NextResponse } from "next/server";
import { UserRole, PricingTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type ProvisionPaymentInput = {
  email: string;
  tierRaw: string;
  amount: number;
  currency: string;
  paygateId: string;
};

function mapTier(tierRaw: string): PricingTier {
  switch (tierRaw.toLowerCase()) {
    case "free-trial":
    case "free_trial":
      return PricingTier.FREE_TRIAL;
    case "1-month":
    case "one_month":
    case "monthly":
      return PricingTier.ONE_MONTH;
    case "6-months":
    case "six_months":
    case "biannual":
      return PricingTier.SIX_MONTHS;
    case "lifetime":
      return PricingTier.LIFETIME;
    default:
      return PricingTier.ONE_MONTH;
  }
}

function computeExpirationDate(tier: PricingTier): Date {
  const expiresAt = new Date();

  if (tier === PricingTier.FREE_TRIAL) {
    expiresAt.setDate(expiresAt.getDate() + 3);
  } else if (tier === PricingTier.ONE_MONTH) {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  } else if (tier === PricingTier.SIX_MONTHS) {
    expiresAt.setMonth(expiresAt.getMonth() + 6);
  } else {
    expiresAt.setFullYear(expiresAt.getFullYear() + 100);
  }

  return expiresAt;
}

async function findOrCreateUser(email: string) {
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const tempPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name: email.split("@")[0],
      },
    });

    console.log(`[Paygate webhook] Created new user: ${email}. Temporary Password: ${tempPassword}`);
  }

  return user;
}

async function provisionPayment(input: ProvisionPaymentInput) {
  const tier = mapTier(input.tierRaw);
  const user = await findOrCreateUser(input.email);

  const existingOrder = await prisma.order.findUnique({ where: { paygateId: input.paygateId } });
  if (existingOrder) {
    return { userId: user.id, orderId: existingOrder.id, duplicated: true };
  }

  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      tier,
      expiresAt: computeExpirationDate(tier),
      status: "ACTIVE",
    },
  });

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      amount: input.amount,
      currency: input.currency,
      status: "SUCCESS",
      paygateId: input.paygateId,
      pricingTier: tier,
    },
  });

  return {
    userId: user.id,
    subscriptionId: subscription.id,
    orderId: order.id,
    duplicated: false,
  };
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
