export type TierId = "free-trial" | "10-days" | "1-month" | "6-months" | "1-year" | "lifetime" | "lifetime-source" | "secret-test";

export interface PricingTier {
  amount: number;
  priceString: string;
}

export const PRICING_TIERS: Record<TierId, PricingTier> = {
  "free-trial": { amount: 0, priceString: "$0" },
  "10-days": { amount: 50, priceString: "$50" },
  "1-month": { amount: 155, priceString: "$155" },
  "6-months": { amount: 750, priceString: "$750" },
  "1-year": { amount: 1350, priceString: "$1,350" },
  "lifetime": { amount: 5555, priceString: "$5,555" },
  "lifetime-source": { amount: 55555, priceString: "$55,555" },
  "secret-test": { amount: 10, priceString: "$10" },
};
