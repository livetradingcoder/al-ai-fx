import { PricingTier } from "@prisma/client";
import type { TierId } from "@/config/pricing";

export class UnknownTierError extends Error {
  constructor(tier: string) {
    super(`Unknown pricing tier: ${tier}`);
    this.name = "UnknownTierError";
  }
}

// How long each tier runs. Prices are not here: they are per robot, in the
// RobotPrice rows, and a default kept in code would only be a second copy to drift.
export interface TierMetadata {
  enum: PricingTier;
  durationDays: number | "lifetime";
}

// A trial is the FREE_TRIAL tier, and what a robot charges for it sets how long
// it runs: $0 and $0.99 buy 3 days, $1.99 and up buy 7. Each robot has one
// trial price (RobotPrice), so change it in the admin to move a robot between
// them. Length follows the robot's list price, not what was charged, so a
// coupon can't shorten or lengthen it.
export const SHORT_TRIAL_DAYS = 3;
export const LONG_TRIAL_DAYS = 7;
const LONG_TRIAL_FROM_PRICE = 1.99;

export const trialDays = (listPrice: number) =>
  listPrice >= LONG_TRIAL_FROM_PRICE ? LONG_TRIAL_DAYS : SHORT_TRIAL_DAYS;

// Record<TierId, ...> guarantees every TierId slug is present.
// Adding a slug to TierId in src/config/pricing.ts forces this map to grow — TS error otherwise.
export const TIER_METADATA: Record<TierId, TierMetadata> = {
  "free-trial":      { enum: PricingTier.FREE_TRIAL,       durationDays: SHORT_TRIAL_DAYS },
  "10-days":         { enum: PricingTier.TEN_DAYS,         durationDays: 10 },
  "1-month":         { enum: PricingTier.ONE_MONTH,        durationDays: 30 },
  "6-months":        { enum: PricingTier.SIX_MONTHS,       durationDays: 182 },
  "1-year":          { enum: PricingTier.ONE_YEAR,         durationDays: 365 },
  "lifetime":        { enum: PricingTier.LIFETIME,         durationDays: "lifetime" },
  "lifetime-source": { enum: PricingTier.LIFETIME_SOURCE,  durationDays: "lifetime" },
  "secret-test":     { enum: PricingTier.SECRET_TEST_TIER, durationDays: 7 },
};

// NOTE: mapTier is a TOTAL function — throws UnknownTierError on unknown input.
// Every caller MUST translate that throw to HTTP 400 (never fall back to a default).
export function mapTier(tierRaw: string): PricingTier {
  const normalized = tierRaw.trim().toLowerCase();
  const meta = TIER_METADATA[normalized as TierId];
  if (!meta) throw new UnknownTierError(tierRaw);
  return meta.enum;
}

// Exhaustive switch — assertNever fires at COMPILE TIME if PricingTier grows
// without a matching case added here.
export function computeExpirationDate(tier: PricingTier, opts: { trialPrice?: number } = {}): Date {
  const now = new Date();
  switch (tier) {
    case PricingTier.FREE_TRIAL: {
      const d = new Date(now);
      d.setDate(d.getDate() + trialDays(opts.trialPrice ?? 0));
      return d;
    }
    case PricingTier.TEN_DAYS: {
      const d = new Date(now);
      d.setDate(d.getDate() + 10);
      return d;
    }
    case PricingTier.ONE_MONTH: {
      const d = new Date(now);
      d.setMonth(d.getMonth() + 1);
      return d;
    }
    case PricingTier.SIX_MONTHS: {
      const d = new Date(now);
      d.setMonth(d.getMonth() + 6);
      return d;
    }
    case PricingTier.ONE_YEAR: {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() + 1);
      return d;
    }
    case PricingTier.LIFETIME:
    case PricingTier.LIFETIME_SOURCE: {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() + 100);
      return d;
    }
    case PricingTier.SECRET_TEST_TIER: {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      return d;
    }
    default:
      return assertNever(tier);
  }
}

function assertNever(x: never): never {
  throw new Error(`Non-exhaustive PricingTier switch: ${JSON.stringify(x)}`);
}
