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

export const PRICING_TIERS: Record<TierId, PricingTier> = {
  "free-trial": { amount: 0, priceString: "$0" },
  "10-days": { amount: 29, priceString: "$29" },
  "1-month": { amount: 99, priceString: "$99" },
  "6-months": { amount: 449, priceString: "$449" },
  "1-year": { amount: 999, priceString: "$999" },
  "lifetime": { amount: 9999, priceString: "$9,999" },
  "lifetime-source": { amount: 99999, priceString: "$99,999" },
  "secret-test": { amount: 10, priceString: "$10" },
};
