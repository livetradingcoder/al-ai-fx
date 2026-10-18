// Every string the pricing section shows. The values here are the English text,
// and they are what a visitor gets when their language's dictionary doesn't have
// the key yet; PricingSection swaps in the translation for each key that has one.
// Placeholders like {days} are filled by fillTemplate in the section itself.

export const PRICING_LABEL_DEFAULTS = {
  pricingEyebrow: "Pricing",
  pricingTitleLead: "Simple plans.",
  pricingTitleAccent: "Serious execution.",
  pricingIntro:
    "Every plan delivers a GoldBot build compiled for your MT5 account. Choose a robot, try it first, then pick how long to run it.",
  pricingTabsLabel: "Choose a robot",
  pricingFlagship: "Flagship",
  pricingRangeOne: "{count} range",
  pricingRanges: "{count} ranges",
  pricingViewRobot: "View {name}",
  pricingStepTry: "Step 1 · Try it",
  pricingStepRun: "Step 2 · Run it",
  pricingStepRunHint: "The longer the term, the less each day costs.",
  pricingTrialTitle: "{days}-day trial",
  pricingFreeTrialTitle: "{days}-day free trial",
  pricingTrialNote: "Covers build and server costs",
  pricingFreeTrialNote: "Short hands-on test",
  pricingTrialPeriod: "for {days} days",
  pricingFree: "Free",
  pricingTrialCta: "Start {days}-day trial",
  pricingFreeTrialCta: "Start free trial",
  pricingTrialFine: "One trial per robot, then pick a plan.",
  pricingFreeTrialFine: "No card required. One trial per robot.",
  pricingTrialsLeft: "{left} of {cap} free trials left this month",
  pricingTrialUnavailable: "Currently unavailable",
  pricingTryAgainAfter: "Try again after {date}.",
  pricingPerDay: "≈ {price} / day",
  pricingSave: "Save {percent}% vs monthly",
  pricingMostPopular: "Most popular",
  pricingGetRobot: "Get {name}",
  pricingTrustLocked: "Account-locked build",
  pricingTrustDelivery: "Delivered automatically after checkout",
  pricingTrustMt5: "Runs on MetaTrader 5",
  pricingPayAfterTitle: "Pay After Trial",
  pricingPayAfterSoon: "Coming soon",
  pricingPayAfterHook: "Zero upfront. Pay only if your first 3 days close in profit.",
  pricingPayAfterCopy: "We're building the verification behind this so results are checked fairly before anyone is charged.",
  pricingMoreLicensingTitle: "Lifetime, source code, or a private deal?",
  pricingMoreLicensingCta: "See licensing options",
  pricingMoreCatalogTitle: "GoldBot is one of several strategies",
  pricingMoreCatalogCta: "Browse all robots",
  pricingUnavailableTitle: "The price list is taking a moment",
  pricingUnavailableCopy: "We couldn't load it just now. Every robot and plan is in the catalog.",
  pricingUnavailableCta: "Open the catalog",
  // Reused from the pricing cards this section replaces, so their translations carry over.
  "10DaysTitle": "10 Days",
  monthlyTitle: "Monthly",
  biannualTitle: "Biannual",
  "1YearTitle": "1 Year",
  for10Days: "for 10 days",
  perMonth: "per month",
  per6Months: "per 6 months",
  for1Year: "for 1 year",
  fastValidation: "Fast validation window",
  bestPlaceToStart: "Best place to start",
  "1YearNote": "Best value for committed traders",
  calcPerMonth: "({price} / month)",
  basicFeatureSet: "Basic feature set",
  standardRecovery: "Standard recovery profile",
  unlimitedDownloads: "Unlimited downloads",
  allStrategyFeatures: "All strategy features",
  priorityLiquidGuard: "Priority Liquid Guard",
  automatedDelivery: "Automated delivery",
} as const;

export type PricingLabelKey = keyof typeof PRICING_LABEL_DEFAULTS;
export type PricingLabels = Record<PricingLabelKey, string>;

/** The feature lines each card lists, by label key. */
export const TRIAL_FEATURES: PricingLabelKey[] = ["basicFeatureSet", "standardRecovery", "automatedDelivery"];
export const PLAN_FEATURES: Record<"10-days" | "1-month" | "6-months" | "1-year", PricingLabelKey[]> = {
  "10-days": ["basicFeatureSet", "standardRecovery", "automatedDelivery"],
  "1-month": ["unlimitedDownloads", "allStrategyFeatures", "automatedDelivery"],
  "6-months": ["unlimitedDownloads", "allStrategyFeatures", "priorityLiquidGuard", "automatedDelivery"],
  "1-year": ["unlimitedDownloads", "allStrategyFeatures", "priorityLiquidGuard", "automatedDelivery"],
};
export const PLAN_TITLE_KEY = {
  "10-days": "10DaysTitle",
  "1-month": "monthlyTitle",
  "6-months": "biannualTitle",
  "1-year": "1YearTitle",
} as const satisfies Record<string, PricingLabelKey>;
export const PLAN_PERIOD_KEY = {
  "10-days": "for10Days",
  "1-month": "perMonth",
  "6-months": "per6Months",
  "1-year": "for1Year",
} as const satisfies Record<string, PricingLabelKey>;
export const PLAN_NOTE_KEY: Partial<Record<"10-days" | "1-month" | "6-months" | "1-year", PricingLabelKey>> = {
  "10-days": "fastValidation",
  "1-month": "bestPlaceToStart",
  "1-year": "1YearNote",
};
