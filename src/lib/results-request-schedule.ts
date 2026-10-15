import { DAY_MS } from "@/lib/mt5-reminder-schedule";

// Who is asked "how is it going, share your results", and when. Pure: no
// database, no clock, no mail. src/lib/results-requests.ts feeds it rows and
// acts on the answer.
//
// Everyone is asked once, after their first build has been ready for a few
// days: long enough to have something to report, and only while the licence
// is still running, so this stays a note to a current customer.

/** Days a build must have been ready before the person is asked. */
export const MIN_DAYS_WITH_ROBOT = 3;

/** A licence whose request bounced this many times is left alone. */
export const RESULTS_MAX_FAILURES = 3;

/** Per run, so a backlog of existing customers drains over several days instead of landing at once. */
export const RESULTS_MAX_PER_RUN = 25;

export type ResultsCandidate = {
  subscriptionId: string;
  userId: string;
  email: string;
  tier: string;
  robotName: string;
  /** When the first build for this licence was ready. */
  firstBuildAt: Date;
  expiresAt: Date | null;
  /** Earlier attempts to send this person's request that bounced. */
  failures: number;
};

export type PlannedResultsRequest = {
  candidate: ResultsCandidate;
  /** Whole days since the first build was ready. */
  daysWithRobot: number;
};

export function daysWithRobot(firstBuildAt: Date, now: Date): number {
  return Math.floor((now.getTime() - firstBuildAt.getTime()) / DAY_MS);
}

/**
 * The requests to send on this run: one per person (for the licence they have
 * had longest), longest-waiting first, capped.
 */
export function planResultsRequests(
  candidates: readonly ResultsCandidate[],
  now: Date,
  max: number = RESULTS_MAX_PER_RUN,
): PlannedResultsRequest[] {
  const longestPerUser = new Map<string, ResultsCandidate>();

  for (const candidate of candidates) {
    if (candidate.tier === "SECRET_TEST_TIER") continue; // internal tier, never a customer
    if (candidate.expiresAt && candidate.expiresAt.getTime() <= now.getTime()) continue;
    if (candidate.failures >= RESULTS_MAX_FAILURES) continue;
    if (daysWithRobot(candidate.firstBuildAt, now) < MIN_DAYS_WITH_ROBOT) continue;

    const current = longestPerUser.get(candidate.userId);
    if (!current || candidate.firstBuildAt.getTime() < current.firstBuildAt.getTime()) {
      longestPerUser.set(candidate.userId, candidate);
    }
  }

  return [...longestPerUser.values()]
    .sort(
      (a, b) =>
        a.firstBuildAt.getTime() - b.firstBuildAt.getTime() || a.subscriptionId.localeCompare(b.subscriptionId),
    )
    .slice(0, Math.max(0, max))
    .map((candidate) => ({ candidate, daysWithRobot: daysWithRobot(candidate.firstBuildAt, now) }));
}
