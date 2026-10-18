import { FLAGSHIP_ROBOT } from "@/config/pricing";
import { formatUsd, type PlanSlug, type PricingCatalog } from "@/lib/pricing-catalog";
import { loadPricingCatalog } from "@/lib/pricing-data";
import en from "@/messages/en.json";

// The prices and trial terms that prose quotes (FAQ, tutorials, llms.txt,
// article sidebars), worked out from the same catalog the pricing section and
// checkout use. Copy that mentions a price takes it from here instead of
// carrying its own number, so it can't drift from what is charged.

const LANDING = en.Landing;

const PLAN_LABEL: Record<PlanSlug, { title: string; period: string }> = {
  "10-days": { title: LANDING["10DaysTitle"], period: LANDING.for10Days },
  "1-month": { title: LANDING.monthlyTitle, period: LANDING.perMonth },
  "6-months": { title: LANDING.biannualTitle, period: LANDING.per6Months },
  "1-year": { title: LANDING["1YearTitle"], period: LANDING.for1Year },
};

export interface PricingFacts {
  /** Who has which trial, e.g. "Gold MultiRange 4 has a 7-day trial for $1.99 and PrecisionTrader has a 3-day trial for $0.99." */
  trialsSentence: string;
  /** Why the trial costs money and the rule that goes with it. Empty when no trial is paid. */
  trialFeeNote: string;
  /** The whole answer to "is there a free trial?": a lead-in, who has which trial, and the fee note. */
  trialAnswer: string;
  hasFreeTrial: boolean;
  hasPaidTrial: boolean;
  /** "$0.99": the least a buyer pays to try a robot, or null when no robot sells a paid trial. */
  cheapestPaidTrial: string | null;
  /** The flagship's plans as sentences-in-pieces, for the pricing article. Null when it isn't on sale. */
  flagship: { name: string; plans: { title: string; price: string; period: string; tier: PlanSlug }[] } | null;
}

const NO_NUMBERS: PricingFacts = {
  trialsSentence: "Robots can have a short trial; the price is on each robot's page and at checkout.",
  trialFeeNote: "",
  trialAnswer: "Robots can have a short trial; the price is on each robot's page and at checkout.",
  hasFreeTrial: false,
  hasPaidTrial: false,
  cheapestPaidTrial: null,
  flagship: null,
};

const join = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

export function buildPricingFacts(catalog: PricingCatalog | null): PricingFacts {
  if (!catalog) return NO_NUMBERS;

  const withTrial = catalog.robots.filter((r) => r.trial);
  const paid = withTrial.filter((r) => !r.trial!.free);
  const free = withTrial.filter((r) => r.trial!.free);

  const sentences = [
    // Paid trials first, flagship ahead of the rest: that is the order a reader meets the robots in.
    ...[...paid]
      .sort((a, b) => Number(b.flagship) - Number(a.flagship))
      .map((r) => `${r.name} has a ${r.trial!.days}-day trial for ${formatUsd(r.trial!.amount)}`),
    ...free.map((r) => `${r.name} has a ${r.trial!.days}-day free trial with no card`),
  ];

  const flagship = catalog.robots.find((r) => r.slug === FLAGSHIP_ROBOT.slug);

  const trialsSentence = sentences.length ? `${join(sentences)}.` : "No robot has a trial on offer right now.";
  const trialFeeNote = paid.length
    ? "The small fee goes towards maintenance costs and is paid at checkout like any plan. Each account can take one trial per robot."
    : "";
  const lead = free.length ? "Yes." : paid.length ? "Not free, but cheap." : "";

  return {
    trialsSentence,
    trialFeeNote,
    trialAnswer: [lead, trialsSentence, trialFeeNote].filter(Boolean).join(" "),
    hasFreeTrial: free.length > 0,
    hasPaidTrial: paid.length > 0,
    cheapestPaidTrial: paid.length ? formatUsd(Math.min(...paid.map((r) => r.trial!.amount))) : null,
    flagship: flagship
      ? {
          name: flagship.name,
          plans: flagship.plans.map((p) => ({
            tier: p.tier,
            title: PLAN_LABEL[p.tier].title,
            price: formatUsd(p.amount),
            period: PLAN_LABEL[p.tier].period,
          })),
        }
      : null,
  };
}

export async function loadPricingFacts(): Promise<PricingFacts> {
  return buildPricingFacts(await loadPricingCatalog());
}
