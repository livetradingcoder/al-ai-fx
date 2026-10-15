// Search-intent pages: the landing pages and guides people reach from Google.
//
// Every statement here restates something the product already documents —
// robot descriptions, the setup tutorials, the refund policy, the FAQ. No
// performance claims, no promises about third-party prop-firm rules. If the
// product changes, update this file alongside it.

export type Block =
  | { type: "h2"; id: string; text: string }
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "callout"; tone: "info" | "warn"; title: string; text: string }
  | { type: "robots"; filter?: "prop-firm" }
  | { type: "table"; head: [string, string, string]; rows: [string, string, string][] };

export type ContentPage = {
  slug: string;
  path: string;
  kind: "landing" | "guide";
  /** Browser/search title. */
  title: string;
  /** Meta description: the snippet under the title in Google. */
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  readingMinutes: number;
  updated: string; // ISO date of the last content review
  blocks: Block[];
  faq: { q: string; a: string }[];
  related: string[]; // slugs
};

const RISK =
  "Trading leveraged products such as gold carries a high level of risk. Past performance does not guarantee future results, and no EA can promise profit — only trade with capital you can afford to lose.";

export const CONTENT_PAGES: ContentPage[] = [
  // -------------------------------------------------------------------------
  {
    slug: "gold-ea-mt5",
    path: "/gold-ea-mt5",
    kind: "landing",
    title: "Gold EA for MT5 — automated XAUUSD trading robots | GoldBot",
    description:
      "GoldBot's gold EAs for MetaTrader 5 trade XAUUSD session breakouts with a structured hedge, skip bank holidays, and ship as a build locked to your MT5 account. Free trial available.",
    eyebrow: "Gold EA for MetaTrader 5",
    h1: "A gold EA for MT5 that trades XAUUSD session breakouts",
    lead:
      "GoldBot is a family of Expert Advisors built only for gold on MetaTrader 5. Each robot marks the day's session ranges, trades the first clean break, and places a structured hedge behind every trade so a false break is capped — then it ships as a build compiled for your own MT5 account.",
    readingMinutes: 4,
    updated: "2026-09-29",
    blocks: [
      { type: "h2", id: "how-it-trades", text: "How a GoldBot EA trades gold" },
      {
        type: "p",
        text: "Gold moves hardest around session opens. GoldBot robots mark a price range for a session, wait for price to break out of it, and enter on the break. Because many breakouts fail, a hedge is placed behind the primary order: if price reverses back through the range, the hedge takes the move instead of leaving the loss open.",
      },
      {
        type: "list",
        items: [
          "Built for XAUUSD only — every value is tuned for gold, not adapted from a forex template.",
          "Structured hedge behind each trade instead of martingale-style lot doubling.",
          "Bank-holiday screening for UK, US, DE, FR and IT sessions, so the EA stays out of thin, distorted markets.",
          "Strategy values are fixed in the build; you choose lot sizing, and on MultiRange robots which ranges run.",
        ],
      },
      { type: "h2", id: "choose", text: "Choose your gold robot" },
      {
        type: "p",
        text: "Breakout robots trade one session range a day. MultiRange robots trade several independent ranges, each with its own stops, targets and hedge — more coverage, and more exposure.",
      },
      { type: "robots" },
      { type: "h2", id: "account-locked", text: "Why an account-locked build matters" },
      {
        type: "p",
        text: "Marketplace EAs are usually one shared file with a licence check that calls a web server from inside the robot. GoldBot compiles a unique .ex5 for the MT5 account number you register, in under 15 seconds. The licence lives in the build itself, so there is no slow web request in the trading loop, and a copied file will not run on another account.",
      },
      { type: "h2", id: "requirements", text: "What you need" },
      {
        type: "list",
        items: [
          "A MetaTrader 5 account with your preferred broker. GoldBot cannot be installed on MT4 or other platforms.",
          "Broker server time set to GMT+3, which the licence lock relies on.",
          "Ideally a VPS, so MetaTrader runs 24/5 without interruption.",
        ],
      },
      { type: "h2", id: "get-started", text: "From checkout to a live chart" },
      {
        type: "steps",
        items: [
          { title: "Pick a robot and plan", text: "Plans run from 10 days to a year; PrecisionTrader has a 3-day free trial with no card." },
          { title: "Enter your MT5 account number", text: "Your dashboard is ready as soon as checkout completes." },
          { title: "Download your build", text: "The .ex5 is compiled for that account in under 15 seconds." },
          { title: "Attach it to XAUUSD", text: "Copy it into MQL5/Experts, refresh the Navigator and drag it onto a gold chart." },
        ],
      },
      { type: "callout", tone: "warn", title: "Trading risk", text: RISK },
    ],
    faq: [
      {
        q: "Does GoldBot work on MT4?",
        a: "No. GoldBot is built exclusively for MetaTrader 5 and cannot be installed on MT4 or other trading platforms.",
      },
      {
        q: "Is there a free trial?",
        a: "Yes. PrecisionTrader has a 3-day free trial that activates instantly with no card. Availability can be limited per visitor.",
      },
      {
        q: "Can I use one licence on several MT5 accounts?",
        a: "Each build is locked to one MT5 account number. You can change the registered account from your dashboard up to twice a month.",
      },
      {
        q: "What is the refund policy?",
        a: "If the EA hits a stop loss within the first 14 calendar days after purchase, the robot price is refunded in full, with proof from MT5. Other requests are reviewed case by case.",
      },
    ],
    related: ["prop-firm-gold-ea", "install-ea-on-mt5", "gold-session-breakout-strategy"],
  },

  // -------------------------------------------------------------------------
  {
    slug: "prop-firm-gold-ea",
    path: "/prop-firm-gold-ea",
    kind: "landing",
    title: "Prop firm gold EA for MT5 — fixed stop loss, no martingale | GoldBot",
    description:
      "Looking for a gold EA for a prop firm account? GoldBot MultiRange robots put a fixed stop loss on every trade and cap the hedge at 5× the first lot — no grid, no martingale stacking.",
    eyebrow: "Prop firm gold EA",
    h1: "A gold EA built with prop firm rules in mind",
    lead:
      "Prop firm accounts end on a single bad day, so the EA you run has to keep losses defined. GoldBot's MultiRange robots put a fixed stop loss on every trade and cap the hedge at five times the first lot — no grid, and no martingale lot doubling.",
    readingMinutes: 4,
    updated: "2026-09-29",
    blocks: [
      { type: "h2", id: "why", text: "What makes an EA unsafe on a funded account" },
      {
        type: "p",
        text: "Most failed challenges on automated gold trading come from the same design: a grid or martingale EA that adds larger and larger positions against the move with no stop. It looks smooth until one strong trend hits the daily-loss or maximum-drawdown limit in a single session.",
      },
      { type: "h2", id: "how", text: "How GoldBot MultiRange keeps risk defined" },
      {
        type: "list",
        items: [
          "Every trade carries a fixed stop loss.",
          "The hedge is capped at 5× the first lot — it cannot keep scaling.",
          "No grid, no martingale stacking.",
          "Fixed-lot or risk-percent sizing, and any session range can be switched off from the inputs.",
          "Major US, UK and EU bank holidays are skipped automatically.",
        ],
      },
      { type: "robots", filter: "prop-firm" },
      {
        type: "callout",
        tone: "info",
        title: "Always check your firm's rules",
        text: "Prop firms set their own rules on expert advisors, hedging, news trading and copy trading, and they change them. Read your firm's current EA policy before you attach any robot to a funded or challenge account.",
      },
      { type: "h2", id: "setup", text: "Setting up on a prop firm account" },
      {
        type: "steps",
        items: [
          { title: "Register the prop firm MT5 account number", text: "Your build is compiled for that exact account — use the challenge or funded account's number." },
          { title: "Size conservatively", text: "Use risk-percent sizing, and switch off ranges you don't want running to reduce how many positions can be open at once." },
          { title: "Run it on a VPS", text: "A VPS keeps MetaTrader connected 24/5, so a trade is never left without the EA managing it." },
          { title: "Move to the new account when you pass", text: "You can change the registered MT5 account from your dashboard up to twice a month." },
        ],
      },
      { type: "callout", tone: "warn", title: "Trading risk", text: RISK },
    ],
    faq: [
      {
        q: "Which GoldBot robots are suited to prop firm accounts?",
        a: "Gold MultiRange 4 and Gold MultiRange 7 put a fixed stop loss on every trade, cap the hedge at 5× the first lot, and use no grid or martingale stacking.",
      },
      {
        q: "Will GoldBot pass my challenge?",
        a: "No EA can guarantee that. GoldBot keeps each trade's risk defined, but results depend on market conditions, your sizing and your firm's rules.",
      },
      {
        q: "Can I switch the licence to my funded account after passing?",
        a: "Yes. You can change the registered MT5 account number from your dashboard up to twice a month.",
      },
    ],
    related: ["hedging-vs-martingale", "gold-ea-mt5", "install-ea-on-mt5"],
  },

  // -------------------------------------------------------------------------
  {
    slug: "install-ea-on-mt5",
    path: "/guides/install-ea-on-mt5",
    kind: "guide",
    title: "How to install an EA (.ex5) on MetaTrader 5 — step by step | GoldBot",
    description:
      "Install an Expert Advisor on MT5 in five steps: copy the .ex5 into MQL5/Experts, refresh the Navigator, attach it to a chart and enable Algo Trading — plus fixes if it doesn't appear.",
    eyebrow: "Guide",
    h1: "How to install an Expert Advisor on MetaTrader 5",
    lead:
      "Installing an EA on MT5 takes about two minutes: put the .ex5 file in the Experts folder, refresh MetaTrader, and attach the robot to a chart. This guide covers every step, the settings that stop an EA from trading, and what to check if it doesn't show up.",
    readingMinutes: 5,
    updated: "2026-09-29",
    blocks: [
      { type: "h2", id: "before", text: "Before you start" },
      {
        type: "list",
        items: [
          "MetaTrader 5 installed and logged in to the trading account the EA is for.",
          "The EA file — an .ex5 for MT5. (.ex4 files are for MT4 and will not load in MT5.)",
          "For a GoldBot build: log in to the exact MT5 account number you registered, because the build is locked to it.",
        ],
      },
      { type: "h2", id: "steps", text: "Install the EA in five steps" },
      {
        type: "steps",
        items: [
          {
            title: "Open the data folder",
            text: "In MetaTrader 5 click File → Open Data Folder. A file window opens on your terminal's data directory.",
          },
          {
            title: "Copy the .ex5 into MQL5 / Experts",
            text: "Open MQL5, then Experts, and paste the .ex5 there — directly in Experts, not in a sub-folder.",
          },
          {
            title: "Refresh the Navigator",
            text: "In the Navigator panel (Ctrl+N if hidden) right-click Expert Advisors and choose Refresh. The EA will not appear until you do.",
          },
          {
            title: "Attach it to the right chart",
            text: "Open the symbol the EA is built for — XAUUSD for GoldBot — and drag the EA from the Navigator onto the chart.",
          },
          {
            title: "Allow algorithmic trading",
            text: "In the EA's Common tab tick Allow Algo Trading, click OK, and make sure the Algo Trading button in the toolbar is switched on.",
          },
        ],
      },
      { type: "h2", id: "not-showing", text: "EA not showing up or not trading?" },
      {
        type: "list",
        items: [
          "Not in the Navigator: check the file sits directly in MQL5/Experts, then refresh or restart MetaTrader.",
          "Loaded but not trading: the Algo Trading toolbar button is off, or Allow Algo Trading is unticked in the EA's settings.",
          "Removed straight after attaching: open the Experts tab in the Toolbox (Ctrl+T) — the EA logs why it stopped.",
          "GoldBot build won't run: you are logged in to a different MT5 account from the one the build is locked to, or the broker's server time is not GMT+3.",
        ],
      },
      { type: "h2", id: "vps", text: "Keep it running: VPS vs your own computer" },
      {
        type: "p",
        text: "An EA only works while MetaTrader is open and connected. A VPS keeps the terminal running 24/5 with a stable connection, which is the recommended setup. If you run GoldBot on your own computer, start it by 07:00 CET each trading day and leave it running uninterrupted until it has traded.",
      },
      { type: "callout", tone: "warn", title: "Test before going live", text: RISK },
    ],
    faq: [
      {
        q: "Where do I put the .ex5 file in MT5?",
        a: "File → Open Data Folder, then MQL5 → Experts. Paste the .ex5 directly into the Experts folder and refresh the Navigator.",
      },
      {
        q: "Why is my EA not trading?",
        a: "Most often Algo Trading is switched off — either the toolbar button or the Allow Algo Trading box in the EA's Common tab. The Experts tab in the Toolbox shows the EA's own messages.",
      },
      {
        q: "Can I install an MT4 EA on MT5?",
        a: "No. MT4 EAs are .ex4 files and only run on MetaTrader 4; MT5 needs an .ex5 compiled for MT5.",
      },
    ],
    related: ["gold-ea-mt5", "gold-session-breakout-strategy", "prop-firm-gold-ea"],
  },

  // -------------------------------------------------------------------------
  {
    slug: "gold-session-breakout-strategy",
    path: "/guides/gold-session-breakout-strategy",
    kind: "guide",
    title: "Gold session breakout strategy explained (XAUUSD) | GoldBot",
    description:
      "How a gold session breakout strategy works: marking the session range, entering on the break, handling false breakouts with a hedge, and why one range vs many changes the risk.",
    eyebrow: "Guide",
    h1: "The gold session breakout strategy, explained",
    lead:
      "A session breakout strategy marks the high and low of a quiet trading window and enters when price breaks out of it. On gold it is popular because XAUUSD tends to move sharply as major sessions open. Here is how it works, where it fails, and how GoldBot automates it.",
    readingMinutes: 6,
    updated: "2026-09-29",
    blocks: [
      { type: "h2", id: "idea", text: "The idea in one paragraph" },
      {
        type: "p",
        text: "Before a busy session, gold often trades in a tight band as the market waits. That band — the session range — has a clear high and low. When a new session brings volume, price frequently leaves the band with momentum. A breakout strategy places an order just beyond the range and lets the move carry the trade.",
      },
      { type: "h2", id: "steps", text: "How the strategy is built" },
      {
        type: "steps",
        items: [
          { title: "Mark the range", text: "Record the high and low of a defined window — for example 07:00–10:00 broker time." },
          { title: "Add a buffer", text: "Enter slightly beyond the range so ordinary noise at the edge doesn't trigger a trade." },
          { title: "Enter on the first clean break", text: "Take the first break with a fixed stop loss and target." },
          { title: "Plan for the false break", text: "Decide in advance what happens if price breaks out and immediately reverses back through the range." },
        ],
      },
      { type: "h2", id: "false-breaks", text: "The weak spot: false breakouts" },
      {
        type: "p",
        text: "Breakouts fail regularly: price pokes through the range, triggers entries, then snaps back. Some systems ignore this and take the stop; others respond by adding bigger positions, which is how accounts blow up. GoldBot's approach is a structured hedge: an opposite order placed behind the primary trade, so if price reverses through the range the hedge takes that move, and the loss on the false break is capped rather than left running.",
      },
      {
        type: "callout",
        tone: "info",
        title: "See it on a chart",
        text: "The Features page replays this exact sequence — range, breakout, false break and hedge — on an illustrative XAUUSD chart.",
      },
      { type: "h2", id: "one-or-many", text: "One range or many?" },
      {
        type: "table",
        head: ["", "Breakout robots", "MultiRange robots"],
        rows: [
          ["Ranges per day", "One session range", "4, 6 or 7 independent ranges"],
          ["Trades", "Fewer, simpler to follow", "More trades and more exposure"],
          ["Sizing", "Lot size and hedge multiplier", "Fixed-lot or risk-percent; ranges can be switched off"],
          ["Best for", "Smaller accounts, a first robot", "Larger accounts wanting session coverage"],
        ],
      },
      { type: "h2", id: "holidays", text: "Why bank holidays matter" },
      {
        type: "p",
        text: "A breakout needs real volume behind it. On a UK, US or major EU bank holiday, liquidity is thin, spreads widen and moves are erratic — exactly the conditions where breakouts fail. GoldBot screens UK, US, DE, FR and IT holidays and stays out of those sessions.",
      },
      { type: "callout", tone: "warn", title: "Trading risk", text: RISK },
    ],
    faq: [
      {
        q: "What time does the gold session breakout happen?",
        a: "It depends on the window you choose. GoldBot's Breakout robots use 07:00–10:00 broker server time by default, and the window can be adjusted.",
      },
      {
        q: "What is a false breakout?",
        a: "Price moves beyond the session range, triggers entries, then reverses back through the range. Handling it — with a stop, or with a capped hedge — is the core risk decision in a breakout system.",
      },
    ],
    related: ["hedging-vs-martingale", "gold-ea-mt5", "install-ea-on-mt5"],
  },

  // -------------------------------------------------------------------------
  {
    slug: "hedging-vs-martingale",
    path: "/guides/hedging-vs-martingale",
    kind: "guide",
    title: "Hedging vs martingale EAs: what's the difference and why it matters | GoldBot",
    description:
      "Martingale and grid EAs double down against the move; a structured hedge caps it. Learn the difference, the risk each carries, and what to check before running any gold EA.",
    eyebrow: "Guide",
    h1: "Hedging vs martingale EAs: what's the difference?",
    lead:
      "Both approaches react when a trade goes against you — but one limits the damage and the other multiplies it. Understanding the difference is the single most useful thing to know before you run any automated gold strategy.",
    readingMinutes: 5,
    updated: "2026-09-29",
    blocks: [
      { type: "h2", id: "martingale", text: "Martingale and grid EAs" },
      {
        type: "p",
        text: "A martingale EA increases position size after each losing step — often doubling — so that a small move back recovers everything. A grid EA opens new positions at fixed distances as price moves away. Both produce smooth equity curves most of the time, because most moves do come back.",
      },
      {
        type: "list",
        items: [
          "Exposure grows geometrically: a few steps of doubling turn one lot into dozens.",
          "Positions often have no stop loss, because the system is waiting for price to return.",
          "One sustained trend can wipe out months of gains — or the whole account — in a single session.",
        ],
      },
      { type: "h2", id: "hedge", text: "A structured hedge" },
      {
        type: "p",
        text: "A structured hedge places a single opposite position behind the primary trade, sized in advance. If the market reverses, the hedge gains while the primary loses, so the loss is capped. Exposure has a known maximum instead of growing with every step against you.",
      },
      {
        type: "table",
        head: ["", "Martingale / grid", "Structured hedge (GoldBot MultiRange)"],
        rows: [
          ["Reaction to a loss", "Adds bigger positions", "One pre-sized opposite position"],
          ["Maximum exposure", "Unbounded as it keeps adding", "Hedge capped at 5× the first lot"],
          ["Stop loss", "Often none", "Fixed stop loss on every trade"],
          ["Failure mode", "Account-level wipe-out in a trend", "A defined, capped loss"],
        ],
      },
      { type: "h2", id: "checklist", text: "What to check before running any gold EA" },
      {
        type: "list",
        items: [
          "Does every trade have a fixed stop loss?",
          "Is there a hard cap on how large total exposure can get?",
          "Does it avoid bank holidays and other thin-liquidity sessions?",
          "Can you control sizing — fixed lot or a percentage of the account?",
          "Is the licence tied to your account, or is it a shared file that anyone can copy?",
        ],
      },
      { type: "callout", tone: "warn", title: "Trading risk", text: RISK },
    ],
    faq: [
      {
        q: "Is hedging allowed by prop firms?",
        a: "Rules differ between firms and change over time. Some restrict hedging or certain EA behaviours, so always read your firm's current policy before running an EA on a challenge or funded account.",
      },
      {
        q: "Does GoldBot use martingale?",
        a: "GoldBot MultiRange robots use no grid and no martingale stacking: every trade has a fixed stop loss and the hedge is capped at 5× the first lot.",
      },
    ],
    related: ["prop-firm-gold-ea", "gold-session-breakout-strategy", "gold-ea-mt5"],
  },
];

export const GUIDES = CONTENT_PAGES.filter((p) => p.kind === "guide");

export function getContentPage(slug: string) {
  return CONTENT_PAGES.find((p) => p.slug === slug);
}
