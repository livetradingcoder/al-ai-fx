import { getLiveGiveaway } from "@/lib/giveaway";
import { ToolInputError, type JsonObject, type McpServer, type McpTool } from "@/lib/mcp-server";
import { prisma } from "@/lib/prisma";
import {
  buildSegmentRows,
  countSegments,
  isSegmentKey,
  isTestEmail,
  LIST_SEGMENTS,
  loadTrialProspects,
  PAID_TIERS,
  SEGMENT_LABELS,
  TRIAL_SEGMENTS,
  type SegmentKey,
} from "@/lib/segments";

// The tools behind /api/mcp: the same email lists as the admin "Email lists"
// card, so an assistant can read who is where in the trial journey and copy
// them into the email tool. Read only: nothing here sends mail or changes a row.

const ALL_SEGMENTS: SegmentKey[] = [...TRIAL_SEGMENTS, ...LIST_SEGMENTS];

export const EXPORT_DEFAULT_LIMIT = 500;
export const EXPORT_MAX_LIMIT = 1000;

const GIVEAWAY_REF = /^[a-z0-9-]{1,64}$/i;

export type ExportArgs = {
  journey: SegmentKey;
  includeLinks: boolean;
  giveaway: string | null;
  limit: number;
  offset: number;
};

function intArg(value: unknown, name: string, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ToolInputError(`${name} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

/** Checks export_journey's arguments. Throws ToolInputError with a message the model can act on. */
export function parseExportArgs(args: JsonObject): ExportArgs {
  const journey = args.journey;
  if (typeof journey !== "string" || !isSegmentKey(journey)) {
    throw new ToolInputError(`journey must be one of: ${ALL_SEGMENTS.join(", ")}.`);
  }
  if (args.include_links !== undefined && typeof args.include_links !== "boolean") {
    throw new ToolInputError("include_links must be true or false.");
  }
  const includeLinks = args.include_links === true;
  if (includeLinks && !(TRIAL_SEGMENTS as readonly string[]).includes(journey)) {
    throw new ToolInputError("include_links only applies to the trial journeys; giveaway lists have no links.");
  }

  let giveaway: string | null = null;
  if (args.giveaway !== undefined && args.giveaway !== null) {
    if (journey !== "giveaway-entries") throw new ToolInputError("giveaway only applies to the giveaway-entries journey.");
    if (typeof args.giveaway !== "string" || !GIVEAWAY_REF.test(args.giveaway)) {
      throw new ToolInputError("giveaway must be a giveaway id or slug.");
    }
    giveaway = args.giveaway;
  }

  return {
    journey,
    includeLinks,
    giveaway,
    limit: intArg(args.limit, "limit", EXPORT_DEFAULT_LIMIT, 1, EXPORT_MAX_LIMIT),
    offset: intArg(args.offset, "offset", 0, 0, 1_000_000),
  };
}

async function listJourneys() {
  const counts = await countSegments();
  return {
    journeys: ALL_SEGMENTS.map((key) => ({ journey: key, label: SEGMENT_LABELS[key], people: counts[key] })),
    left_out: "Staff, blocked or deleted accounts, people who opted out of our emails, people who already bought, and test addresses.",
  };
}

async function exportJourney(args: JsonObject) {
  const { journey, includeLinks, giveaway, limit, offset } = parseExportArgs(args);

  let giveawayId: string | null = null;
  if (giveaway) {
    const found = await prisma.giveaway.findFirst({
      where: { OR: [{ id: giveaway }, { slug: giveaway.toLowerCase() }] },
      select: { id: true },
    });
    if (!found) throw new ToolInputError(`No giveaway with id or slug "${giveaway}".`);
    giveawayId = found.id;
  }

  const { columns, rows } = await buildSegmentRows(journey, { giveawayId, includeLinks });
  const page = rows.slice(offset, offset + limit);
  const next = offset + page.length < rows.length ? offset + page.length : null;
  return {
    journey,
    label: SEGMENT_LABELS[journey],
    total: rows.length,
    offset,
    returned: page.length,
    next_offset: next,
    columns,
    rows: page,
    ...(includeLinks
      ? {
          links_warning:
            "setup_link and tutorial_link sign the person straight into their account for 7 days. Use each only in that person's own email.",
        }
      : {}),
  };
}

async function journeyOverview() {
  const now = new Date();
  const [counts, prospects, buyers, proofsByStatus, proofSenders, onWall, sharesByStatus, codesUsed, live] = await Promise.all([
    countSegments(now),
    loadTrialProspects(now),
    prisma.user.findMany({
      where: {
        role: "USER",
        isDeleted: false,
        AND: [
          { subscriptions: { some: { tier: "FREE_TRIAL" } } },
          { subscriptions: { some: { tier: { in: [...PAID_TIERS] } } } },
        ],
      },
      select: { email: true },
    }),
    prisma.resultProof.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.resultProof.findMany({ distinct: ["userId"], select: { userId: true } }),
    prisma.resultProof.count({ where: { publishedAt: { not: null } } }),
    prisma.shareProof.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.shareProof.count({ where: { coupon: { is: { redeemedCount: { gt: 0 } } } } }),
    getLiveGiveaway(now),
  ]);

  const byStatus = (groups: { status: string; _count: { _all: number } }[]) =>
    Object.fromEntries(["PENDING", "APPROVED", "REJECTED"].map((s) => [s.toLowerCase(), groups.find((g) => g.status === s)?._count._all ?? 0]));

  const [entries, optedInEntries] = live
    ? await Promise.all([
        prisma.giveawayEntry.count({ where: { giveawayId: live.id } }),
        prisma.giveawayEntry.count({ where: { giveawayId: live.id, marketingOptIn: true } }),
      ])
    : [0, 0];

  const linked = prospects.filter((p) => p.cls.linked).length;
  return {
    as_of: now.toISOString(),
    trial_users_not_bought_yet: {
      total: prospects.length,
      trial_running: prospects.filter((p) => !p.cls.expired).length,
      trial_ended: prospects.filter((p) => p.cls.expired).length,
      mt5_linked: linked,
      mt5_not_linked: prospects.length - linked,
    },
    trial_users_who_bought: buyers.filter((b) => !isTestEmail(b.email)).length,
    results_screenshots: {
      people_who_sent_one: proofSenders.length,
      ...byStatus(proofsByStatus),
      on_public_wall: onWall,
    },
    social_shares: { ...byStatus(sharesByStatus), reward_codes_used: codesUsed },
    live_giveaway: live
      ? { id: live.id, slug: live.slug, title: live.title, prize: live.prize, ends_at: live.endsAt.toISOString(), entries, opted_in_to_email: optedInEntries }
      : null,
    journeys: ALL_SEGMENTS.map((key) => ({ journey: key, label: SEGMENT_LABELS[key], people: counts[key] })),
    note: "Screenshot and share counts include every account; the journeys leave out staff, opted-out, blocked and test addresses.",
  };
}

const journeyList = ALL_SEGMENTS.map((key) => `${key} (${SEGMENT_LABELS[key]})`).join("; ");

export const JOURNEY_TOOLS: McpTool[] = [
  {
    name: "list_journeys",
    title: "List customer journeys",
    description:
      "Every email list (journey) with how many people are on it right now. Same lists and counts as the admin Email lists card.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: listJourneys,
  },
  {
    name: "export_journey",
    title: "Export a journey's people",
    description:
      `The people on one journey, ready to add to an email tool. Journeys: ${journeyList}. ` +
      "Trial rows: email, first_name, country, signup_date, trial_expires_at, days_left, mt5_linked, promo_eligible. " +
      "Set include_links only when the email uses setup_link, tutorial_link or portal_link: the first two sign the person in for 7 days. " +
      `Returns up to ${EXPORT_DEFAULT_LIMIT} rows by default; follow next_offset for more.`,
    inputSchema: {
      type: "object",
      properties: {
        journey: { type: "string", enum: ALL_SEGMENTS, description: "Which list." },
        include_links: {
          type: "boolean",
          default: false,
          description: "Add the personal setup_link, tutorial_link and portal_link columns (trial journeys only).",
        },
        giveaway: { type: "string", description: "giveaway-entries only: a giveaway id or slug. Leave out for every giveaway." },
        limit: { type: "integer", minimum: 1, maximum: EXPORT_MAX_LIMIT, default: EXPORT_DEFAULT_LIMIT },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
      required: ["journey"],
      additionalProperties: false,
    },
    run: exportJourney,
  },
  {
    name: "journey_overview",
    title: "Trial funnel overview",
    description:
      "Funnel numbers for monitoring: trial users running/ended and linked/not linked, trial users who bought, results screenshots and social shares by review status, reward codes used, the live giveaway's entries, and every journey's size.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: journeyOverview,
  },
];

export const JOURNEY_SERVER: McpServer = {
  name: "al-ai-fx",
  version: "1.0.0",
  instructions:
    "Read-only view of AL AI FX (GoldBot) customers grouped by where they are in the free-trial journey. " +
    "Start with journey_overview or list_journeys. export_journey returns the people on one list for adding to an email tool such as Sequenzy: " +
    "email is the address, first_name the first name, and the other columns fit as custom attributes. " +
    "Rows are personal data: use them for that job only and do not print whole lists back unless asked. " +
    "Ask for include_links only when the email needs a personal link; setup_link and tutorial_link log the person in for 7 days, so they belong only in that person's own email. " +
    "Nothing here sends email or changes data.",
  tools: JOURNEY_TOOLS,
  onToolCall: (name, args, outcome) => {
    // Arguments are list names and paging, never personal data.
    console.info(`[mcp] ${name} ${outcome} ${JSON.stringify(args).slice(0, 200)}`);
  },
};
