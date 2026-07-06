import { PricingTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendPurchaseConfirmationEmail } from "@/lib/mail";
import { buildDashboardMagicLink } from "@/lib/magic-links";
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

// Phase 3: single-robot. Every subscription/compilation is scoped to GoldBot.
// Multi-robot selection (slug passed from checkout/catalog) is Phase 4+/6 work.
const GOLDBOT_SLUG = "goldbot";

function formatTierLabel(tier: PricingTier) {
  return tier.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
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

  // Resolve the single GoldBot Robot row (seeded in 03-01). Fail-closed:
  // if the seed is missing, findUniqueOrThrow throws P2025 and the whole flow
  // aborts with a 500 rather than creating a dangling subscription.
  const robot = await prisma.robot.findUniqueOrThrow({
    where: { slug: GOLDBOT_SLUG },
  });

  // Check if an active subscription of the same tier already exists.
  // Scoped per (user, robot, tier) — an active subscription is unique per robot.
  const existingSub = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      robotId: robot.id,
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
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      robotId: robot.id,
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
    const magicLinkUrl = buildDashboardMagicLink({ email, userId: user.id });

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
