/**
 * Single source of truth for compiler pipeline timing constants.
 *
 * Values were tuned against real MQL5 compile times (10-30s typical) and
 * the daemon's 10s poll interval. Adjust here; do not inline elsewhere.
 *
 * @see .planning/phases/01-restore-compile-delivery/1-RESEARCH.md
 */

// Heartbeat freshness — used by /api/admin/compiler-status + reaper's alert path.
// Daemon posts a heartbeat on every /poll (roughly every 10s).
export const HEARTBEAT_STALE_SECONDS = 90;   // > 3 missed polls => "stale" (yellow)
export const HEARTBEAT_DEAD_SECONDS = 300;   // > 5 min => "red" + admin email alert

// Reaper — a Compilation stuck in PROCESSING past this many minutes with no
// terminal state (COMPLETED/FAILED) is re-queued or failed.
export const STUCK_JOB_MINUTES = 10;

// Bounded retry — how many total attempts before the reaper (or /complete's
// FAILED path) transitions the row to permanent FAILED. Counter is `attemptCount`
// on the Compilation row; incremented on each requeue.
export const MAX_ATTEMPTS = 3;

// Client-side polling budget — LicenseManager.tsx uses these to cap its
// setTimeout loop and transition to a TIMED_OUT UI state on the frontend.
// Together they must exceed STUCK_JOB_MINUTES * MAX_ATTEMPTS with margin so
// the client never gives up before the reaper has finished its retries, but
// don't loop forever if something upstream is stuck.
export const CLIENT_POLL_INITIAL_MS = 5_000;
export const CLIENT_POLL_MAX_MS = 30_000;
export const CLIENT_POLL_TIMEOUT_MS = 5 * 60_000; // 5 minutes wall clock
