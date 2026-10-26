import { prisma } from "@/lib/prisma";
import { chancesOf, getLiveGiveaway, paidTrialEmails } from "@/lib/giveaway";
import { verifyProofToken } from "@/lib/proof-token";
import { SHARE_REWARD_PERCENT } from "@/lib/rewards";

// What the results portal knows about a person, loaded from the signed token.
// Used by the upload / share / status routes and by the dashboard rewards page,
// so the page and the API always agree on what a person can do next.

export const MAX_PROOFS_PER_USER = 3;

/** A name for the public wall: trimmed, no markup, never an email address or an account number. */
export function cleanDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!name || name.includes("@") || /\d{5,}/.test(name)) return null;
  return name;
}

/**
 * The licence the rewards are for, from a person's licences (newest first):
 * one with an MT5 account linked if there is one, otherwise the newest.
 */
export function pickRewardSubscription<T extends { mt5AccountNumber: string | null }>(subscriptions: T[]): T | null {
  return subscriptions.find((s) => !!s.mt5AccountNumber?.trim()) ?? subscriptions[0] ?? null;
}

export type PortalContext = {
  userId: string;
  email: string;
  name: string | null;
  subscriptionId: string;
  /** The licence has an MT5 account linked, so there is a robot to report on. */
  linked: boolean;
};

export async function loadPortalContext(token: string | null | undefined): Promise<PortalContext | null> {
  const claims = token ? verifyProofToken(token) : null;
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, email: true, name: true, isBlocked: true, isDeleted: true },
  });
  if (!user || user.isBlocked || user.isDeleted) return null;

  const subscription = await prisma.subscription.findFirst({
    where: { id: claims.subscriptionId, userId: user.id },
    select: { id: true, mt5AccountNumber: true },
  });
  if (!subscription) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    subscriptionId: subscription.id,
    linked: !!subscription.mt5AccountNumber?.trim(),
  };
}

export type PortalSnapshot = {
  linked: boolean;
  /** Promotions (share reward, giveaway) are available where this person is. */
  promoEligible: boolean;
  maxProofs: number;
  proofs: { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string; published: boolean; adminNote: string | null }[];
  share: null | {
    status: "PENDING" | "APPROVED" | "REJECTED";
    platform: string;
    url: string;
    adminNote: string | null;
    coupon: null | { code: string; percent: number; expiresAt: string | null };
  };
  rewardPercent: number;
  giveaway: null | { title: string; prize: string; endsAt: string; slug: string; chances: number };
};

export async function portalSnapshot(ctx: PortalContext, promoEligible: boolean): Promise<PortalSnapshot> {
  const [proofs, share, giveaway] = await Promise.all([
    prisma.resultProof.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, publishedAt: true, adminNote: true },
    }),
    prisma.shareProof.findUnique({
      where: { userId: ctx.userId },
      include: { coupon: { select: { code: true, value: true, expiresAt: true } } },
    }),
    promoEligible ? getLiveGiveaway() : Promise.resolve(null),
  ]);

  let chances = 0;
  if (giveaway) {
    const entry = await prisma.giveawayEntry.findUnique({
      where: { giveawayId_email: { giveawayId: giveaway.id, email: ctx.email.toLowerCase() } },
      select: { bonusEntries: true },
    });
    if (entry) {
      const paid = await paidTrialEmails([ctx.email]);
      chances = chancesOf(entry, paid.has(ctx.email.toLowerCase()));
    }
  }

  return {
    linked: ctx.linked,
    promoEligible,
    maxProofs: MAX_PROOFS_PER_USER,
    proofs: proofs.map((p) => ({
      id: p.id,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      published: !!p.publishedAt,
      adminNote: p.adminNote,
    })),
    share: share
      ? {
          status: share.status,
          platform: share.platform,
          url: share.url,
          adminNote: share.adminNote,
          coupon:
            share.status === "APPROVED" && share.coupon
              ? {
                  code: share.coupon.code,
                  percent: share.coupon.value,
                  expiresAt: share.coupon.expiresAt?.toISOString() ?? null,
                }
              : null,
        }
      : null,
    rewardPercent: SHARE_REWARD_PERCENT,
    giveaway: giveaway
      ? { title: giveaway.title, prize: giveaway.prize, endsAt: giveaway.endsAt.toISOString(), slug: giveaway.slug, chances }
      : null,
  };
}

/** How far along the reward path someone is: link, send results, and (where offered) share. */
export function rewardProgress(snapshot: Pick<PortalSnapshot, "linked" | "proofs" | "share" | "promoEligible">): {
  done: number;
  total: number;
  percent: number;
} {
  const steps = [snapshot.linked, snapshot.proofs.some((p) => p.status !== "REJECTED")];
  if (snapshot.promoEligible) steps.push(!!snapshot.share?.coupon);
  const done = steps.filter(Boolean).length;
  return { done, total: steps.length, percent: Math.round((done / steps.length) * 100) };
}
