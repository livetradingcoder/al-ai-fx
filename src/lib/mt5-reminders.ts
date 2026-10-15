import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  DAY_MS,
  HOUR_MS,
  MAX_AGE_DAYS,
  MAX_FAILURES,
  MAX_PER_RUN,
  MAX_STAGES,
  REMINDER_HOURS,
  maskEmail,
  planReminders,
  type PlannedReminder,
  type ReminderCandidate,
} from "@/lib/mt5-reminder-schedule";

// "Link your MT5 account" reminders: the people who have a licence but never
// entered an account number get a few emails, spaced out, until they do. Run
// from the /api/cron/mt5-reminders route on an hourly host cron. The rules
// (who, which reminder, how often) live in mt5-reminder-schedule.ts; this file
// reads the database, hands the answer to a delivery function, and records
// what happened.
//
// Each reminder is claimed in the database BEFORE it is sent and handed back if
// the send fails. Two overlapping runs therefore can't both send the same
// reminder, and a crash between claim and send loses one reminder rather than
// sending it twice.

/** Sends one reminder. Resolves false when nothing was sent (mail not configured). Throws if the provider refuses. */
export type ReminderDelivery = (plan: PlannedReminder) => Promise<boolean>;

export type ReminderPreview = {
  subscriptionId: string;
  email: string;
  robot: string;
  kind: string;
  stage: number;
  licenceAgeHours: number;
  expiresAt: string | null;
};

export type ReminderRunResult = {
  dryRun: boolean;
  /** Active, unlinked licences that passed the database filters. */
  considered: number;
  /** Reminders owed right now, before the per-run cap. */
  due: number;
  /** Reminders this run attempted (at most the cap). */
  attempted: number;
  sent: number;
  /** Sends the provider refused or that never reached it. */
  failed: number;
  /** Not sent: another run got there first, or mail isn't configured. */
  skipped: number;
  /** True when the run stopped early because the provider kept failing. */
  aborted: boolean;
  /** Dry runs only: what would go out, with addresses masked. */
  preview?: ReminderPreview[];
};

const CANDIDATE_LIMIT = 500;
const EARLIEST_HOURS = Math.min(...Object.values(REMINDER_HOURS).map((hours) => hours[0]));
const ABORT_AFTER_CONSECUTIVE_FAILURES = 3;

