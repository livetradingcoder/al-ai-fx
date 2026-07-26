export type TierId = "free-trial" | "10-days" | "1-month" | "6-months" | "1-year" | "lifetime" | "lifetime-source" | "secret-test";

export interface PricingTier {
  amount: number;
  priceString: string;
}

export const PRICING_TIERS: Record<TierId, PricingTier> = {
  "free-trial": { amount: 0, priceString: "$0" },
  "10-days": { amount: 19, priceString: "$19" },
  "1-month": { amount: 69, priceString: "$69" },
  "6-months": { amount: 299, priceString: "$299" },
  "1-year": { amount: 699, priceString: "$699" },
  "lifetime": { amount: 7999, priceString: "$7,999" },
  "lifetime-source": { amount: 79999, priceString: "$79,999" },
  "secret-test": { amount: 10, priceString: "$10" },
};
