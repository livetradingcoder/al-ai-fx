import { prisma } from "@/lib/prisma";
import { isPromoBlockedCountry } from "@/lib/promo-eligibility";
import { buildDashboardMagicLink } from "@/lib/magic-links";
import { buildProofPortalUrl } from "@/lib/proof-token";

// Lists of people to email, exported as CSV for the email tool (Sequenzy). The
// app does not send these campaigns itself, so this is where "who should get
// which email" is decided - in one place, with tests.
//
// Who is never listed: admins, blocked or deleted accounts, people who used the
// unsubscribe link in our optional emails, people who already bought, internal
// test tiers and test addresses.

export const TRIAL_SEGMENTS = [
  "not-linked-active",
  "not-linked-expired",
  "linked-active",
  "linked-expired",
  "linked-no-proof",
  "proof-approved-no-share",
] as const;
export type TrialSegment = (typeof TRIAL_SEGMENTS)[number];

export const LIST_SEGMENTS = ["giveaway-subscribers", "giveaway-entries"] as const;
export type ListSegment = (typeof LIST_SEGMENTS)[number];

export type SegmentKey = TrialSegment | ListSegment;

export function isSegmentKey(value: string): value is SegmentKey {
  return (TRIAL_SEGMENTS as readonly string[]).includes(value) || (LIST_SEGMENTS as readonly string[]).includes(value);
}

export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  "not-linked-active": "Trial running, MT5 not linked",
  "not-linked-expired": "Trial ended, MT5 never linked",
  "linked-active": "Trial running, MT5 linked",
  "linked-expired": "Trial ended, MT5 linked",
  "linked-no-proof": "MT5 linked, no results sent",
  "proof-approved-no-share": "Results approved, not shared yet",
  "giveaway-subscribers": "Giveaway sign-ups who opted in to email",
  "giveaway-entries": "Everyone who entered the giveaway",
};

const PAID_OR_INTERNAL = new Set(["TEN_DAYS", "ONE_MONTH", "SIX_MONTHS", "ONE_YEAR", "LIFETIME", "LIFETIME_SOURCE", "SECRET_TEST_TIER"]);
const PAID = new Set(["TEN_DAYS", "ONE_MONTH", "SIX_MONTHS", "ONE_YEAR", "LIFETIME", "LIFETIME_SOURCE"]);

/** Addresses used for testing: plus-tagged "test" addresses and the reserved example domains. */
export function isTestEmail(email: string): boolean {
  return /\+[a-z0-9]*test[a-z0-9]*@/i.test(email) || /@example\.(com|org|net)$/i.test(email);
}

/** Who may appear in any list at all: customers only, never staff, blocked or opted-out people, or test addresses. */
export function isListable(user: {
  email: string;
  role: string;
  isBlocked: boolean;
  isDeleted: boolean;
  optedOut: boolean;
}): boolean {
  return user.role === "USER" && !user.isBlocked && !user.isDeleted && !user.optedOut && !isTestEmail(user.email);
}

export type TrialUserInput = {
  subscriptions: { tier: string; mt5AccountNumber: string | null; expiresAt: Date | null }[];
  proofStatuses: string[];
  shareStatus: string | null;
};

export type TrialUserClass = {
  /** On a free trial and has not bought anything. Only these are ever listed. */
  prospect: boolean;
  linked: boolean;
  expiresAt: Date | null;
  expired: boolean;
  segments: TrialSegment[];
};

