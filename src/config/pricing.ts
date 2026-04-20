export type TierId = "free-trial" | "10-days" | "1-month" | "6-months" | "1-year" | "lifetime" | "lifetime-source" | "secret-test";

export interface PricingTier {
  amount: number;
  priceString: string;
}

export const PRICING_TIERS: Record<TierId, PricingTier> = {
  "free-trial": { amount: 0, priceString: "$0" },
  "10-days": { amount: 69, priceString: "$69" },
  "1-month": { amount: 199, priceString: "$199" },
  "6-months": { amount: 999, priceString: "$999" },
  "1-year": { amount: 1799, priceString: "$1,799" },
  "lifetime": { amount: 7999, priceString: "$7,999" },
  "lifetime-source": { amount: 79999, priceString: "$79,999" },
  "secret-test": { amount: 10, priceString: "$10" },
};
