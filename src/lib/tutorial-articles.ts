// Help articles listed under /tutorials. Each has an `access` level: public
// ones are readable without an account and indexed, members ones sit behind
// the login (see tutorial-access.ts).
//
// The same answers also live in the support assistant's knowledge base in
// nDesk, which is edited separately — when a policy, price or flow changes,
// change both. Everything here restates what the public pages already say
// (home pricing, FAQ, refund policy, terms, disclaimer, the guides). Prices
// come from config/pricing.ts so the article cannot disagree with the home
// page. No performance claims, no new promises.

import { FLAGSHIP_ROBOT } from "@/config/pricing";
import type { PricingFacts } from "@/lib/pricing-facts";
import type { Block } from "@/lib/content-pages";
import type { TutorialAccess } from "@/lib/tutorial-access";

/** A content block, plus the screenshots the older step-by-step tutorials use. */
export type TutorialBlock =
  | Block
  | { type: "figure"; src: string; alt: string; caption: string }
  // An unlisted YouTube video, shown click-to-load (see YouTubeEmbed).
  | { type: "youtube"; id: string; title: string; caption: string };

export type TutorialCategoryId = "start" | "setup" | "billing" | "trading";

/** Index groups, in display order. */
export const TUTORIAL_CATEGORIES: { id: TutorialCategoryId; label: string }[] = [
  { id: "start", label: "Getting started" },
  { id: "setup", label: "Setup & configuration" },
  { id: "billing", label: "Plans & billing" },
  { id: "trading", label: "Trading, risk & terms" },
];

export type TutorialArticle = {
  slug: string;
  category: TutorialCategoryId;
  /** Who may read it: no account needed, or signed-in members only. */
  access: TutorialAccess;
  title: string;
  /** One line on the index card. */
  summary: string;
  blocks: TutorialBlock[];
  /** Site pages worth opening next; hrefs are locale-less ("/catalog"). */
  links?: { label: string; href: string }[];
  /** Slugs of related articles. */
  related?: string[];
};

const RISK =
  "Trading leveraged products such as gold carries a high level of risk. Past performance does not guarantee future results, and no EA can promise profit. Only trade with capital you can afford to lose.";

// What each plan includes, in the words the pricing cards use.
const PLAN_INCLUDES = {
  "10-days": "Basic feature set, standard recovery profile, automated delivery.",
  "1-month": "Unlimited downloads, all strategy features, automated delivery.",
  "6-months": "Unlimited downloads, all strategy features, Priority Liquid Guard, automated delivery.",
  "1-year": "Unlimited downloads, all strategy features, Priority Liquid Guard, automated delivery.",
} as const;

// The flagship's plans as list lines. The prices come from the live catalog
// (PricingFacts), never from a number typed here.
function flagshipPlanLines(facts: PricingFacts): string[] {
  if (!facts.flagship) return ["Plan prices are in the Pricing section of the home page and on each robot's page."];
  return facts.flagship.plans.map(
    (plan) =>
      `${plan.title}: ${plan.price} ${plan.period}${plan.tier === "1-year" ? ", the most popular plan" : ""}. ${PLAN_INCLUDES[plan.tier]}`,
  );
}

