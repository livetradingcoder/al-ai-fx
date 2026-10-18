import { PricingTier } from "@prisma/client";

import { buildPricingCatalog, type PricingRobotRow } from "@/lib/pricing-catalog";
import { buildPricingFacts } from "@/lib/pricing-facts";

// Robots and prices for tests that need a catalog without a database. The
// numbers are examples, not the live prices: nothing may assert on them as if
// they were, only on what the code derives from them.

const row = (
  slug: string,
  name: string,
  sortOrder: number,
  prices: [PricingTier, number][],
  badge: string | null = null,
): PricingRobotRow => ({
  slug,
  name,
  shortDescription: `${name}: example description.`,
  badge,
  sortOrder,
  prices: prices.map(([tier, amount]) => ({ tier, amount })),
});

export const FIXTURE_ROWS: PricingRobotRow[] = [
  row(
    "precision-trader",
    "PrecisionTrader",
    0,
    [
      [PricingTier.FREE_TRIAL, 0.99],
      [PricingTier.TEN_DAYS, 15],
      [PricingTier.ONE_MONTH, 39],
      [PricingTier.SIX_MONTHS, 179],
      [PricingTier.ONE_YEAR, 299],
    ],
    "Single range",
  ),
  row(
    "gold-multirange-4",
    "Gold MultiRange 4",
    1,
    [
      [PricingTier.FREE_TRIAL, 1.99],
      [PricingTier.TEN_DAYS, 39],
      [PricingTier.ONE_MONTH, 99],
      [PricingTier.SIX_MONTHS, 449],
      [PricingTier.ONE_YEAR, 799],
    ],
    "Prop firm compatible",
  ),
  row(
    "goldbot",
    "GoldBot Double Range",
    2,
    [
      [PricingTier.FREE_TRIAL, 0],
      [PricingTier.ONE_MONTH, 79],
    ],
  ),
  row("gold-multirange-7", "Gold MultiRange 7", 3, []),
];

export const FIXTURE_CATALOG = buildPricingCatalog(FIXTURE_ROWS, "gold-multirange-4")!;
export const FIXTURE_FACTS = buildPricingFacts(FIXTURE_CATALOG);
/** The facts when the catalog could not be loaded: no numbers anywhere. */
export const NO_CATALOG_FACTS = buildPricingFacts(null);
