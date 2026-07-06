import { PricingTier } from "@prisma/client";

// Publicly listable tiers, in display order. Mirrors the curated set
// pricing-showcase.ts surfaces on the public site (free trial + the 4 paid
// windows). Hidden/contact-only tiers (LIFETIME, LIFETIME_SOURCE, SECRET_TEST_TIER)
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

export function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
