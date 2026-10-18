import type { CatalogFilterId } from "@/lib/catalog-filter";
import type { OgPageKey } from "@/lib/og-spec";

// Words on the share cards of the static pages, and what the catalog card says
// for each filter tab. English only: the card fonts have no glyphs for the
// other scripts, and the names on the card (GoldBot, MT5, XAUUSD) are English
// in every language anyway. Like the pages themselves, nothing here promises a
// result.

export type OgPageCopy = { eyebrow: string; title: string; subtitle: string };

export const OG_PAGE_COPY: Record<OgPageKey, OgPageCopy> = {
  features: {
    eyebrow: "Features",
    title: "How GoldBot trades gold on MT5",
    subtitle:
      "Session breakouts with structured hedging, a bank-holiday liquidity filter and a private build compiled for your account.",
  },
  guides: {
    eyebrow: "Guides",
    title: "Gold trading EA guides for MetaTrader 5",
    subtitle:
      "Installing an EA, the session breakout strategy, hedging vs martingale, and choosing an EA for a prop firm account.",
  },
  roadmap: {
    eyebrow: "Roadmap",
    title: "What we are building next",
    subtitle: "New MT5 gold robots, TradingView signals and a cTrader edition.",
  },
  licensing: {
    eyebrow: "Licensing",
    title: "Lifetime access and source-code licences",
    subtitle: "Arranged directly with the AL-ai-FX team.",
  },
  affiliates: {
    eyebrow: "Refer & earn",
    title: "Share GoldBot and earn on every order",
    subtitle: "Recurring commission on first purchases and renewals, and a discount for the people you refer.",
  },
  faq: {
    eyebrow: "Help center",
    title: "GoldBot FAQ",
    subtitle: "Answers on the MT5 EA, licensing, billing and setup.",
  },
  support: {
    eyebrow: "Support",
    title: "Talk to the GoldBot team",
    subtitle: "Help with setup, licensing and billing from AL-ai-FX.",
  },
  "privacy-policy": {
    eyebrow: "Legal",
    title: "Privacy policy",
    subtitle: "What we collect, why we collect it and how long we keep it.",
  },
  "terms-conditions": {
    eyebrow: "Legal",
    title: "Terms & conditions",
    subtitle: "Licence use, free trials, payments and liability.",
  },
  "refund-policy": {
    eyebrow: "Legal",
    title: "Refund policy",
    subtitle: "The 2-week stop-loss guarantee and how to claim it.",
  },
  disclaimer: {
    eyebrow: "Legal",
    title: "Trading disclaimer",
    subtitle: "Trading leveraged products such as gold carries a high level of risk.",
  },
};

export type OgCatalogCopy = { title: string; subtitle: string };

export const OG_CATALOG_COPY: Record<CatalogFilterId, OgCatalogCopy> = {
  all: {
    title: "MT5 gold trading robots",
    subtitle: "Compare MultiRange and Breakout expert advisors for XAUUSD, each an account-locked build.",
  },
  multirange: {
    title: "MultiRange gold robots",
    subtitle: "Several independent session ranges a day, each with its own stop, target and hedge.",
  },
  breakout: {
    title: "Breakout gold robots",
    subtitle: "One session range a day, with a structured hedge behind every trade.",
  },
  "free-trial": {
    title: "Gold robots with a trial",
    subtitle: "Try a robot first for a small fee, then pick a plan.",
  },
};
