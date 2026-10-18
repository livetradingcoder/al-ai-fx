export type TierId = "free-trial" | "10-days" | "1-month" | "6-months" | "1-year" | "lifetime" | "lifetime-source" | "secret-test";

export interface PricingTier {
  amount: number;
  priceString: string;
}

// The robot the homepage pricing cards sell. Display only: checkout always
// charges the robot's RobotPrice rows, so PRICING_TIERS below must be kept
// equal to this robot's prices in the admin, or the homepage misquotes it.
export const FLAGSHIP_ROBOT = { slug: "gold-multirange-4", name: "Gold MultiRange 4" } as const;

// Delisted robot slug -> the robot that replaced it. Old links to a delisted
// robot's page or checkout land on its successor instead of a 404 or an
// unrelated robot.
export const RETIRED_ROBOTS: Record<string, string> = {
  goldbot: "gold-multirange-4",
};

// The paid trials: a robot's FREE_TRIAL price row set above zero. Same tier,
// same one-per-robot rule, but it goes through checkout, and the price sets the
// length ($0.99 runs 3 days, $1.99 runs 7: trialDays in src/lib/pricing-tiers.ts).
// Display only, like PRICING_TIERS: the charge is the robot's RobotPrice row, so
// keep these equal to what the admin has for each robot.
export const PAID_TRIALS = [
  { slug: FLAGSHIP_ROBOT.slug, name: FLAGSHIP_ROBOT.name, amount: 1.99, priceString: "$1.99" },
  { slug: "precision-trader", name: "PrecisionTrader", amount: 0.99, priceString: "$0.99" },
] as const;

// A longer plan must always cost less per day than a shorter one, or the
// shorter plan quietly becomes the better deal (src/lib/pricing-ladder.test.ts
// holds the ladder to that). The 1-year price also has to undercut two
// 6-month plans back to back.
export const PRICING_TIERS: Record<TierId, PricingTier> = {
  "free-trial": { amount: 0, priceString: "$0" },
  "10-days": { amount: 39, priceString: "$39" },
  "1-month": { amount: 99, priceString: "$99" },
  "6-months": { amount: 449, priceString: "$449" },
  "1-year": { amount: 799, priceString: "$799" },
  "lifetime": { amount: 9999, priceString: "$9,999" },
  "lifetime-source": { amount: 99999, priceString: "$99,999" },
  "secret-test": { amount: 10, priceString: "$10" },
};