export function classifyTrialUser(input: TrialUserInput, now: Date = new Date()): TrialUserClass {
  const trials = input.subscriptions.filter((s) => s.tier === "FREE_TRIAL");
  const converted = input.subscriptions.some((s) => PAID.has(s.tier));
  const internal = input.subscriptions.some((s) => s.tier === "SECRET_TEST_TIER");
  const prospect = trials.length > 0 && !converted && !internal;

  const linked = input.subscriptions.some((s) => !!s.mt5AccountNumber?.trim() && !PAID_OR_INTERNAL.has(s.tier));
  // The trial that matters is the latest one to end.
  const expiresAt = trials.reduce<Date | null>(
    (latest, s) => (s.expiresAt && (!latest || s.expiresAt > latest) ? s.expiresAt : latest),
    null,
  );
  const expired = expiresAt !== null && expiresAt.getTime() <= now.getTime();

  const segments: TrialSegment[] = [];
  if (prospect) {
    if (!linked) segments.push(expired ? "not-linked-expired" : "not-linked-active");
    if (linked) segments.push(expired ? "linked-expired" : "linked-active");
    if (linked && input.proofStatuses.length === 0) segments.push("linked-no-proof");
    if (input.proofStatuses.includes("APPROVED") && (input.shareStatus === null || input.shareStatus === "REJECTED")) {
      segments.push("proof-approved-no-share");
    }
  }
  return { prospect, linked, expiresAt, expired, segments };
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV cell. Quoted when needed, and neutered if a spreadsheet would run it as a formula. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

const TRIAL_COLUMNS = [
  "email",
  "first_name",
  "country",
  "signup_date",
  "trial_expires_at",
  "days_left",
  "mt5_linked",
  "setup_link",
  "tutorial_link",
  "portal_link",
  "promo_eligible",
];

function firstName(name: string | null, email: string): string {
  const raw = (name || email.split("@")[0]).split(/[\s._+-]/)[0] ?? "";
  const cleaned = raw.replace(/[^\p{L}]/gu, "");
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() : "there";
}

function isoDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export type SegmentCsv = { filename: string; csv: string; count: number };

export async function buildSegmentCsv(
  segment: SegmentKey,
  options: { giveawayId?: string | null } = {},
): Promise<SegmentCsv> {
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${segment}-${stamp}.csv`;

  if (segment === "giveaway-subscribers") {
    const subs = await prisma.emailSubscriber.findMany({
      where: { source: { startsWith: "giveaway:" }, unsubscribedAt: null },
      orderBy: { createdAt: "desc" },
      select: { email: true, source: true, locale: true, createdAt: true },
    });
    const rows = subs
      .filter((s) => !isTestEmail(s.email))
      .map((s) => ({ email: s.email, source: s.source, locale: s.locale ?? "", signup_date: isoDate(s.createdAt) }));
    return { filename, csv: toCsv(["email", "source", "locale", "signup_date"], rows), count: rows.length };
  }

  if (segment === "giveaway-entries") {
    const entries = await prisma.giveawayEntry.findMany({
      where: options.giveawayId ? { giveawayId: options.giveawayId } : {},
      orderBy: { createdAt: "asc" },
      select: { email: true, source: true, bonusEntries: true, marketingOptIn: true, country: true, locale: true, createdAt: true },
    });
    const rows = entries.map((e) => ({
      email: e.email,
      source: e.source,
      chances: 1 + e.bonusEntries,
      marketing_opt_in: e.marketingOptIn ? "yes" : "no",
      country: e.country ?? "",
      locale: e.locale ?? "",
      entered_at: e.createdAt.toISOString(),
    }));
    return {
      filename,
      csv: toCsv(["email", "source", "chances", "marketing_opt_in", "country", "locale", "entered_at"], rows),
      count: rows.length,
    };
  }

  const now = new Date();
  const users = await prisma.user.findMany({
    where: {
      role: "USER",
      isBlocked: false,
      isDeleted: false,
      reminderOptOut: null,
      subscriptions: { some: { tier: "FREE_TRIAL" } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      subscriptions: { select: { id: true, tier: true, mt5AccountNumber: true, expiresAt: true } },
      resultProofs: { select: { status: true } },
      shareProof: { select: { status: true } },
      ips: { orderBy: { lastSeenAt: "desc" }, take: 1, select: { country: true } },
    },
  });

  const rows: Record<string, unknown>[] = [];
  for (const u of users) {
    if (isTestEmail(u.email)) continue;
    const cls = classifyTrialUser(
      {
        subscriptions: u.subscriptions,
        proofStatuses: u.resultProofs.map((p) => p.status),
        shareStatus: u.shareProof?.status ?? null,
      },
      now,
    );
    if (!cls.segments.includes(segment as TrialSegment)) continue;

    const trial = u.subscriptions.find((s) => s.tier === "FREE_TRIAL")!;
    const country = u.ips[0]?.country ?? null;
    const daysLeft = cls.expiresAt ? Math.ceil((cls.expiresAt.getTime() - now.getTime()) / 86_400_000) : "";
    rows.push({
      email: u.email,
      first_name: firstName(u.name, u.email),
      country: country ?? "",
      signup_date: isoDate(u.createdAt),
      trial_expires_at: cls.expiresAt ? cls.expiresAt.toISOString() : "",
      days_left: typeof daysLeft === "number" ? Math.max(0, daysLeft) : "",
      mt5_linked: cls.linked ? "yes" : "no",
      setup_link: buildDashboardMagicLink(
        { email: u.email, userId: u.id },
        { expiresIn: "7d", callbackUrl: "/dashboard/onboarding" },
      ),
      // Signs them in and opens the "link your MT5 account" video tutorial.
      tutorial_link: buildDashboardMagicLink(
        { email: u.email, userId: u.id },
        { expiresIn: "7d", callbackUrl: "/tutorials/link-mt5-account" },
      ),
      portal_link: buildProofPortalUrl({ userId: u.id, subscriptionId: trial.id }),
      promo_eligible: isPromoBlockedCountry(country) ? "no" : "yes",
    });
  }

  return { filename, csv: toCsv(TRIAL_COLUMNS, rows), count: rows.length };
}
