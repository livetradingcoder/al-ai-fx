import { PricingTier } from "@prisma/client";

import { TIER_METADATA, trialDays } from "@/lib/pricing-tiers";

// What the homepage pricing section shows, derived from the robots and prices in
// the database and nothing else: the same rows checkout charges from
// (resolveRobotPrice), so the page cannot quote a price checkout won't honour.
// Pure on purpose: src/lib/pricing-data.ts reads the rows, this turns them into
// cards, and the tests below feed it fixtures.

export type PlanSlug = "10-days" | "1-month" | "6-months" | "1-year";

export interface CatalogPlan {
  tier: PlanSlug;
  amount: number;
  /** Length of the plan in days (the same figure that sets the licence expiry). */
  days: number;
  perDay: number;
  /** Monthly equivalent, only for the plans sold by the half-year or year. */
  perMonth: number | null;
  /** How much cheaper per day than the monthly plan, in whole percent. Null when it isn't meaningfully cheaper. */
  savingsPercent: number | null;
  /** The one plan the section highlights. */
  popular: boolean;
}

export interface CatalogTrial {
  amount: number;
  days: number;
  /** Priced at zero: claimed without paying, behind the free-trial limits. */
  free: boolean;
}

export interface CatalogRobot {
  slug: string;
  name: string;
  badge: string | null;
  /** Session ranges the robot trades a day, when the name says. */
  ranges: number | null;
  description: string;
  flagship: boolean;
  trial: CatalogTrial | null;
  plans: CatalogPlan[];
}

export interface PricingCatalog {
  robots: CatalogRobot[];
  /** The robot selected first: the flagship when it is on sale, else the first listed. */
  defaultSlug: string;
}

export interface PricingRobotRow {
  slug: string;
  name: string;
  shortDescription: string;
  badge: string | null;
  sortOrder: number;
  /** Active public price rows only. */
  prices: { tier: PricingTier; amount: number }[];
}

const PLAN_TIERS: { tier: PricingTier; slug: PlanSlug; months: number | null }[] = [
  { tier: PricingTier.TEN_DAYS, slug: "10-days", months: null },
  { tier: PricingTier.ONE_MONTH, slug: "1-month", months: null },
  { tier: PricingTier.SIX_MONTHS, slug: "6-months", months: 6 },
  { tier: PricingTier.ONE_YEAR, slug: "1-year", months: 12 },
];

/** Below this a plan is not worth advertising as a saving. */
const MIN_SAVINGS_PERCENT = 5;

const roundCents = (n: number) => Math.round(n * 100) / 100;

function durationDays(slug: PlanSlug): number {
  const { durationDays: days } = TIER_METADATA[slug];
  if (typeof days !== "number") throw new Error(`Plan ${slug} has no fixed length`);
  return days;
}

/**
 * Session ranges a robot trades a day, read from its name ("Gold MultiRange 7",
 * "GoldBot Double Range", the single-range breakout robots). Display only: a
 * name that says nothing gives null and the chip is left out.
 */
export function rangeCount(name: string): number | null {
  const multi = name.match(/multi\s*-?\s*range\s*(\d+)/i);
  if (multi) return Number(multi[1]);
  if (/double\s*range/i.test(name)) return 2;
  if (/breakout|precision/i.test(name)) return 1;
  return null;
}

function buildPlans(prices: PricingRobotRow["prices"]): CatalogPlan[] {
  const found = PLAN_TIERS.flatMap((plan) => {
    const row = prices.find((p) => p.tier === plan.tier);
    return row && row.amount > 0 ? [{ ...plan, amount: row.amount }] : [];
  });

  const monthly = found.find((p) => p.slug === "1-month");
  const monthlyPerDay = monthly ? monthly.amount / durationDays("1-month") : null;
  // The highlighted plan is the year, else the half-year, else the month: the
  // longest commitment this robot offers that the site already promotes. With
  // a single plan on sale there is nothing to be "most popular" against.
  const popularSlug =
    found.length < 2
      ? undefined
      : (["1-year", "6-months", "1-month"] as PlanSlug[]).find((slug) => found.some((p) => p.slug === slug));

  return found.map((plan) => {
    const days = durationDays(plan.slug);
    const perDay = plan.amount / days;
    const savings =
      monthlyPerDay !== null && plan.months !== null ? Math.round((1 - perDay / monthlyPerDay) * 100) : null;
    return {
      tier: plan.slug,
      amount: plan.amount,
      days,
      perDay: roundCents(perDay),
      perMonth: plan.months !== null ? roundCents(plan.amount / plan.months) : null,
      savingsPercent: savings !== null && savings >= MIN_SAVINGS_PERCENT ? savings : null,
      popular: plan.slug === popularSlug,
    };
  });
}

/**
 * Pairs of neighbouring plans where the longer one costs as much or more per
 * day than the shorter. The page shows what the database says; this is how the
 * admin finds out a robot's ladder is upside down (a 10-day plan that is the
 * cheapest way to buy a month makes the monthly plan pointless).
 */
export function ladderInversions(
  plans: Pick<CatalogPlan, "tier" | "amount" | "days">[],
): { shorter: PlanSlug; longer: PlanSlug; shorterPerDay: number; longerPerDay: number }[] {
  const byLength = [...plans].sort((a, b) => a.days - b.days);
  return byLength.slice(1).flatMap((longer, i) => {
    const shorter = byLength[i];
    const shorterPerDay = shorter.amount / shorter.days;
    const longerPerDay = longer.amount / longer.days;
    return longerPerDay >= shorterPerDay
      ? [{ shorter: shorter.tier, longer: longer.tier, shorterPerDay: roundCents(shorterPerDay), longerPerDay: roundCents(longerPerDay) }]
      : [];
  });
}

export function buildPricingCatalog(rows: PricingRobotRow[], flagshipSlug: string): PricingCatalog | null {
  const robots: CatalogRobot[] = [...rows]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .flatMap((row) => {
      const plans = buildPlans(row.prices);
      const trialRow = row.prices.find((p) => p.tier === PricingTier.FREE_TRIAL);
      const trial: CatalogTrial | null = trialRow
        ? { amount: trialRow.amount, days: trialDays(trialRow.amount), free: trialRow.amount <= 0 }
        : null;
      // A robot with nothing to buy is "coming soon": it has no place in a price list.
      if (plans.length === 0 && !trial) return [];
      return [
        {
          slug: row.slug,
          name: row.name,
          badge: row.badge?.trim() || null,
          ranges: rangeCount(row.name),
          description: row.shortDescription,
          flagship: row.slug === flagshipSlug,
          trial,
          plans,
        },
      ];
    });

  if (robots.length === 0) return null;
  return { robots, defaultSlug: (robots.find((r) => r.flagship) ?? robots[0]).slug };
}

/** "$99", "$1.99": whole dollars stay whole, anything else shows its cents. */
export function formatUsd(amount: number): string {
  const whole = Number.isInteger(amount);
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Fills `{name}` placeholders in a translated string. */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
