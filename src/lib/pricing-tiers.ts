import { PricingTier } from "@prisma/client";
import type { TierId } from "@/config/pricing";

export class UnknownTierError extends Error {
  constructor(tier: string) {
    super(`Unknown pricing tier: ${tier}`);
    this.name = "UnknownTierError";
  }
}

export interface TierMetadata {
  enum: PricingTier;
  amount: number;
  priceString: string;
  durationDays: number | "lifetime";
}

// Record<TierId, ...> guarantees every TierId slug is present.
// Adding a slug to TierId in src/config/pricing.ts forces this map to grow — TS error otherwise.
export const TIER_METADATA: Record<TierId, TierMetadata> = {
  "free-trial":      { enum: PricingTier.FREE_TRIAL,       amount:     0, priceString: "$0",      durationDays: 3 },
  "10-days":         { enum: PricingTier.TEN_DAYS,         amount:    69, priceString: "$69",     durationDays: 10 },
  "1-month":         { enum: PricingTier.ONE_MONTH,        amount:   199, priceString: "$199",    durationDays: 30 },
  "6-months":        { enum: PricingTier.SIX_MONTHS,       amount:   999, priceString: "$999",    durationDays: 182 },
  "1-year":          { enum: PricingTier.ONE_YEAR,         amount:  1799, priceString: "$1,799",  durationDays: 365 },
  "lifetime":        { enum: PricingTier.LIFETIME,         amount:  7999, priceString: "$7,999",  durationDays: "lifetime" },
  "lifetime-source": { enum: PricingTier.LIFETIME_SOURCE,  amount: 79999, priceString: "$79,999", durationDays: "lifetime" },
  "secret-test":     { enum: PricingTier.SECRET_TEST_TIER, amount:    10, priceString: "$10",     durationDays: 7 },
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
export function computeExpirationDate(tier: PricingTier): Date {
  const now = new Date();
  switch (tier) {
    case PricingTier.FREE_TRIAL: {
      const d = new Date(now);
      d.setDate(d.getDate() + 3);
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
