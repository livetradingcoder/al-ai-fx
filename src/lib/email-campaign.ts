// The send loop shared by the emails that go out from cron (the setup
// reminders in mt5-reminders.ts, the results request in results-requests.ts).
// Each campaign decides who is owed what and how a send is recorded; this is
// the part that must behave identically for all of them: claim before sending,
// hand the claim back if the send fails, and know whose fault a failure is.

/** Stop a run after this many sends in a row fail for reasons that are not the recipient's. */
export const ABORT_AFTER_CONSECUTIVE_FAILURES = 3;

/**
 * True when the provider refused this one recipient (a 4xx that is about the
 * message, not about us). Rate limits, auth and billing problems, outages and
 * network errors are not the recipient's fault and must not use up their tries.
 */
export function isRecipientProblem(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status !== "number") return false;
  if (status < 400 || status >= 500) return false;
  return ![401, 402, 403, 408, 429].includes(status);
}

export type SendTally = {
  /** Claimed and tried. */
  attempted: number;
  sent: number;
  /** Sends the provider refused or that never reached it. */
  failed: number;
  /** Not sent: another run got there first, or mail isn't configured. */
  skipped: number;
  /** True when the run stopped early because the provider kept failing. */
  aborted: boolean;
};

export async function sendClaimed<T>(
  batch: readonly T[],
  hooks: {
    /** Records the send before it happens. False when someone else already has. */
    claim: (item: T) => Promise<boolean>;
    /** Puts a claimed item back; `countFailure` is true when the recipient was at fault. */
    release: (item: T, countFailure: boolean) => Promise<void>;
    /** Sends it. Resolves false when nothing was sent (mail not configured); throws if refused. */
    deliver: (item: T) => Promise<boolean>;
    /** Identifies an item in the log without printing an address. */
    describe: (item: T) => string;
  },
): Promise<SendTally> {
  const tally: SendTally = { attempted: 0, sent: 0, failed: 0, skipped: 0, aborted: false };

  let consecutiveFailures = 0;
  for (const item of batch) {
    if (consecutiveFailures >= ABORT_AFTER_CONSECUTIVE_FAILURES) {
      tally.aborted = true;
      break;
    }

    if (!(await hooks.claim(item))) {
      tally.skipped += 1;
      continue;
    }
    tally.attempted += 1;

    try {
      const delivered = await hooks.deliver(item);
      if (!delivered) {
        await hooks.release(item, false);
        tally.skipped += 1;
        continue;
      }
      tally.sent += 1;
      consecutiveFailures = 0;
    } catch (err) {
      const recipientProblem = isRecipientProblem(err);
      await hooks.release(item, recipientProblem);
      tally.failed += 1;
      // A bad address is that address's problem; anything else (outage, bad
      // key, rate limit) is likely to hit the next one too.
      consecutiveFailures = recipientProblem ? 0 : consecutiveFailures + 1;
      console.error(`[Email] send failed ${hooks.describe(item)}:`, err instanceof Error ? err.message : err);
    }
  }

  return tally;
}
