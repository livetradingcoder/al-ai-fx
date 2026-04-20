import { PRICING_TIERS, type TierId } from "@/config/pricing";

type TranslateValues = {
  fallback?: string;
  price?: string;
};

type Translate = (key: string, values?: TranslateValues) => string;

export interface PricingShowcasePlan {
  id: TierId;
  title: string;
  price: string;
  period: string;
  note: string;
  features: string[];
  featured?: boolean;
}

export interface ComingSoonProduct {
  title: string;
  status: string;
  eyebrow: string;
  description: string;
  bullets: string[];
  surfaceLabel: string;
  accent: "gold" | "signal" | "platform";
  glyph: string;
}

export interface ContactOffer {
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  accent: "concierge" | "licensing" | "deployment";
  glyph: string;
}

export function buildSubscriptionPlans(t: Translate): PricingShowcasePlan[] {
  return [
    {
      id: "10-days",
      title: t("10DaysTitle", { fallback: "10 Days" }),
      price: PRICING_TIERS["10-days"].priceString,
      period: t("for10Days", { fallback: "for 10 days" }),
      note: t("fastValidation", { fallback: "Fast validation window" }),
      features: [
        t("basicFeatureSet"),
        t("standardRecovery"),
        t("automatedDelivery"),
      ],
    },
    {
      id: "1-month",
      title: t("monthlyTitle", { fallback: "Monthly" }),
      price: PRICING_TIERS["1-month"].priceString,
      period: t("perMonth", { fallback: "per month" }),
      note: t("bestPlaceToStart", { fallback: "Best place to start" }),
      features: [
        t("unlimitedDownloads"),
        t("allStrategyFeatures"),
        t("automatedDelivery"),
      ],
    },
    {
      id: "6-months",
      title: t("biannualTitle", { fallback: "Biannual" }),
      price: PRICING_TIERS["6-months"].priceString,
      period: t("per6Months", { fallback: "per 6 months" }),
      note: t("calcPerMonth", {
        price: `$${(PRICING_TIERS["6-months"].amount / 6).toFixed(0)}`,
        fallback: "($167 / month)",
      }),
      features: [
        t("unlimitedDownloads"),
        t("allStrategyFeatures"),
        t("priorityLiquidGuard"),
        t("automatedDelivery"),
      ],
    },
    {
      id: "1-year",
      title: t("1YearTitle", { fallback: "1 Year" }),
      price: PRICING_TIERS["1-year"].priceString,
      period: t("for1Year", { fallback: "for 1 year" }),
      note: t("calcPerMonth", {
        price: `$${(PRICING_TIERS["1-year"].amount / 12).toFixed(2)}`,
        fallback: "($149.92 / month)",
      }),
      featured: true,
      features: [
        t("unlimitedDownloads"),
        t("allStrategyFeatures"),
        t("priorityLiquidGuard"),
        t("automatedDelivery"),
      ],
    },
  ];
}

