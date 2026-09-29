import { prisma } from "@/lib/prisma";
import { getSettings, getTiers } from "@/lib/affiliate";
import { CATALOG_PUBLIC_TIERS } from "@/lib/catalog-tiers";
import { FLAGSHIP_ROBOT } from "@/config/pricing";
import { EXTRA_EN } from "@/lib/faq-content";
import { CONTENT_PAGES } from "@/lib/content-pages";
import { SITE_URL } from "@/lib/seo";
import en from "@/messages/en.json";

// /llms.txt and /llms-full.txt (https://llmstxt.org): a plain-text briefing
// for AI assistants and answer engines. Built from the live catalog and the
// same copy the site shows, so it never states anything the site doesn't.

const url = (path: string) => new URL(path, SITE_URL).toString();

const TIER_LABEL: Record<string, string> = {
  FREE_TRIAL: "3-day free trial",
  TEN_DAYS: "10 days",
  ONE_MONTH: "1 month",
  SIX_MONTHS: "6 months",
  ONE_YEAR: "1 year",
};

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

async function loadCatalog() {
  try {
    const robots = await prisma.robot.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { prices: { where: { active: true, tier: { in: CATALOG_PUBLIC_TIERS } } } },
    });
    return robots.map((robot) => ({
      slug: robot.slug,
      name: robot.name,
      short: robot.shortDescription,
      long: robot.longDescription,
      badge: robot.badge,
      comingSoon: robot.prices.length === 0,
      prices: CATALOG_PUBLIC_TIERS.map((tier) => robot.prices.find((p) => p.tier === tier))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => ({ label: TIER_LABEL[p.tier] ?? p.tier, amount: p.amount })),
    }));
  } catch {
    return [];
  }
}

const SUMMARY =
  "GoldBot by AL-ai-FX is a family of automated gold (XAUUSD) trading robots — Expert Advisors — " +
  "for MetaTrader 5. The robots trade gold session breakouts with a structured hedge for false breaks, " +
  "skip bank-holiday sessions, and are delivered as a compiled .ex5 locked to the buyer's own MT5 account " +
  "number, built in the cloud within seconds of the buyer entering that account.";

const KEY_PAGES = [
  ["Home", "/", "Product overview, verified member results and pricing"],
  ["Features", "/features", "Adaptive recovery, liquidity guard, private builds, setup flow and comparison with public EAs"],
  ["Robot catalog", "/catalog", "Every robot on sale, with prices"],
  ["FAQ", "/faq", "Requirements, licensing, billing, refunds and risk"],
  ["Affiliate programme", "/affiliates", "Recurring commission for referrals"],
  ["Licensing", "/licensing", "Lifetime, source-code and private licences"],
  ["Roadmap", "/roadmap", "Robots and platforms in development"],
] as const;

const POLICY_PAGES = [
  ["Refund policy", "/refund-policy"],
  ["Trading disclaimer", "/disclaimer"],
  ["Terms and conditions", "/terms-conditions"],
  ["Privacy policy", "/privacy-policy"],
  ["Support", "/support"],
] as const;

export async function buildLlmsTxt() {
  const robots = await loadCatalog();
  const live = robots.filter((r) => !r.comingSoon);

  const lines = [
    "# GoldBot by AL-ai-FX",
    "",
    `> ${SUMMARY}`,
    "",
    "Important: trading leveraged products such as gold carries a high level of risk; past performance does not guarantee future results, and GoldBot makes no profit guarantees.",
    "",
    "## Key pages",
    ...KEY_PAGES.map(([name, path, note]) => `- [${name}](${url(path)}): ${note}`),
    "",
    "## Robots",
    ...live.map((r) => `- [${r.name}](${url(`/robots/${r.slug}`)}): ${r.short}`),
    "",
    "## Guides",
    ...CONTENT_PAGES.map((p) => `- [${p.h1}](${url(p.path)}): ${p.description}`),
    "",
    "## Policies and support",
    ...POLICY_PAGES.map(([name, path]) => `- [${name}](${url(path)})`),
    "",
    "## Optional",
    `- [Full product briefing](${url("/llms-full.txt")}): plans, prices, delivery, refunds, affiliate terms and FAQ in one document`,
    "",
  ];
  return lines.join("\n");
}

