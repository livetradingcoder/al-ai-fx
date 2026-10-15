// Who is owed a "link your MT5 account" reminder, and which one. Pure: no
// database, no clock, no mail. src/lib/mt5-reminders.ts feeds it rows and
// acts on the answer, which keeps every rule below testable on its own.

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export type ReminderKind = "trial" | "paid";

/**
 * Hours after a licence is created at which reminder 1, 2, 3 ... become due.
 * A trial lasts three days, so its second reminder lands a day before it ends.
 */
export const REMINDER_HOURS: Record<ReminderKind, readonly number[]> = {
  trial: [12, 48],
  paid: [24, 72, 168],
};

/** The most reminders any licence can get; the database filters on this. */
export const MAX_STAGES = Math.max(...Object.values(REMINDER_HOURS).map((hours) => hours.length));

/** A licence this old without a linked account is better reached by a person than by another automated email. */
export const MAX_AGE_DAYS = 30;

/** Never two reminders to the same person closer together than this. */
export const MIN_GAP_HOURS = 20;

/** A licence whose reminder bounced this many times is left alone. */
export const MAX_FAILURES = 3;

/** Per run, so a backlog drains over several hours instead of landing at once. */
export const MAX_PER_RUN = 25;

export type ReminderCandidate = {
  subscriptionId: string;
  userId: string;
  email: string;
  tier: string;
  robotName: string;
  createdAt: Date;
  expiresAt: Date | null;
  /** Number of the last reminder delivered for this licence; 0 when none. */
  sent: number;
  failures: number;
  /** When that last reminder went out; null when none has. */
  lastSentAt: Date | null;
};

export type PlanContext = {
  /** When each person last got a reminder, for any of their licences. */
  lastReminderAtByUser: ReadonlyMap<string, Date>;
};

export type PlannedReminder = {
  candidate: ReminderCandidate;
  kind: ReminderKind;
  /** 1-based number of the reminder to send. */
  stage: number;
};

export function reminderKind(tier: string): ReminderKind | null {
  if (tier === "FREE_TRIAL") return "trial";
  if (tier === "SECRET_TEST_TIER") return null; // internal tier, never a customer
  return "paid";
}

/** How many of this kind's reminders have come due since the licence was created. */
export function dueStage(kind: ReminderKind, createdAt: Date, now: Date): number {
  const ageMs = now.getTime() - createdAt.getTime();
  return REMINDER_HOURS[kind].filter((hours) => ageMs >= hours * HOUR_MS).length;
}

/**
 * The reminders to send on this run.
 *
 * A licence gets the latest reminder that is due, never a burst: one that was
 * never reminded and is already 60 hours old jumps straight to its second
 * reminder instead of receiving both. Each person gets at most one email per
 * run, for the licence that matters most (a paid one over a trial), and none
 * if they were reminded recently. The most urgent - the soonest to expire -
 * go first when the cap bites.
 */
export function planReminders(
  candidates: readonly ReminderCandidate[],
  context: PlanContext,
  now: Date,
  max: number = MAX_PER_RUN,
): PlannedReminder[] {
  const due: PlannedReminder[] = [];

  for (const candidate of candidates) {
    const kind = reminderKind(candidate.tier);
    if (!kind) continue;
    if (candidate.expiresAt && candidate.expiresAt.getTime() <= now.getTime()) continue;
    if (now.getTime() - candidate.createdAt.getTime() > MAX_AGE_DAYS * DAY_MS) continue;
    if (candidate.failures >= MAX_FAILURES) continue;

    const stage = dueStage(kind, candidate.createdAt, now);
    if (stage <= candidate.sent) continue;

    const last = context.lastReminderAtByUser.get(candidate.userId);
    if (last && now.getTime() - last.getTime() < MIN_GAP_HOURS * HOUR_MS) continue;

    due.push({ candidate, kind, stage });
  }

  // One email per person: a paid licence outranks a trial, then the newer one.
  const bestPerUser = new Map<string, PlannedReminder>();
  for (const plan of due) {
    const current = bestPerUser.get(plan.candidate.userId);
    if (!current || outranks(plan, current)) bestPerUser.set(plan.candidate.userId, plan);
  }

  return [...bestPerUser.values()].sort(byUrgency).slice(0, Math.max(0, max));
}

function outranks(a: PlannedReminder, b: PlannedReminder): boolean {
  if (a.kind !== b.kind) return a.kind === "paid";
  return a.candidate.createdAt.getTime() > b.candidate.createdAt.getTime();
}

function byUrgency(a: PlannedReminder, b: PlannedReminder): number {
  const aExpires = a.candidate.expiresAt?.getTime() ?? Infinity;
  const bExpires = b.candidate.expiresAt?.getTime() ?? Infinity;
  if (aExpires !== bExpires) return aExpires < bExpires ? -1 : 1;
  const aCreated = a.candidate.createdAt.getTime();
  const bCreated = b.candidate.createdAt.getTime();
  if (aCreated !== bCreated) return aCreated - bCreated;
  return a.candidate.subscriptionId.localeCompare(b.candidate.subscriptionId);
}

/** k***@gmail.com - enough to recognise a row in a dry run without printing the list. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}
