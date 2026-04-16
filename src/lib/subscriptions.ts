import { PricingTier, SubStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail, sendPurchaseConfirmationEmail } from "@/lib/mail";

export function mapTier(tierRaw: string): PricingTier {
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

export function computeExpirationDate(tier: PricingTier): Date {
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

export async function findOrCreateUser(email: string) {
  let user = await prisma.user.findUnique({ where: { email } });
  let tempPassword = null;

  if (!user) {
    tempPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name: email.split("@")[0],
      },
    });

    console.log(`[Subscription Service] Created new user: ${email}. Temporary Password: ${tempPassword}`);
    await sendWelcomeEmail(email, tempPassword);
  }

  return { user, tempPassword };
}

export async function provisionSubscription(email: string, tierRaw: string, paygateId?: string, amount?: number, currency?: string) {
  const tier = mapTier(tierRaw);
  const { user } = await findOrCreateUser(email);

  if (paygateId) {
    const existingOrder = await prisma.order.findUnique({ where: { paygateId } });
    if (existingOrder) {
      return { userId: user.id, orderId: existingOrder.id, duplicated: true };
    }
  }

  const expiresAt = computeExpirationDate(tier);
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      tier,
      expiresAt: expiresAt,
      status: "ACTIVE",
    },
  });

  let orderId = null;
  if (paygateId && amount !== undefined) {
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        amount: amount,
        currency: currency || "USD",
        status: "SUCCESS",
        paygateId: paygateId,
        pricingTier: tier,
      },
    });
    orderId = order.id;
  }

  // Send purchase confirmation (for free trial, it's more of a trial confirmation)
  await sendPurchaseConfirmationEmail(email, tier, expiresAt);

  return {
    userId: user.id,
    subscriptionId: subscription.id,
    orderId,
    duplicated: false,
  };
}
