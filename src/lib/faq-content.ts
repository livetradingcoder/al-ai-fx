import type { FaqCategory, FaqItem } from "@/app/[locale]/faq/FaqBrowser";
import { PROP_FIRM } from "@/config/links";
import type { PricingFacts } from "@/lib/pricing-facts";

// FAQ content shared by the FAQ page and /llms-full.txt.

export const CATEGORIES: FaqCategory[] = [
  { id: "start", label: "Getting started" },
  { id: "licence", label: "Licences & accounts" },
  { id: "billing", label: "Billing & refunds" },
  { id: "trading", label: "Trading & risk" },
];

// English-only additions. Every answer restates something the site already
// says (landing, checkout, catalog, refund policy, disclaimer) — nothing here
// is a new promise. Other locales show only the translated questions until
// these are added to the message files.
//
// The trial answer is the one that quotes prices, so it is built from the live
// catalog (PricingFacts) rather than carrying numbers of its own.
export function buildExtraFaq(facts: PricingFacts): FaqItem[] {
  return EXTRA_EN_TEMPLATE.map((item) =>
    item.id === "trial"
      ? {
          ...item,
          a: `${facts.trialAnswer} A trial can only be linked to an MT5 account that has never been used with a GoldBot licence, free or paid.`,
        }
      : item,
  );
}

const EXTRA_EN_TEMPLATE: FaqItem[] = [
  {
    id: "requirements",
    category: "start",
    q: "What do I need before I buy?",
    a: "A MetaTrader 5 account with your preferred broker. GoldBot cannot be installed on MT4 or other trading platforms, and your broker time must be set to GMT+3 for licence locking.",
  },
  {
    id: "mobile",
    category: "start",
    q: "Does GoldBot work on Android, iPhone or tablets?",
    a: "No. GoldBot is an Expert Advisor for the desktop MetaTrader 5 terminal, which runs on Windows, ideally on a VPS. The MT5 mobile apps can't run Expert Advisors, but you can sign in to the same account in the app to watch your positions and trade history while the EA runs on your PC or VPS.",
    link: { href: "/guides/install-ea-on-mt5", label: "Read the install guide" },
  },
  {
    id: "speed",
    category: "start",
    q: "How quickly is my robot ready?",
    a: "Your dashboard access is created as soon as checkout completes. Once you enter your MT5 account number, your personalised build compiles in under 15 seconds, and installing it in MT5 takes a couple of minutes.",
  },
  {
    id: "which-robot",
    category: "start",
    q: "Which robot should I choose?",
    a: "MultiRange robots trade several gold session ranges a day; Breakout robots trade one. Compare them side by side in the catalog, or start with a trial.",
    link: { href: "/catalog", label: "Browse the catalog" },
  },
  {
    id: "lifetime",
    category: "licence",
    q: "Can I get lifetime access or the source code?",
    a: "Yes. Lifetime and lifetime-plus-source licences are arranged directly rather than through checkout.",
    link: { href: "/licensing", label: "See licensing options" },
  },
  {
    id: "trial",
    category: "billing",
    q: "Is there a free trial?",
    a: "", // filled in by buildExtraFaq
  },
  {
    id: "payment",
    category: "billing",
    q: "How do I pay?",
    a: "Checkout hands you to Paygate.to, which securely processes your crypto or fiat payment. Your licence is created automatically once the payment clears.",
  },
  {
    id: "renewal",
    category: "billing",
    q: "Do plans renew automatically?",
    a: "Plans auto-renew unless cancelled. Lifetime passes are a one-time payment.",
  },
  {
    id: "refunds",
    category: "billing",
    q: "What is the refund policy?",
    a: "If the EA hits a stop loss within the first 14 calendar days after purchase, the robot price is refunded in full. Send your purchase email, order details and MT5 proof of the stop loss within that window. Other requests are reviewed case by case.",
    link: { href: "/refund-policy", label: "Read the refund policy" },
  },
  {
    id: "holidays",
    category: "trading",
    q: "Does GoldBot trade on bank holidays?",
    a: "No. UK, US, DE, FR and IT holiday conditions are screened automatically so the EA stays away from thin, distorted sessions.",
  },
  {
    id: "prop-firm-account",
    category: "trading",
    q: "Where can I get a prop firm account?",
    a: `${PROP_FIRM.name} is our partner prop firm: create an account with ${PROP_FIRM.discount} off using the code ${PROP_FIRM.code}, or go straight to its checkout for the ${PROP_FIRM.challenge}, listed at ${PROP_FIRM.price}. The firm sets its own prices and terms and can change them, and every prop firm sets its own rules on EAs, so read them before you attach a robot to one of its accounts.`,
    link: { href: PROP_FIRM.checkoutUrl, label: `Buy the ${PROP_FIRM.challenge} (listed at ${PROP_FIRM.price})` },
  },
  {
    id: "guarantee",
    category: "trading",
    q: "Are profits guaranteed?",
    a: "No. Trading leveraged products such as gold carries a high level of risk, and past performance does not guarantee future results. Only trade with capital you can afford to lose.",
    link: { href: "/disclaimer", label: "Read the disclaimer" },
  },
];