export function buildTutorialArticles(facts: PricingFacts): TutorialArticle[] {
  return [
    {
      slug: "free-trial",
      category: "start",
      access: "public",
      title: "How do I get a trial?",
      summary: "How to start a robot's trial, what it costs and what happens next.",
      blocks: [
        { type: "h2", id: "is-there-a-free-trial", text: "Is there a trial?" },
        {
          type: "p",
          text: facts.trialAnswer,
        },
        { type: "h2", id: "how-to-start", text: "How do I start it?" },
        {
          type: "steps",
          items: [
            {
              title: "Choose the trial",
              text: "Open the Pricing section on the home page and pick the trial for the robot you want, or choose that robot in the catalog and select its trial.",
            },
            { title: "Enter your email", text: "Enter your email and pay the trial fee by card or crypto. The trial starts as soon as the payment clears." },
            {
              title: "Open your dashboard",
              text: "Open the sign-in link we email you, enter your MT5 account number in the dashboard and download your build.",
            },
            { title: "Know when it ends", text: "The trial ends after the number of days shown on its card." },
          ],
        },
              { type: "h2", id: "mt5-account-rule", text: "Why can't I link my MT5 account to the trial?" },
        {
          type: "p",
          text: "A trial can only be linked to an MT5 account that has never been used with a GoldBot licence, free or paid. If you see “This MT5 account has already been used with a GoldBot licence”, link a different MT5 account, or choose a plan to use that one. A paid plan has no such limit, so an account that had a trial can be used with a plan.",
        },
        {
          type: "p",
          text: "If you think the message is a mistake, contact support@al-ai-fx.xyz with your sign-in email and the MT5 account number.",
        },
      ],
      links: [{ label: "Browse the robots", href: "/catalog" }],
      related: ["pricing", "before-you-buy"],
    },
    {
      slug: "link-mt5-account",
      category: "setup",
      access: "members",
      title: "How do I link my MT5 account?",
      summary: "A short video and the steps to link your MT5 account and get your GoldBot build.",
      blocks: [
        {
          type: "p",
          text: "Your GoldBot build is made for one MT5 account, so the first thing to do after signing up is to tell us which account it is. It takes about a minute.",
        },
        {
          type: "youtube",
          id: "AC5MUEfv7eI",
          title: "How to link your MT5 account to GoldBot",
          caption: "Linking your MT5 account, start to finish.",
        },
        { type: "h2", id: "steps", text: "The steps" },
        {
          type: "steps",
          items: [
            {
              title: "Find your MT5 account number",
              text: "In MetaTrader 5, open the Navigator panel and expand Accounts. The number in front of your broker's name is your account number.",
            },
            {
              title: "Open the setup page",
              text: "Sign in to your dashboard and open Guided setup. The sign-in link in your email takes you there.",
            },
            {
              title: "Enter the number and save",
              text: "Type the account number and choose Save & Lock. The build is made for that account, so check the number before you save.",
            },
            {
              title: "Download your build",
              text: "It is ready in under 15 seconds. Download the .ex5 file when the dashboard says it is done.",
            },
            {
              title: "Install it in MT5",
              text: "Copy the file into MQL5/Experts, refresh the Navigator, and drag the robot onto a gold chart.",
            },
          ],
        },
        { type: "h2", id: "stuck", text: "Stuck on a step?" },
        {
          type: "p",
          text: "Reply to any email from us and tell us which step you are on and what you see. We will walk you through it. A trial can only be linked to an MT5 account that has never been used with a GoldBot licence before.",
        },
      ],
      links: [{ label: "Open guided setup", href: "/dashboard/onboarding" }],
      related: ["free-trial", "before-you-buy"],
    },
    {
      slug: "what-is-goldbot",
      category: "start",
      access: "public",
      title: "What is GoldBot and how does it trade gold?",
      summary: "What GoldBot is, how its robots trade gold, and why it is MetaTrader 5 only.",
      blocks: [
        {
          type: "p",
          text: "GoldBot is a family of Expert Advisors (EAs) built only for gold (XAUUSD) on MetaTrader 5. Each robot marks the day's session ranges, trades the first clean break, and places a structured hedge behind every trade so a false break is capped. It ships as a build compiled for your own MT5 account.",
        },
        { type: "h2", id: "how-it-trades", text: "How a GoldBot EA trades gold" },
        {
          type: "p",
          text: "Gold moves hardest around session opens. GoldBot robots mark a price range for a session, wait for price to break out of it, and enter on the break. Because many breakouts fail, a hedge is placed behind the primary order: if price reverses back through the range, the hedge takes the move instead of leaving the loss open.",
        },
        {
          type: "list",
          items: [
            "Built for XAUUSD only. Every value is tuned for gold, not adapted from a forex template.",
            "A structured hedge behind each trade instead of martingale-style lot doubling.",
            "Bank-holiday screening for UK, US, DE, FR and IT sessions, so the EA stays out of thin, distorted markets.",
            "Strategy values are fixed in the build. You choose lot sizing, and on MultiRange robots which ranges run.",
          ],
        },
        { type: "h2", id: "mt5-only", text: "Built for MetaTrader 5 only" },
        { type: "p", text: "GoldBot cannot be installed on MT4 or other trading platforms." },
        { type: "callout", tone: "warn", title: "Trading risk", text: RISK },
      ],
      links: [{ label: "Gold EA for MT5 guide", href: "/gold-ea-mt5" }],
      related: ["before-you-buy", "account-locked-build", "which-robot"],
    },
    {
      slug: "before-you-buy",
      category: "start",
      access: "public",
      title: "What do I need before I buy, and how fast is it ready?",
      summary: "What you need before you buy, and how quickly your build is ready.",
      blocks: [
        { type: "h2", id: "what-you-need", text: "What you need" },
        {
          type: "list",
          items: [
            "A MetaTrader 5 account with your preferred broker. GoldBot cannot be installed on MT4, other platforms or the MT5 mobile app.",
            "Broker server time set to GMT+3. The licence lock relies on it.",
            "Ideally a VPS, so MetaTrader runs 24/5 without interruption.",
          ],
        },
        { type: "h2", id: "how-quickly", text: "How quickly is my robot ready?" },
        {
          type: "p",
          text: "Your dashboard access is created as soon as checkout completes. Once you enter your MT5 account number, your personalised build compiles in under 15 seconds, and installing it in MT5 takes a couple of minutes.",
        },
        { type: "h2", id: "checkout-to-chart", text: "From checkout to a live chart" },
        {
          type: "steps",
          items: [
            {
              title: "Pick a robot and plan",
              text: "Plans run from 10 days to a year, and each robot has a low-cost trial to try it first.",
            },
            { title: "Enter your MT5 account number", text: "Your dashboard is ready as soon as checkout completes." },
            { title: "Download your build", text: "The .ex5 is compiled for that account in under 15 seconds." },
            {
              title: "Attach it to XAUUSD",
              text: "Copy it into MQL5/Experts, refresh the Navigator and drag it onto a gold chart.",
            },
          ],
        },
      ],
      links: [{ label: "Frequently asked questions", href: "/faq" }],
      related: ["account-locked-build", "ea-not-showing-up", "free-trial"],
    },
    {
      slug: "which-robot",
      category: "start",
      access: "public",
      title: "Which robot should I choose?",
      summary: "Breakout or MultiRange: how the robots differ and which to start with.",
      blocks: [
        {
          type: "p",
          text: "Breakout robots trade one session range a day. MultiRange robots trade several independent ranges, each with its own stops, targets and hedge: more coverage, and more exposure. Robots trading one to seven ranges are in the catalog.",
        },
        { type: "h2", id: "precisiontrader", text: "PrecisionTrader" },
        {
          type: "p",
          text: "Single-range breakout EA for gold: one session range a day, hedged, with a fixed lot you control. It has a trial: the length and price are in the Pricing section.",
        },
        { type: "h2", id: "flagship", text: `${FLAGSHIP_ROBOT.name} (flagship)` },
        {
          type: "p",
          text: "Four independent gold session ranges a day, each with its own breakout and hedge: the GoldBot engine, expanded.",
        },
        { type: "h2", id: "not-sure", text: "Not sure?" },
        { type: "p", text: "Start with a trial, or compare the robots side by side in the catalog." },
      ],
      links: [
        { label: "Browse the catalog", href: "/catalog" },
        { label: "PrecisionTrader", href: "/robots/precision-trader" },
        { label: FLAGSHIP_ROBOT.name, href: `/robots/${FLAGSHIP_ROBOT.slug}` },
      ],
      related: ["pricing", "free-trial"],
    },
    {
      slug: "pricing",
      category: "billing",
      access: "public",
      title: "How much does it cost? Plans and prices",
      summary: "Plan prices for the flagship robot, the trials, and how private deals work.",
      blocks: [
        {
          type: "p",
          text: `Every plan delivers a GoldBot build compiled for your MT5 account. The prices below are for ${FLAGSHIP_ROBOT.name}, the four-range flagship. Robots trading one to seven ranges have their own prices, shown in the catalog and on each robot's page.`,
        },
        { type: "h2", id: "flagship-plans", text: FLAGSHIP_ROBOT.name },
        {
          type: "list",
          items: [
            ...flagshipPlanLines(facts),
          ],
        },
        { type: "h2", id: "free-trial", text: "Trials" },
        {
          type: "p",
          text: `${[facts.trialsSentence, facts.trialFeeNote].filter(Boolean).join(" ")} Every trial includes the basic feature set, the standard recovery profile and automated delivery.`,
        },
        { type: "h2", id: "pay-after-trial", text: "Pay After Trial" },
        {
          type: "p",
          text: "Coming soon and not available yet. The idea is a trial where you pay only if the first 3 days close in profit; the verification behind it is still being built. There is a “Notify me when ready” button in the pricing section.",
        },
        { type: "h2", id: "private-deals", text: "Lifetime, source code or private deals" },
        { type: "p", text: "These are quoted privately and not listed publicly." },
        {
          type: "p",
          text: "All plans: account-locked build, delivered automatically after checkout, runs on MetaTrader 5.",
        },
      ],
      links: [
        { label: "Browse the catalog", href: "/catalog" },
        { label: "Licensing options", href: "/licensing" },
      ],
      related: ["free-trial", "payments-and-renewals", "lifetime-and-source-code"],
    },
    {
      slug: "payments-and-renewals",
      category: "billing",
      access: "public",
      title: "How do I pay, and do plans renew automatically?",
      summary: "Payment options, what happens after you pay, and how renewals work.",
      blocks: [
        { type: "h2", id: "how-to-pay", text: "How do I pay?" },
        {
          type: "p",
          text: "At checkout choose Pay by card or Pay with crypto. Your licence is created automatically once the payment clears.",
        },
        { type: "h2", id: "renewals", text: "Do plans renew automatically?" },
        {
          type: "p",
          text: "Plans auto-renew unless cancelled. Lifetime passes are a one-time payment. Renewal, cancellation and billing details are managed through your account and the payment provider flow.",
        },
        { type: "h2", id: "free-trial", text: "Is there a trial?" },
        { type: "p", text: facts.trialAnswer },
      ],
      links: [{ label: "Terms & conditions", href: "/terms-conditions" }],
      related: ["pricing", "refund-policy", "free-trial"],
    },
    {
      slug: "account-locked-build",
      category: "setup",
      access: "public",
      title: "How does the account-locked build work?",
      summary: "How your build is compiled for one MT5 account, and what happens when a plan ends.",
      blocks: [
        { type: "h2", id: "what-it-is", text: "What an account-locked build is" },
        {
          type: "p",
          text: "GoldBot compiles a unique .ex5 for the MT5 account number you register, in under 15 seconds. The licence lives in the build itself, so there is no slow web request in the trading loop, and a copied file will not run on another account. It is one GoldBot build per approved MT5 account (1:1 licence binding).",
        },
        { type: "h2", id: "cloud-compilation", text: "How does the cloud compilation work?" },
        {
          type: "p",
          text: "Once you purchase a subscription and enter your MT5 account number in your Dashboard, our dedicated Windows Cloud Service dynamically modifies the source code of the EA and runs the MetaEditor compiler. This ensures the output .ex5 file is unique and locked securely to your account, without lag-inducing web requests.",
        },
        { type: "h2", id: "multiple-accounts", text: "Can I use the EA on multiple accounts?" },
        {
          type: "p",
          text: "Each subscription tier typically ties to one MT5 account to prevent unauthorized distribution. However, you can change your registered MT5 Account ID from the Dashboard up to 2 times a month.",
        },
        { type: "h2", id: "expiry", text: "What happens when my subscription expires?" },
        {
          type: "p",
          text: "The EA checks its embedded expiration date locally on instantiation. Once the date passes, the EA stops opening new trades.",
        },
      ],
      links: [{ label: "Frequently asked questions", href: "/faq" }],
      related: ["before-you-buy", "ea-not-showing-up"],
    },
    {
      slug: "ea-not-showing-up",
      category: "setup",
      access: "members",
      title: "My EA isn't showing up or isn't trading: what should I check?",
      summary: "Fixes for an EA that is missing from the Navigator, not trading or removed, plus VPS advice.",
      blocks: [
        { type: "h2", id: "not-in-navigator", text: "Not in the Navigator" },
        {
          type: "p",
          text: "Check the file sits directly in MQL5/Experts, not in a sub-folder, then refresh the Navigator (right-click Expert Advisors, Refresh) or restart MetaTrader. The EA will not appear until you refresh.",
        },
        { type: "h2", id: "not-trading", text: "Loaded but not trading" },
        {
          type: "p",
          text: "The Algo Trading toolbar button is off, or “Allow Algo Trading” is unticked in the EA's Common tab. Switch both on.",
        },
        { type: "h2", id: "removed", text: "Removed straight after attaching" },
        { type: "p", text: "Open the Experts tab in the Toolbox (Ctrl+T). The EA logs why it stopped." },
        { type: "h2", id: "build-wont-run", text: "GoldBot build won't run" },
        {
          type: "p",
          text: "You are logged in to a different MT5 account from the one the build is locked to, or the broker's server time is not GMT+3. Log in to the exact account number you registered. Only .ex5 files load in MT5 (.ex4 files are for MT4).",
        },
        { type: "h2", id: "vps", text: "Keep it running: VPS or your own computer" },
        {
          type: "p",
          text: "An EA only works while MetaTrader is open and connected. A VPS keeps the terminal running 24/5 with a stable connection, which is the recommended setup. If you run GoldBot on your own computer, start it by 07:00 CET each trading day and leave it running uninterrupted until it has traded.",
        },
        {
          type: "p",
          text: "The install steps are in the tutorial “Installing the EA on MetaTrader 5”.",
        },
      ],
      links: [{ label: "Setup guides", href: "/guides" }],
      related: ["account-locked-build", "before-you-buy"],
    },
    {
      slug: "prop-firm",
      category: "trading",
      access: "public",
      title: "Can I use GoldBot on a prop firm account?",
      summary: "How MultiRange keeps risk defined, and how to set up on a challenge or funded account.",
      blocks: [
        {
          type: "p",
          text: "GoldBot's MultiRange robots are built with prop firm risk in mind: a fixed stop loss on every trade, a hedge capped at 5 times the first lot, no grid and no martingale lot doubling. Prop firms set their own rules, so always check your firm's current EA policy before attaching any robot to a funded or challenge account.",
        },
        { type: "h2", id: "risk-defined", text: "How GoldBot MultiRange keeps risk defined" },
        {
          type: "list",
          items: [
            "Every trade carries a fixed stop loss.",
            "The hedge is capped at 5× the first lot, so it cannot keep scaling.",
            "No grid, no martingale stacking.",
            "Fixed-lot or risk-percent sizing, and any session range can be switched off from the inputs.",
            "Major US, UK and EU bank holidays are skipped automatically.",
          ],
        },
        { type: "h2", id: "check-rules", text: "Always check your firm's rules" },
        {
          type: "p",
          text: "Prop firms set their own rules on expert advisors, hedging, news trading and copy trading, and they change them. Read your firm's current EA policy before you attach any robot to a funded or challenge account.",
        },
        { type: "h2", id: "setup", text: "Setting up on a prop firm account" },
        {
          type: "steps",
          items: [
            {
              title: "Register the prop firm MT5 account number",
              text: "Your build is compiled for that exact account, so use the challenge or funded account's number.",
            },
            {
              title: "Size conservatively",
              text: "Use risk-percent sizing, and switch off ranges you don't want running to reduce how many positions can be open at once.",
            },
            { title: "Run it on a VPS", text: "A trade is then never left without the EA managing it." },
            {
              title: "Move to the new account when you pass",
              text: "You can change the registered MT5 account from your dashboard. One change is included. Each change after that costs half of the plan's price.",
            },
          ],
        },
        { type: "callout", tone: "warn", title: "Trading risk", text: RISK },
      ],
      links: [{ label: "Prop firm gold EA guide", href: "/prop-firm-gold-ea" }],
      related: ["account-locked-build", "risk-disclaimer"],
    },
    {
      slug: "refund-policy",
      category: "billing",
      access: "public",
      title: "What is the refund policy?",
      summary: "The 14-day stop-loss refund guarantee and how to claim it.",
      blocks: [
        { type: "h2", id: "guarantee", text: "2-Week SL Full Refund Guarantee" },
        {
          type: "p",
          text: "If the EA gets a stop loss (SL) within the first 14 calendar days from purchase, the robot price is refunded 100%.",
        },
        { type: "h2", id: "how-to-claim", text: "How to claim" },
        {
          type: "p",
          text: "Submit your purchase email, order details, and MT5 proof of the SL event within the same 14-day window. Send them to support at support@al-ai-fx.xyz, or tell us in the chat.",
        },
        { type: "h2", id: "other-requests", text: "Other refund requests" },
        {
          type: "p",
          text: "Requests outside the 14-day SL guarantee are reviewed case by case and may be denied if terms were breached or service delivery was completed.",
        },
      ],
      links: [{ label: "Read the full refund policy", href: "/refund-policy" }],
      related: ["payments-and-renewals", "terms-of-use"],
    },
    {
      slug: "lifetime-and-source-code",
      category: "billing",
      access: "public",
      title: "Can I get lifetime access, the source code or a private deployment?",
      summary: "How to ask about lifetime access, source-code licensing or a private deployment.",
      blocks: [
        {
          type: "p",
          text: "Yes. Lifetime access, source code licensing and private deployment are arranged directly with the team rather than through checkout, and they are priced privately rather than listed publicly.",
        },
        { type: "h2", id: "what-is-offered", text: "What is offered" },
        {
          type: "list",
          items: [
            "Lifetime Access: permanent GoldBot access, quoted privately based on access scope. Best suited for long-horizon buyers.",
            "Source Code Licensing: source-code rights, private licensing terms or broader commercial scope, including rebranding and usage-scope discussion.",
            "Private Deployment: onboarding, rollout planning or a tailored GoldBot deployment path, with direct setup and rollout guidance.",
          ],
        },
        { type: "h2", id: "how-it-works", text: "How it works" },
        {
          type: "steps",
          items: [
            {
              title: "Tell us what you need",
              text: "Lifetime access, source rights, rebranding or a guided rollout. Email support@al-ai-fx.xyz with the scope, or message us in the chat.",
            },
            {
              title: "We talk it through",
              text: "Each deal is handled through direct contact with the team, not a checkout page.",
            },
            { title: "Private quote", text: "Pricing is quoted privately for your scope." },
          ],
        },
        {
          type: "p",
          text: "Just want to start trading? Standard plans are available now, with account-locked builds ready in minutes.",
        },
      ],
      links: [
        { label: "Licensing options", href: "/licensing" },
        { label: "Browse the catalog", href: "/catalog" },
      ],
      related: ["pricing", "terms-of-use"],
    },
    {
      slug: "terms-of-use",
      category: "trading",
      access: "public",
      title: "What are the terms of use?",
      summary: "A plain-language summary of the terms of use.",
      blocks: [
        { type: "h2", id: "license-use", text: "License use" },
        {
          type: "p",
          text: "Each subscription is intended for the licensed account scope defined in your plan. Unauthorized redistribution is prohibited.",
        },
        { type: "h2", id: "payments", text: "Payments" },
        {
          type: "p",
          text: "Subscriptions are billed according to the selected plan. Renewal, cancellation, and billing details are managed through your account and payment provider flow.",
        },
        { type: "h2", id: "availability", text: "Service availability" },
        {
          type: "p",
          text: "We strive to maintain continuous service but do not guarantee uninterrupted availability at all times.",
        },
        { type: "h2", id: "liability", text: "Liability" },
        {
          type: "p",
          text: "You acknowledge that trading involves financial risk, and you are solely responsible for your configuration choices and live account decisions.",
        },
      ],
      links: [{ label: "Read the full terms", href: "/terms-conditions" }],
      related: ["refund-policy", "risk-disclaimer"],
    },
    {
      slug: "risk-disclaimer",
      category: "trading",
      access: "public",
      title: "Are profits guaranteed? Risk disclaimer",
      summary: "Why no profit is guaranteed, and what the risk notice means for you.",
      blocks: [
        { type: "h2", id: "guaranteed", text: "Are profits guaranteed?" },
        {
          type: "p",
          text: "No. Trading leveraged products such as gold carries a high level of risk, and past performance does not guarantee future results. Only trade with capital you can afford to lose.",
        },
        { type: "h2", id: "risk-notice", text: "Trading risk notice" },
        {
          type: "p",
          text: "Forex and CFD trading involve substantial risk and may not be suitable for all traders. You may lose some or all capital.",
        },
        { type: "h2", id: "no-guarantee", text: "No performance guarantee" },
        {
          type: "p",
          text: "Past performance, historical examples, or user-shared outcomes do not guarantee future results. No EA can promise profit.",
        },
        { type: "h2", id: "responsibility", text: "User responsibility" },
        {
          type: "p",
          text: "You are responsible for your broker selection, account settings, risk management, and whether to run any strategy in live markets.",
        },
        { type: "h2", id: "not-advice", text: "Not financial advice" },
        {
          type: "p",
          text: "GoldBot is software tooling and does not provide financial, investment, or legal advice.",
        },
      ],
      links: [{ label: "Read the full disclaimer", href: "/disclaimer" }],
      related: ["prop-firm", "terms-of-use"],
    },
  ];
}

export function getTutorialArticle(slug: string, facts: PricingFacts): TutorialArticle | undefined {
  return buildTutorialArticles(facts).find((article) => article.slug === slug);
}

/** The articles anyone may read: the ones that are indexed and listed in the sitemap. */
export function publicTutorialArticles(articles: TutorialArticle[]): TutorialArticle[] {
  return articles.filter((article) => article.access === "public");
}

function blockWords(block: TutorialBlock): number {
  const count = (text: string) => text.split(/\s+/).filter(Boolean).length;
  switch (block.type) {
    case "h2":
    case "p":
      return count(block.text);
    case "list":
      return block.items.reduce((sum, item) => sum + count(item), 0);
    case "steps":
      return block.items.reduce((sum, item) => sum + count(item.title) + count(item.text), 0);
    case "callout":
      return count(block.title) + count(block.text);
    default:
      return 0;
  }
}

/** "2 mins read", worded like the existing tutorials' durations. */
export function readingTime(article: TutorialArticle): string {
  const words = article.blocks.reduce((sum, block) => sum + blockWords(block), 0);
  const minutes = Math.max(1, Math.round(words / 180));
  return `${minutes} ${minutes === 1 ? "min" : "mins"} read`;
}
