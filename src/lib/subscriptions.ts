import { PricingTier, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { attachReferral, recordCommission } from "@/lib/affiliate";
import { sendPurchaseConfirmationEmail } from "@/lib/mail";
import { buildDashboardMagicLink } from "@/lib/magic-links";
import { mapTier, computeExpirationDate, UnknownTierError } from "@/lib/pricing-tiers";
import { resolveRobotPrice } from "@/lib/robot-pricing";

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

function formatTierLabel(tier: PricingTier) {
  return tier.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

// Phase 6: robotSlug is REQUIRED — no GoldBot default. An unknown/inactive robot
// or untiered/inactive price is refused (UnknownRobotError/UnknownRobotPriceError/
// UnknownTierError propagate to the caller), never coerced. Amount is ALWAYS
// resolved server-side via resolveRobotPrice — never trust a client-supplied amount.
export async function provisionSubscription(
  email: string,
  tierRaw: string,
  robotSlug: string,
  paygateId?: string,
  amount?: number,
  currency?: string,
  refCode?: string | null,
) {
  const { user, emailSuccess: welcomeEmailSuccess } = await findOrCreateUser(email);
  let overallEmailSuccess = welcomeEmailSuccess;

  if (paygateId) {
    const existingOrder = await prisma.order.findUnique({ where: { paygateId } });
    if (existingOrder) {
      return { userId: user.id, orderId: existingOrder.id, duplicated: true, emailSuccess: true };
    }
  }

  // Fail-closed robot+tier+price resolution (throws UnknownRobotError /
  // UnknownRobotPriceError / UnknownTierError — never defaults to GoldBot).
  const { robot, tier } = await resolveRobotPrice(robotSlug, tierRaw);

  // Check if an active subscription of the same tier already exists.
  // Scoped per (user, robot, tier) — an active subscription is unique per robot.
  // For FREE_TRIAL this is a nice-message pre-check only; the REAL guard is the
  // DB partial unique index (Subscription_one_free_trial_per_robot, 06-01),
  // which catches even an EXPIRED prior trial (existence-ever, not active-ever).
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
  let subscription;
  try {
    subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        robotId: robot.id,
        tier,
        expiresAt: expiresAt,
        status: "ACTIVE",
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      tier === "FREE_TRIAL"
    ) {
      // Partial unique index Subscription_one_free_trial_per_robot fired:
      // this user already claimed (ever) a free trial for this robot.
      return {
        userId: user.id,
        duplicated: true,
        alreadyTrialed: true,
        emailSuccess: true,
      };
    }
    throw err;
  }

  // Attribution before money: the referral row has to exist for the commission
  // to hang off. `refCode` rides along on the Paygate callback URL for paid
  // orders; the free-trial route passes the cookie straight in. Either way this
  // is a no-op once the user already has a referrer — the first one keeps them.
  await attachReferral({ userId: user.id, code: refCode });

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

    await recordCommission({ orderId: order.id, userId: user.id, amount });
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
