import { PAID_TRIALS } from "@/config/pricing";
import { trialDays } from "@/lib/pricing-tiers";

// The trials as one fact, so the FAQ, tutorials, llms.txt and the rest all say
// the same thing and a price change in config/pricing.ts reaches every page.

const offer = (trial: (typeof PAID_TRIALS)[number]) =>
  `${trial.name} has a ${trialDays(trial.amount)}-day trial for ${trial.priceString}`;

/** "Gold MultiRange 4 has a 7-day trial for $1.99 and PrecisionTrader has a 3-day trial for $0.99." */
export const TRIALS_SENTENCE = `${PAID_TRIALS.map(offer).join(" and ")}.`;

/** What the trial fee is, and the rule that goes with it. */
export const TRIAL_FEE_NOTE =
  "The small fee goes towards maintenance costs and is paid at checkout like any plan. Each account can take one trial per robot.";

/** The cheapest trial, for headlines: "$0.99". */
export const CHEAPEST_TRIAL_PRICE = [...PAID_TRIALS].sort((a, b) => a.amount - b.amount)[0].priceString;
