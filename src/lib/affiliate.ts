import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const REF_COOKIE = "alx_ref";

/** Query params a link might carry. Affiliates copy links from anywhere. */
export const REF_PARAMS = ["ref", "aff", "affiliate", "referral", "referralCode"];

/**
 * Codes are read aloud and typed by hand, so the alphabet drops the characters
 * people confuse: 0/O, 1/I/L. Length 8 gives ~1e12 combinations, far past any
 * chance of collision at our scale — and we retry on the unique index anyway.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(length = 8) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** IPs are only ever stored hashed: enough to spot one device farming signups,
 *  not enough to identify anybody. */
export function hashIp(ip: string | null | undefined) {
  if (!ip) return null;
  const salt = process.env.NEXTAUTH_SECRET ?? "al-ai-fx";
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex").slice(0, 32);
}

export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export type AffiliateSettings = Awaited<ReturnType<typeof getSettings>>;

/** The settings row is created by the migration; this upsert is a safety net
 *  for a database restored without it. */
export async function getSettings() {
  return prisma.affiliateSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

export async function getTiers() {
  return prisma.affiliateTier.findMany({ orderBy: { threshold: "asc" } });
}

/** Create the affiliate record for a user, or return the one they have. */
export async function ensureAffiliate(userId: string) {
  const existing = await prisma.affiliate.findUnique({ where: { userId } });
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.affiliate.create({ data: { userId, code: randomCode() } });
    } catch (err) {
      // P2002 = the code collided; try another. Any other error is real.
      if (!(err && typeof err === "object" && "code" in err && err.code === "P2002")) throw err;
    }
  }
  throw new Error("Could not allocate a referral code");
}

/**
 * Which rate applies to an affiliate right now: their override if an admin set
 * one, otherwise the highest tier they have reached, otherwise the default.
 */
export async function resolveRate(affiliateId: string) {
  const [affiliate, settings, tiers] = await Promise.all([
    prisma.affiliate.findUnique({ where: { id: affiliateId } }),
    getSettings(),
    getTiers(),
  ]);
  if (!affiliate) throw new Error("Unknown affiliate");
  if (affiliate.rateOverride != null) {
    return { rate: affiliate.rateOverride, tierName: "Custom", progress: null };
  }

  const total = await lifetimeTotal(affiliateId, settings.tierBasis);
  // Tiers are ascending, so the last one we clear is the one that applies.
  let current = { name: "Default", rate: settings.defaultRate, threshold: 0 };
  let next: { name: string; rate: number; threshold: number } | null = null;
  for (const tier of tiers) {
    if (total >= tier.threshold) current = tier;
    else if (!next) next = tier;
  }

  return {
    rate: current.rate,
    tierName: current.name,
    progress: { total, current, next, basis: settings.tierBasis },
  };
}

/** Lifetime total in whichever unit the ladder is measured in. */
export async function lifetimeTotal(affiliateId: string, basis: "VOLUME" | "REFERRALS") {
  if (basis === "REFERRALS") {
    // Referrals that actually bought — a signup that never paid is not progress.
    const rows = await prisma.commission.findMany({
      where: { affiliateId, status: { not: "REVERSED" } },
      select: { referralId: true },
      distinct: ["referralId"],
    });
    return rows.length;
  }
  const agg = await prisma.commission.aggregate({
    where: { affiliateId, status: { not: "REVERSED" } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/**
 * Turn a click-time cookie into a permanent attribution row.
 *
 * Called wherever a user first appears (checkout, free trial, registration).
 * Silent on every failure path — a broken referral must never stop a sale.
 */
export async function attachReferral(opts: {
  userId: string;
  code: string | null | undefined;
  landingPath?: string | null;
  ip?: string | null;
}) {
  const code = opts.code?.trim().toUpperCase();
  if (!code) return null;

  try {
    const existing = await prisma.referral.findUnique({ where: { referredUserId: opts.userId } });
    if (existing) return existing; // first referrer keeps the customer

    const affiliate = await prisma.affiliate.findUnique({ where: { code } });
    if (!affiliate || affiliate.status !== "ACTIVE") return null;

    const settings = await getSettings();
    if (settings.blockSelfReferral && affiliate.userId === opts.userId) return null;

    return await prisma.referral.create({
      data: {
        affiliateId: affiliate.id,
        referredUserId: opts.userId,
        code,
        landingPath: opts.landingPath ?? null,
        ipHash: hashIp(opts.ip),
      },
    });
  } catch (err) {
    console.error("[affiliate] attachReferral failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Record what an affiliate earned on a paid order.
 *
 * Runs after the order row exists. Free orders earn nothing. The rate is frozen
 * into the row: a later tier change must not rewrite history. Also silent on
 * failure — the customer's purchase already succeeded by this point.
 */
export async function recordCommission(opts: {
  orderId: string;
  userId: string;
  amount: number;
}) {
  if (!opts.amount || opts.amount <= 0) return null;

  try {
    const referral = await prisma.referral.findUnique({
      where: { referredUserId: opts.userId },
      include: { affiliate: true },
    });
    if (!referral || referral.affiliate.status !== "ACTIVE") return null;

    const settings = await getSettings();
    if (!settings.lifetimeScope) {
      const prior = await prisma.commission.count({ where: { referralId: referral.id } });
      if (prior > 0) return null; // first order only
    }

    const { rate } = await resolveRate(referral.affiliateId);
    const holdUntil = new Date(Date.now() + settings.holdDays * 86_400_000);
    const amount = Math.round(opts.amount * rate) / 100;

    const commission = await prisma.commission.create({
      data: {
        orderId: opts.orderId,
        affiliateId: referral.affiliateId,
        referralId: referral.id,
        orderAmount: opts.amount,
        rate,
        amount,
        holdUntil,
      },
    });
    console.log(
      `[affiliate] commission ${commission.id}: $${amount} (${rate}% of $${opts.amount}) ` +
        `to affiliate=${referral.affiliateId} order=${opts.orderId}`,
    );
    return commission;
  } catch (err) {
    // P2002 = this order already has a commission (webhook replay) — expected.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") return null;
    console.error("[affiliate] recordCommission failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Discount a referred customer gets on their FIRST paid order. Returns 0 for
 * everyone else, so callers can apply it unconditionally.
 */
export async function referredDiscountFor(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, referredBy: { select: { id: true } } },
    });
    if (!user?.referredBy) return 0;

    const settings = await getSettings();
    if (settings.referredDiscount <= 0) return 0;

    const paidBefore = await prisma.order.count({
      where: { userId: user.id, status: "SUCCESS" },
    });
    return paidBefore === 0 ? settings.referredDiscount : 0;
  } catch (err) {
    console.error("[affiliate] discount lookup failed:", err instanceof Error ? err.message : err);
    return 0;
  }
}

/** Money view for one affiliate: what is owed, what is still on hold. */
export async function affiliateBalance(affiliateId: string) {
  const rows = await prisma.commission.groupBy({
    by: ["status"],
    where: { affiliateId },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const sum = (status: string) => rows.find((r) => r.status === status)?._sum.amount ?? 0;
  return {
    pending: sum("PENDING"),
    approved: sum("APPROVED"),
    paid: sum("PAID"),
    reversed: sum("REVERSED"),
    lifetime: sum("PENDING") + sum("APPROVED") + sum("PAID"),
  };
}