export async function buildLlmsFullTxt() {
  const [robots, settings, tiers] = await Promise.all([
    loadCatalog(),
    getSettings().catch(() => null),
    getTiers().catch(() => []),
  ]);
  const live = robots.filter((r) => !r.comingSoon);
  const soon = robots.filter((r) => r.comingSoon);
  const faq = en.FAQ as Record<string, string>;
  const landing = en.Landing as Record<string, string>;

  const sections: string[] = [];
  const push = (...lines: string[]) => sections.push(...lines);

  push(
    "# GoldBot by AL-ai-FX — full product briefing",
    "",
    `> ${SUMMARY}`,
    "",
    `Website: ${SITE_URL}`,
    "Support: support@AL-ai-FX.com",
    "",
    "## What GoldBot is",
    "",
    "- Platform: MetaTrader 5 only. GoldBot cannot be installed on MT4 or other trading platforms.",
    "- Market: gold (XAUUSD).",
    "- Requirement: a MetaTrader 5 account with the buyer's preferred broker; broker time must be set to GMT+3 for licence locking.",
    `- Strategy: ${landing.adaptiveRecoveryBody}`,
    `- Liquidity guard: ${landing.liquidityGuardBody}`,
    `- Private build: ${landing.privateBuildBody}`,
    `- Flagship robot: ${FLAGSHIP_ROBOT.name}.`,
    "",
    "## How delivery works",
    "",
    ...[1, 2, 3, 4, 5].map((n) => `${n}. ${landing[`flow${n}Title`]} — ${landing[`flow${n}Copy`]} (${landing[`flow${n}Eta`]})`),
    "",
    "## Robots and prices (USD)",
    "",
  );

  for (const r of live) {
    push(
      `### ${r.name}`,
      "",
      `URL: ${url(`/robots/${r.slug}`)}`,
      ...(r.badge ? [`Label: ${r.badge}`] : []),
      "",
      r.long,
      "",
      `Plans: ${r.prices.map((p) => `${p.label} ${p.amount === 0 ? "free" : usd(p.amount)}`).join("; ")}`,
      "",
    );
  }

  if (soon.length) {
    push("## Coming soon", "", ...soon.map((r) => `- ${r.name}: ${r.short}`), "");
  }

  push(
    "## Billing",
    "",
    "- Payment: checkout hands the buyer to Paygate.to, which processes crypto or fiat payments.",
    "- Renewal: plans auto-renew unless cancelled. Lifetime passes are a one-time payment.",
    "- Free trial: a 3-day trial activates instantly with no card; availability can be limited per visitor.",
    `- Lifetime access, source code and private deals: arranged directly — ${url("/licensing")}.`,
    "",
    "## Refund policy",
    "",
    "If the EA hits a stop loss within the first 14 calendar days after purchase, the robot price is refunded in full, provided the purchase email, order details and MT5 proof of the stop loss are submitted within that window. Other requests are reviewed case by case.",
    `Details: ${url("/refund-policy")}`,
    "",
  );

  if (settings) {
    const rates = tiers.length ? tiers.map((t) => `${t.name} ${t.rate}%`).join(", ") : `${settings.defaultRate}%`;
    push(
      "## Affiliate programme",
      "",
      `- Commission tiers: ${rates}, by ${settings.tierBasis === "VOLUME" ? "total commission earned" : "number of referrals who bought"}.`,
      `- ${settings.lifetimeScope ? "Commission is paid on every order a referral places, including renewals." : "Commission is paid on a referral's first order."}`,
      `- Referred buyers get ${settings.referredDiscount}% off their first licence.`,
      `- Attribution: ${settings.cookieDays}-day link window, permanent once the referral creates an account.`,
      `- Payouts: commission clears after a ${settings.holdDays}-day hold; minimum payout $${settings.minPayout}.`,
      `- Join: ${url("/affiliates")}`,
      "",
    );
  }

  push(
    "## Frequently asked questions",
    "",
    ...[1, 2, 3, 4].flatMap((n) => [`### ${faq[`q${n}`]}`, "", faq[`a${n}`], ""]),
    ...EXTRA_EN.flatMap((item) => [`### ${item.q}`, "", item.a, ""]),
    "## Risk disclaimer",
    "",
    "Trading leveraged products such as gold (XAUUSD) carries a high level of risk and may not be suitable for all investors. Past performance does not guarantee future results. GoldBot makes no guarantee of profit. Only trade with capital you can afford to lose.",
    `Full disclaimer: ${url("/disclaimer")}`,
    "",
    "MetaTrader is a trademark of MetaQuotes Ltd. GoldBot is a trademark of AL-ai-FX.",
    "",
  );

  return sections.join("\n");
}
