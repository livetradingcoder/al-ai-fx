import { PricingTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendPurchaseConfirmationEmail } from "@/lib/mail";
import { buildMagicLinkUrl, createMagicLinkToken } from "@/lib/magic-links";
import { mapTier, computeExpirationDate, UnknownTierError } from "@/lib/pricing-tiers";

// Re-export so existing imports elsewhere (webhook route.ts, create-session, etc.)
// don't need to change their import path in this plan. Plan 02-02 may migrate
// callers to import directly from ./pricing-tiers.
export { mapTier, computeExpirationDate, UnknownTierError };

export async function findOrCreateUser(email: string) {
  let user = await prisma.user.findUnique({ where: { email } });
  const emailSuccess = true;

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: email.split("@")[0],
      },
    });

    console.log(`[Subscription Service] Created new user: ${email}`);
  }

  return { user, emailSuccess };
}

// Default catalog robot for all subscriptions provisioned before per-robot
// checkout selection lands (Plan 03-02). Today GoldBot is the only Robot row
// (seeded in 03-01), so every purchase is a GoldBot license.
const DEFAULT_ROBOT_SLUG = "goldbot";

async function resolveDefaultRobotId() {
  const robot = await prisma.robot.findUnique({
    where: { slug: DEFAULT_ROBOT_SLUG },
    select: { id: true },
  });
  if (!robot) {
    throw new Error(
      `[Subscription Service] Default robot '${DEFAULT_ROBOT_SLUG}' not found — run scripts/seed-goldbot.js`,
    );
  }
  return robot.id;
}

function formatTierLabel(tier: PricingTier) {
  return tier.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function createUserMagicLink(input: { email: string; userId: string }) {
  const secret = process.env.NEXTAUTH_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz";

  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to issue magic links.");
  }

  const token = createMagicLinkToken(
    {
      email: input.email,
      purpose: "login",
      userId: input.userId,
    },
    secret,
  );

  return buildMagicLinkUrl({
    baseUrl,
    locale: "en",
    token,
  });
}

export async function provisionSubscription(
  email: string,
  tierRaw: string,
  paygateId?: string,
  amount?: number,
  currency?: string,
) {
  const tier = mapTier(tierRaw);
  const { user, emailSuccess: welcomeEmailSuccess } = await findOrCreateUser(email);
  let overallEmailSuccess = welcomeEmailSuccess;

  if (paygateId) {
    const existingOrder = await prisma.order.findUnique({ where: { paygateId } });
    if (existingOrder) {
      return { userId: user.id, orderId: existingOrder.id, duplicated: true, emailSuccess: true };
    }
  }

  // Check if an active subscription of the same tier already exists
  const existingSub = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      tier,
      status: "ACTIVE",
    },
  });

  if (existingSub) {
    console.log(`[Subscription Service] User ${email} already has an active ${tier} subscription.`);
    return {
      userId: user.id,
      subscriptionId: existingSub.id,
      duplicated: true,
      emailSuccess: true,
    };
  }

  const expiresAt = computeExpirationDate(tier);
  const robotId = await resolveDefaultRobotId();
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      robotId,
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
  try {
    const magicLinkUrl = createUserMagicLink({ email, userId: user.id });

    await sendPurchaseConfirmationEmail(
      email,
      formatTierLabel(tier),
      expiresAt,
      magicLinkUrl,
    );
  } catch (error) {
    console.error(`[Subscription Service] Failed to send confirmation email to ${email}:`, error);
    overallEmailSuccess = false;
  }

  return {
    userId: user.id,
    subscriptionId: subscription.id,
    orderId,
    duplicated: false,
    emailSuccess: overallEmailSuccess,
  };
}
