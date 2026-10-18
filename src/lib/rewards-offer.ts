import { prisma } from "@/lib/prisma";
import { promoEligibilityForRequest } from "@/lib/promo-eligibility";
import {
  loadPortalContext,
  pickRewardSubscription,
  portalSnapshot,
  rewardProgress,
  type PortalSnapshot,
} from "@/lib/proof-portal";
import { createProofToken } from "@/lib/proof-token";

// What the reward pop-up shows a signed-in visitor: their progress on the
// "send results, share them, get a discount" path. Only people still on their
// trial (free or paid) are offered it: someone who has already bought a plan
// has no use for a first-plan discount, and anyone without a trial has nothing
// to report on. A trial fee is not a purchase of a plan, so it never counts as one.

const PAID_TIERS = ["TEN_DAYS", "ONE_MONTH", "SIX_MONTHS", "ONE_YEAR", "LIFETIME", "LIFETIME_SOURCE"];

export type RewardsOffer = {
  token: string;
  snapshot: PortalSnapshot;
  progress: { done: number; total: number; percent: number };
};

export async function rewardsOfferForUser(
  userId: string,
  req: Request,
  locale: string | null,
): Promise<RewardsOffer | null> {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId, tier: { not: "SECRET_TEST_TIER" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, tier: true, mt5AccountNumber: true },
  });
  if (!subscriptions.some((s) => s.tier === "FREE_TRIAL")) return null;
  if (subscriptions.some((s) => PAID_TIERS.includes(s.tier))) return null;

  const subscription = pickRewardSubscription(subscriptions);
  if (!subscription) return null;

  const token = createProofToken({ userId, subscriptionId: subscription.id });
  const ctx = await loadPortalContext(token);
  if (!ctx) return null;

  const eligibility = await promoEligibilityForRequest(req, locale);
  // Where promotions are not offered there is no reward to show.
  if (!eligibility.eligible) return null;

  const snapshot = await portalSnapshot(ctx, true);
  return { token, snapshot, progress: rewardProgress(snapshot) };
}
