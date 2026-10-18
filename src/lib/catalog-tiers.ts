import { PricingTier } from "@prisma/client";

// Publicly listable tiers, in display order: the trial and the 4 paid windows
// the home page, catalog and checkout show. Hidden/contact-only tiers (LIFETIME, LIFETIME_SOURCE, SECRET_TEST_TIER)
// are intentionally EXCLUDED so a RobotPrice row for them never leaks onto a card.
export const CATALOG_PUBLIC_TIERS: PricingTier[] = [
  PricingTier.FREE_TRIAL,
  PricingTier.TEN_DAYS,
  PricingTier.ONE_MONTH,
  PricingTier.SIX_MONTHS,
  PricingTier.ONE_YEAR,
];

// Maps a PricingTier enum back to its checkout slug (?tier=<id>) for CTA links.
export const TIER_ENUM_TO_SLUG: Record<PricingTier, string> = {
  FREE_TRIAL: "free-trial",
  TEN_DAYS: "10-days",
  ONE_MONTH: "1-month",
  SIX_MONTHS: "6-months",
  ONE_YEAR: "1-year",
  LIFETIME: "lifetime",
  LIFETIME_SOURCE: "lifetime-source",
  SECRET_TEST_TIER: "secret-test",
};

// A plan someone pays for, as opposed to the trial. A robot can price its trial
// above zero (the flagship's $1.99), and that must not become its "from" price,
// count as a paid tier or turn up as a plan offer.
export function isPlanPrice(price: { tier: PricingTier; amount: number }): boolean {
  return price.amount > 0 && price.tier !== PricingTier.FREE_TRIAL;
}

// Whether a robot offers a trial, free or paid: it has a trial price row at all.
// (A robot with no trial row has none; one priced at $0 is free, above that paid.)
export function hasTrialPrice(prices: { tier: PricingTier }[]): boolean {
  return prices.some((p) => p.tier === PricingTier.FREE_TRIAL);
}

export function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
