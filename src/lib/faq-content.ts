import type { FaqCategory, FaqItem } from "@/app/[locale]/faq/FaqBrowser";

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
export const EXTRA_EN: FaqItem[] = [
  {
    id: "requirements",
    category: "start",
    q: "What do I need before I buy?",
    a: "A MetaTrader 5 account with your preferred broker. GoldBot cannot be installed on MT4 or other trading platforms, and your broker time must be set to GMT+3 for licence locking.",
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
    a: "MultiRange robots trade several gold session ranges a day; Breakout robots trade one. Compare them side by side in the catalog, or start with the free trial.",
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
    a: "Yes. The 3-day trial activates instantly and needs no card. Availability can be limited per visitor, and the checkout shows whether a trial is open to you.",
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
    id: "guarantee",
    category: "trading",
    q: "Are profits guaranteed?",
    a: "No. Trading leveraged products such as gold carries a high level of risk, and past performance does not guarantee future results. Only trade with capital you can afford to lose.",
    link: { href: "/disclaimer", label: "Read the disclaimer" },
  },
];