export async function runMt5Reminders(options: {
  deliver: ReminderDelivery;
  dryRun?: boolean;
  now?: Date;
  max?: number;
}): Promise<ReminderRunResult> {
  const now = options.now ?? new Date();
  const max = options.max ?? MAX_PER_RUN;
  const dryRun = options.dryRun ?? false;

  const { candidates, lastReminderAtByUser } = await loadCandidates(now);
  const due = planReminders(candidates, { lastReminderAtByUser }, now, Number.POSITIVE_INFINITY);
  const batch = due.slice(0, max);

  const result: ReminderRunResult = {
    dryRun,
    considered: candidates.length,
    due: due.length,
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    aborted: false,
  };

  if (dryRun) {
    result.preview = batch.map((plan) => ({
      subscriptionId: plan.candidate.subscriptionId,
      email: maskEmail(plan.candidate.email),
      robot: plan.candidate.robotName,
      kind: plan.kind,
      stage: plan.stage,
      licenceAgeHours: Math.floor((now.getTime() - plan.candidate.createdAt.getTime()) / HOUR_MS),
      expiresAt: plan.candidate.expiresAt?.toISOString() ?? null,
    }));
    return result;
  }

  let consecutiveFailures = 0;
  for (const plan of batch) {
    if (consecutiveFailures >= ABORT_AFTER_CONSECUTIVE_FAILURES) {
      result.aborted = true;
      break;
    }

    if (!(await claim(plan, now))) {
      result.skipped += 1;
      continue;
    }
    result.attempted += 1;

    try {
      const delivered = await options.deliver(plan);
      if (!delivered) {
        await release(plan, false);
        result.skipped += 1;
        continue;
      }
      result.sent += 1;
      consecutiveFailures = 0;
    } catch (err) {
      const recipientProblem = isRecipientProblem(err);
      await release(plan, recipientProblem);
      result.failed += 1;
      // A bad address is that address's problem; anything else (outage, bad
      // key, rate limit) is likely to hit the next one too.
      consecutiveFailures = recipientProblem ? 0 : consecutiveFailures + 1;
      console.error(
        `[Reminders] send failed sub=${plan.candidate.subscriptionId} stage=${plan.stage}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `[Reminders] considered=${result.considered} due=${result.due} attempted=${result.attempted} ` +
      `sent=${result.sent} failed=${result.failed} skipped=${result.skipped} aborted=${result.aborted}`,
  );
  return result;
}

async function loadCandidates(now: Date) {
  const rows = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      tier: { not: "SECRET_TEST_TIER" },
      createdAt: {
        gte: new Date(now.getTime() - MAX_AGE_DAYS * DAY_MS),
        lte: new Date(now.getTime() - EARLIEST_HOURS * HOUR_MS),
      },
      AND: [
        // Not linked: the dashboard treats an empty string like a missing number.
        { OR: [{ mt5AccountNumber: null }, { mt5AccountNumber: "" }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        // Still has reminders left to send.
        { OR: [{ reminder: null }, { reminder: { sent: { lt: MAX_STAGES }, failures: { lt: MAX_FAILURES } } }] },
      ],
      user: { role: "USER", isBlocked: false, isDeleted: false, reminderOptOut: null },
    },
    select: {
      id: true,
      userId: true,
      tier: true,
      createdAt: true,
      expiresAt: true,
      robot: { select: { name: true } },
      user: { select: { email: true } },
      reminder: { select: { sent: true, failures: true, lastSentAt: true } },
    },
    orderBy: { createdAt: "asc" },
    take: CANDIDATE_LIMIT,
  });

  const userIds = [...new Set(rows.map((row) => row.userId))];
  if (userIds.length === 0) {
    return { candidates: [] as ReminderCandidate[], lastReminderAtByUser: new Map<string, Date>() };
  }

  // Anyone who has ever linked an account has found their way in: they are not
  // who these reminders are for, whatever other licences they hold.
  const activated = await prisma.subscription.findMany({
    where: {
      userId: { in: userIds },
      AND: [{ mt5AccountNumber: { not: null } }, { mt5AccountNumber: { not: "" } }],
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  const activatedUsers = new Set(activated.map((row) => row.userId));

  const reminded = await prisma.mt5Reminder.findMany({
    where: { lastSentAt: { not: null }, subscription: { userId: { in: userIds } } },
    select: { lastSentAt: true, subscription: { select: { userId: true } } },
  });
  const lastReminderAtByUser = new Map<string, Date>();
  for (const row of reminded) {
    if (!row.lastSentAt) continue;
    const seen = lastReminderAtByUser.get(row.subscription.userId);
    if (!seen || row.lastSentAt > seen) lastReminderAtByUser.set(row.subscription.userId, row.lastSentAt);
  }

  const candidates: ReminderCandidate[] = rows
    .filter((row) => !activatedUsers.has(row.userId))
    .map((row) => ({
      subscriptionId: row.id,
      userId: row.userId,
      email: row.user.email,
      tier: row.tier,
      robotName: row.robot.name,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      sent: row.reminder?.sent ?? 0,
      failures: row.reminder?.failures ?? 0,
      lastSentAt: row.reminder?.lastSentAt ?? null,
    }));

  return { candidates, lastReminderAtByUser };
}

/** Marks the reminder as sent so no other run sends it too. False when someone else already did. */
async function claim(plan: PlannedReminder, now: Date): Promise<boolean> {
  const { subscriptionId, sent } = plan.candidate;

  const updated = await prisma.mt5Reminder.updateMany({
    where: { subscriptionId, sent },
    data: { sent: plan.stage, lastSentAt: now },
  });
  if (updated.count === 1) return true;

  try {
    await prisma.mt5Reminder.create({ data: { subscriptionId, sent: plan.stage, lastSentAt: now } });
    return true;
  } catch (err) {
    // Unique: another run created the row first. Foreign key: the licence was deleted meanwhile.
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2002" || err.code === "P2003")) {
      return false;
    }
    throw err;
  }
}

/** Puts a claimed reminder back after a failed send so the next run tries again. */
async function release(plan: PlannedReminder, countFailure: boolean): Promise<void> {
  const { subscriptionId, sent, lastSentAt } = plan.candidate;
  try {
    await prisma.mt5Reminder.updateMany({
      where: { subscriptionId, sent: plan.stage },
      data: {
        sent,
        lastSentAt,
        ...(countFailure ? { failures: { increment: 1 } } : {}),
      },
    });
  } catch (err) {
    // The reminder stays marked as sent: lost, not duplicated.
    console.error(`[Reminders] could not release sub=${subscriptionId}:`, err);
  }
}

/**
 * True when the provider refused this one recipient (a 4xx that is about the
 * message, not about us). Rate limits, auth and billing problems, outages and
 * network errors are not the recipient's fault and must not use up their tries.
 */
function isRecipientProblem(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status !== "number") return false;
  if (status < 400 || status >= 500) return false;
  return ![401, 402, 403, 408, 429].includes(status);
}
