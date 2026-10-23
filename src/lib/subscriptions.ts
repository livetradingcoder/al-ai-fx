import { PricingTier, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { attachReferral, recordCommission } from "@/lib/affiliate";
import { sendPurchaseConfirmationEmail } from "@/lib/mail";
import { buildDashboardMagicLink } from "@/lib/magic-links";
import { mapTier, computeExpirationDate, trialDays, UnknownTierError } from "@/lib/pricing-tiers";
import { resolveRobotPrice } from "@/lib/robot-pricing";
import { inBackground, sendPurchaseEvent } from "@/lib/meta-events";
import { emitWebhookEvent, inBackground as webhooksInBackground, providerOf, type EventData } from "@/lib/outbound-webhooks";
import type { MetaUserInput } from "@/lib/meta-capi";

// Re-export so existing imports elsewhere (webhook route.ts, create-session, etc.)
// don't need to change their import path in this plan. Plan 02-02 may migrate
// callers to import directly from ./pricing-tiers.
export { mapTier, computeExpirationDate, UnknownTierError };

export async function findOrCreateUser(email: string) {
  let user = await prisma.user.findUnique({ where: { email } });
  const emailSuccess = true;
  const created = !user;

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: email.split("@")[0],
      },
    });

    console.log(`[Subscription Service] Created new user: ${email}`);
  }

  return { user, emailSuccess, created };
}

/** What a payment provider tells us about the buyer, beyond their email. It only
 *  ever goes to Meta hashed, and only for a visitor who accepted ad cookies. */
export type BuyerDetails = Pick<MetaUserInput, "firstName" | "lastName" | "city" | "state" | "zip" | "country">;

// `trialPrice` is the robot's trial price: a trial it charges for is a "7-Day Trial", not a "Free Trial".
function formatTierLabel(tier: PricingTier, trialPrice: number) {
  if (tier === PricingTier.FREE_TRIAL && trialPrice > 0) return `${trialDays(trialPrice)}-Day Trial`;
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
  buyer?: BuyerDetails,
) {
  const { user, emailSuccess: welcomeEmailSuccess, created: userCreated } = await findOrCreateUser(email);
  let overallEmailSuccess = welcomeEmailSuccess;

  if (paygateId) {
    const existingOrder = await prisma.order.findUnique({ where: { paygateId } });
    if (existingOrder) {
      return { userId: user.id, orderId: existingOrder.id, duplicated: true, emailSuccess: true };
    }
  }

  // Fail-closed robot+tier+price resolution (throws UnknownRobotError /
  // UnknownRobotPriceError / UnknownTierError — never defaults to GoldBot).
  const { robot, tier, amount: listPrice } = await resolveRobotPrice(robotSlug, tierRaw);

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
      // A lapsed one doesn't count: buying the plan again must create a new licence.
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
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

  // How long a trial runs depends on what the robot charges for it (see trialDays).
  const expiresAt = computeExpirationDate(tier, { trialPrice: listPrice });
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

  // Webhook events are collected as things succeed and sent together once the
  // purchase is safely recorded, in order, without holding up the caller. A
  // purchase that failed part-way (unknown robot, duplicate) sends none.
  const events: EventData[] = [];
  if (tier === "FREE_TRIAL") {
    // One event for a trial that also created the account: a signup followed
    // by a trial is two chat messages about one person. A trial the robot
    // charges for is followed by its sale event; this one still says it started.
    events.push({
      type: "trial.started",
      data: {
        userId: user.id,
        email,
        robotSlug: robot.slug,
        robotName: robot.name,
        newAccount: userCreated,
        paid: listPrice > 0,
        days: trialDays(listPrice),
      },
    });
  } else if (userCreated && !(paygateId && amount !== undefined)) {
    // A paid order from a new customer is reported by the sale event itself.
    events.push({
      type: "user.signup",
      data: { userId: user.id, email, name: user.name, source: "purchase" },
    });
  }

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

    events.push({
      type: "sale.completed",
      data: {
        orderId: order.id,
        orderRef: paygateId,
        provider: providerOf(paygateId),
        amount,
        currency: currency || "USD",
        tier,
        robotSlug: robot.slug,
        robotName: robot.name,
        email,
        userId: user.id,
        refCode: refCode ?? null,
        // A paid trial that made the account is announced by its trial.started event.
        newCustomer: userCreated && tier !== PricingTier.FREE_TRIAL,
        ...(tier === PricingTier.FREE_TRIAL ? { trialDays: trialDays(listPrice) } : {}),
      },
    });

    // A trial fee earns no commission. Where affiliates are paid on a referral's
    // first order only, it would use up the one commission the buyer's first
    // real plan should pay.
    if (tier !== PricingTier.FREE_TRIAL) {
      await recordCommission({ orderId: order.id, userId: user.id, amount });
    }

    // Tell Meta's Conversions API, in the background and fenced off: a tracking
    // problem must never be able to fail an order that has already been paid.
    inBackground(() =>
      sendPurchaseEvent({
        orderRef: paygateId,
        email,
        userId: user.id,
        amount,
        currency: currency || "USD",
        robotSlug: robot.slug,
        robotName: robot.name,
        tierSlug: tierRaw,
        customer: buyer,
      }),
    );
  }

  if (events.length > 0) {
    webhooksInBackground(async () => {
      for (const event of events) await emitWebhookEvent(event);
    });
  }

  // Send purchase confirmation (for free trial, it's more of a trial confirmation)
  try {
    const magicLinkUrl = buildDashboardMagicLink({ email, userId: user.id });

    await sendPurchaseConfirmationEmail(
      email,
      formatTierLabel(tier, listPrice),
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
