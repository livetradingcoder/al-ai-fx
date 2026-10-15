import { Prisma } from "@prisma/client";

import { sendClaimed } from "@/lib/email-campaign";
import { DAY_MS, maskEmail } from "@/lib/mt5-reminder-schedule";
import { prisma } from "@/lib/prisma";
import {
  MIN_DAYS_WITH_ROBOT,
  RESULTS_MAX_FAILURES,
  RESULTS_MAX_PER_RUN,
  planResultsRequests,
  type PlannedResultsRequest,
  type ResultsCandidate,
} from "@/lib/results-request-schedule";

// "How is it going, share your results": once a customer's first build has
// been ready for a few days, they get one email asking for their results.
// Run daily from the /api/cron/results-requests route. The rules (who, and
// when) live in results-request-schedule.ts; this file reads the database,
// hands the answer to a delivery function, and records what happened.
//
// As with the setup reminders, each send is claimed in the database BEFORE it
// goes out and handed back if the send fails, so overlapping runs never ask
// the same person twice, and a crash between claim and send loses one email
// rather than duplicating it.

/** Sends one request. Resolves false when nothing was sent (mail not configured). Throws if the provider refuses. */
export type ResultsRequestDelivery = (plan: PlannedResultsRequest) => Promise<boolean>;

export type ResultsPreview = {
  subscriptionId: string;
  email: string;
  robot: string;
  tier: string;
  daysWithRobot: number;
  expiresAt: string | null;
};

export type ResultsRunResult = {
  dryRun: boolean;
  /** Licences that passed the database filters. */
  considered: number;
  /** People owed a request right now, before the per-run cap. */
  due: number;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  aborted: boolean;
  /** Dry runs only: who would be asked, with addresses masked. */
  preview?: ResultsPreview[];
};

const CANDIDATE_LIMIT = 500;

export async function runResultsRequests(options: {
  deliver: ResultsRequestDelivery;
  dryRun?: boolean;
  now?: Date;
  max?: number;
}): Promise<ResultsRunResult> {
  const now = options.now ?? new Date();
  const max = options.max ?? RESULTS_MAX_PER_RUN;
  const dryRun = options.dryRun ?? false;

  const candidates = await loadCandidates(now);
  const due = planResultsRequests(candidates, now, Number.POSITIVE_INFINITY);
  const batch = due.slice(0, max);

  const result: ResultsRunResult = {
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
      tier: plan.candidate.tier,
      daysWithRobot: plan.daysWithRobot,
      expiresAt: plan.candidate.expiresAt?.toISOString() ?? null,
    }));
    return result;
  }

  const tally = await sendClaimed(batch, {
    claim: (plan) => claim(plan, now),
    release: (plan, countFailure) => release(plan, countFailure, now),
    deliver: options.deliver,
    describe: (plan) => `results request sub=${plan.candidate.subscriptionId}`,
  });
  Object.assign(result, tally);

  console.log(
    `[Results] considered=${result.considered} due=${result.due} attempted=${result.attempted} ` +
      `sent=${result.sent} failed=${result.failed} skipped=${result.skipped} aborted=${result.aborted}`,
  );
  return result;
}

async function loadCandidates(now: Date): Promise<ResultsCandidate[]> {
  const rows = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      tier: { not: "SECRET_TEST_TIER" },
      AND: [
        // Linked: they have given us an account to build for.
        { mt5AccountNumber: { not: null } },
        { mt5AccountNumber: { not: "" } },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
      // A finished build that has been ready for at least the minimum.
      compilations: {
        some: { status: "COMPLETED", createdAt: { lte: new Date(now.getTime() - MIN_DAYS_WITH_ROBOT * DAY_MS) } },
      },
      user: {
        role: "USER",
        isBlocked: false,
        isDeleted: false,
        reminderOptOut: null,
        // Not asked yet, or an earlier attempt was handed back and may be retried.
        OR: [{ resultsRequest: null }, { resultsRequest: { sentAt: null, failures: { lt: RESULTS_MAX_FAILURES } } }],
      },
    },
    select: {
      id: true,
      userId: true,
      tier: true,
      expiresAt: true,
      robot: { select: { name: true } },
      user: { select: { email: true, resultsRequest: { select: { failures: true } } } },
      compilations: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: CANDIDATE_LIMIT,
  });

  return rows.flatMap((row) => {
    const firstBuild = row.compilations[0];
    if (!firstBuild) return [];
    return [
      {
        subscriptionId: row.id,
        userId: row.userId,
        email: row.user.email,
        tier: row.tier,
        robotName: row.robot.name,
        firstBuildAt: firstBuild.createdAt,
        expiresAt: row.expiresAt,
        failures: row.user.resultsRequest?.failures ?? 0,
      },
    ];
  });
}

/** Marks the person as asked so no other run asks them too. False when someone else already has. */
async function claim(plan: PlannedResultsRequest, now: Date): Promise<boolean> {
  const { userId, subscriptionId } = plan.candidate;

  // An earlier attempt that was handed back leaves a row with sentAt null.
  const updated = await prisma.resultsRequest.updateMany({
    where: { userId, sentAt: null },
    data: { sentAt: now, subscriptionId },
  });
  if (updated.count === 1) return true;

  try {
    await prisma.resultsRequest.create({ data: { userId, subscriptionId, sentAt: now } });
    return true;
  } catch (err) {
    // Unique: they were asked, or another run is asking them. Foreign key: the account was deleted meanwhile.
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2002" || err.code === "P2003")) {
      return false;
    }
    throw err;
  }
}

/** Puts a claimed request back after a failed send so the next run tries again. */
async function release(plan: PlannedResultsRequest, countFailure: boolean, claimedAt: Date): Promise<void> {
  const { userId } = plan.candidate;
  try {
    await prisma.resultsRequest.updateMany({
      where: { userId, sentAt: claimedAt },
      data: { sentAt: null, ...(countFailure ? { failures: { increment: 1 } } : {}) },
    });
  } catch (err) {
    // The person stays marked as asked: lost, not duplicated.
    console.error(`[Results] could not release user=${userId}:`, err);
  }
}