export function buildComingSoonProducts(t: Translate): ComingSoonProduct[] {
  return [
    {
      title: t("comingSoonGoldGapTitle", { fallback: "GoldGap" }),
      status: t("comingSoonGoldGapStatus", { fallback: "Coming Soon" }),
      eyebrow: t("comingSoonGoldGapEyebrow", { fallback: "Gold session engine" }),
      description: t("comingSoonGoldGapDescription", {
        fallback:
          "A sharper gold-specific system focused on gap behavior, opening range dislocations, and cleaner reaction windows around session transitions.",
      }),
      bullets: [
        t("comingSoonGoldGapBullet1", {
          fallback: "Built specifically for gold volatility structure",
        }),
        t("comingSoonGoldGapBullet2", {
          fallback: "Tighter session-led setup logic",
        }),
        t("comingSoonGoldGapBullet3", {
          fallback: "Designed for premium short-window deployment",
        }),
      ],
      surfaceLabel: t("comingSoonGoldGapSurface", { fallback: "MT5 native" }),
      accent: "gold",
      glyph: "halo",
    },
    {
      title: t("comingSoonTradingViewTitle", {
        fallback: "GoldBot for TradingView",
      }),
      status: t("comingSoonTradingViewStatus", { fallback: "Signal Stack" }),
      eyebrow: t("comingSoonTradingViewEyebrow", {
        fallback: "TradingView workflow",
      }),
      description: t("comingSoonTradingViewDescription", {
        fallback:
          "The GoldBot logic translated into a signal-first environment for traders who want alerts, chart-native structure, and a cleaner discretionary overlay.",
      }),
      bullets: [
        t("comingSoonTradingViewBullet1", {
          fallback: "Signal delivery for TradingView users",
        }),
        t("comingSoonTradingViewBullet2", {
          fallback: "Alert-led workflow instead of terminal lock-in",
        }),
        t("comingSoonTradingViewBullet3", {
          fallback: "Built for cleaner chart review and decision support",
        }),
      ],
      surfaceLabel: t("comingSoonTradingViewSurface", {
        fallback: "Alerts + scripts",
      }),
      accent: "signal",
      glyph: "signal",
    },
    {
      title: t("comingSoonCTraderTitle", { fallback: "GoldBot for cTrader" }),
      status: t("comingSoonCTraderStatus", { fallback: "Execution Stack" }),
      eyebrow: t("comingSoonCTraderEyebrow", { fallback: "cTrader expansion" }),
      description: t("comingSoonCTraderDescription", {
        fallback:
          "A cTrader edition aimed at traders who want the same disciplined GoldBot posture inside a cleaner, more institutional execution environment.",
      }),
      bullets: [
        t("comingSoonCTraderBullet1", {
          fallback: "Adapted for cTrader execution flow",
        }),
        t("comingSoonCTraderBullet2", {
          fallback: "Institutional-feeling UI and order handling",
        }),
        t("comingSoonCTraderBullet3", {
          fallback: "Same premium strategy language, different terminal",
        }),
      ],
      surfaceLabel: t("comingSoonCTraderSurface", { fallback: "cTrader build" }),
      accent: "platform",
      glyph: "vault",
    },
  ];
}

export function buildContactOffers(t: Translate): ContactOffer[] {
  return [
    {
      title: t("customAccessCard1Title", { fallback: "Lifetime Access" }),
      description: t("customAccessCard1Copy", {
        fallback:
          "For traders who want permanent GoldBot access without listing a mass-market lifetime price on the page.",
      }),
      bullets: [
        t("customAccessCard1Bullet1", {
          fallback: "Private quote based on access scope",
        }),
        t("customAccessCard1Bullet2", {
          fallback: "Best suited for long-horizon buyers",
        }),
        t("customAccessCard1Bullet3", {
          fallback: "Handled through direct team contact",
        }),
      ],
      cta: t("contactUs", { fallback: "Contact Us" }),
      accent: "concierge",
      glyph: "halo",
    },
    {
      title: t("customAccessCard2Title", { fallback: "Source Code Licensing" }),
      description: t("customAccessCard2Copy", {
        fallback:
          "For buyers, partners, or firms who need source-code rights, private licensing terms, or broader commercial scope.",
      }),
      bullets: [
        t("customAccessCard2Bullet1", {
          fallback: "Custom licensing conversations",
        }),
        t("customAccessCard2Bullet2", {
          fallback: "Rebranding and usage-scope discussion",
        }),
        t("customAccessCard2Bullet3", {
          fallback: "Quoted privately rather than publicly",
        }),
      ],
      cta: t("contactUs", { fallback: "Contact Us" }),
      accent: "licensing",
      glyph: "vault",
    },
    {
      title: t("customAccessCard3Title", { fallback: "Private Deployment" }),
      description: t("customAccessCard3Copy", {
        fallback:
          "For higher-touch buyers who want onboarding, rollout planning, or a more tailored GoldBot deployment path.",
      }),
      bullets: [
        t("customAccessCard3Bullet1", {
          fallback: "Direct setup and rollout guidance",
        }),
        t("customAccessCard3Bullet2", {
          fallback: "Private support-led delivery path",
        }),
        t("customAccessCard3Bullet3", {
          fallback: "Built for premium contact-first deals",
        }),
      ],
      cta: t("contactUs", { fallback: "Contact Us" }),
      accent: "deployment",
      glyph: "signal",
    },
  ];
}

export function buildPassPlans(t: Translate): PricingShowcasePlan[] {
  return [
    {
      id: "free-trial",
      title: t("freeTrialTitle", { fallback: "Free Trial" }),
      price: PRICING_TIERS["free-trial"].priceString,
      period: t("for3days", { fallback: "for 3 days" }),
      note: t("shortHandsOn", { fallback: "Short hands-on test" }),
      features: [
        t("basicFeatureSet"),
        t("standardRecovery"),
        t("automatedDelivery"),
      ],
    },
  ];
}
