---
phase: 01-restore-compile-delivery
plan: 01
subsystem: database
tags: [prisma, postgres, schema, config, compiler]

# Dependency graph
requires: []
provides:
  - WorkerHeartbeat singleton model (id, lastSeenAt, workerVersion) for compiler daemon health tracking
  - Compilation.attemptCount + attemptedAt + errorMessage for bounded-retry / reaper logic
  - Compilation.sha256 + sizeBytes for direct-to-Blob upload metadata
  - Compilation indexes on [status, createdAt] and [status, attemptedAt] for reaper query paths
  - src/lib/compiler-config.ts — 7 named exports (HEARTBEAT_STALE_SECONDS, HEARTBEAT_DEAD_SECONDS, STUCK_JOB_MINUTES, MAX_ATTEMPTS, CLIENT_POLL_INITIAL_MS, CLIENT_POLL_MAX_MS, CLIENT_POLL_TIMEOUT_MS)
  - Seeded WorkerHeartbeat { id: "compiler" } row (lastSeenAt = -1h) so upsert path in Plan 03 works from first poll
affects: [01-02-direct-blob-worker, 01-03-heartbeat-atomic-reaper, 01-04-admin-visibility-client-cap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source-of-truth constants module in src/lib for cross-cutting numeric thresholds"
    - "Prisma db push (not migrate dev) for Phase 1 schema deltas — migrations formalized in Phase 3"
    - "Composite indexes on (status, timestamp) columns for reaper/poll query patterns"

key-files:
  created:
    - src/lib/compiler-config.ts
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Field naming: attemptCount (not attempts), attemptedAt (not startedAt) — locked for phase"
  - "WorkerHeartbeat.id is a plain String @id (no default) — singleton row keyed 'compiler'"
  - "db push (not migrate dev) — Phase 3 will formalize migrations from a baseline"
  - "Seeded singleton with lastSeenAt = NOW() - 1h so admin dashboard reports 'red' until worker actually polls (accurate — daemon offline since 2026-04-19)"

patterns-established:
  - "Timing constants module: import { X } from '@/lib/compiler-config' — never inline thresholds"
  - "Composite index naming: {Table}_{col1}_{col2}_idx (Prisma default)"
  - "Numeric literals use _ separators (5_000 not 5000)"

# Metrics
duration: 2m 21s
completed: 2026-07-04
---

# Phase 1 Plan 01: Schema and Config Summary

**WorkerHeartbeat singleton + Compilation retry/upload fields pushed to remote Coolify Postgres, plus shared timing constants module — the infra foundation every other Phase 1 plan reads from.**

## Performance

- **Duration:** 2m 21s
- **Started:** 2026-07-04T16:39:34Z
- **Completed:** 2026-07-04T16:41:55Z
- **Tasks:** 3
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `WorkerHeartbeat` model added and pushed to remote Postgres — singleton row `id="compiler"` seeded with `lastSeenAt = NOW() - 1h` so admin status endpoint returns "red" accurately until worker resumes polling.
- `Compilation` gained five retry/upload fields (`attemptCount`, `attemptedAt`, `errorMessage`, `sha256`, `sizeBytes`) plus two composite indexes optimized for reaper query patterns.
- `src/lib/compiler-config.ts` created with all seven shared thresholds — one source of truth for reaper, poll route, complete route, admin status, and LicenseManager consumers arriving in Plans 02–04.
- Prisma client regenerated so downstream plans can `prisma.workerHeartbeat.findUnique(...)` and reference the new Compilation fields with full type safety.

## Task Commits

Each task committed atomically:

1. **Task 1: Add WorkerHeartbeat model + Compilation retry/upload fields** — `c55ccbb` (feat)
2. **Task 2: Push schema to remote Coolify Postgres + regenerate Prisma client** — no code changes; DB-only work applying Task 1's schema commit
3. **Task 3: Add src/lib/compiler-config.ts with shared threshold constants** — `13744ba` (feat)

**Plan metadata:** (to be added after this SUMMARY commit)

_Note: Task 2 is a runtime-only task (db push + seed) — no repository changes to commit. This is by design in the plan._

## Files Created/Modified

- `prisma/schema.prisma` — Added `WorkerHeartbeat` model + 5 new Compilation fields (`attemptCount`, `attemptedAt`, `errorMessage`, `sha256`, `sizeBytes`) + 2 composite indexes (`[status, createdAt]`, `[status, attemptedAt]`). `+23 -3` lines.
- `src/lib/compiler-config.ts` — New file, 31 lines, 7 named exports for compiler timing constants.

## Decisions Made

- **Task 2 has no code commit.** Task 2 is pure DB work (push Task 1's schema, regenerate client, seed singleton). It touches no repository files, so it doesn't get its own commit — the schema commit from Task 1 already captures the source of truth.
- **`prisma db execute --schema=prisma/schema.prisma`** was required (Prisma 6 CLI enforces `--url` or `--schema`); documented for future SQL execution paths in this phase.
- Followed all naming/policy decisions from the plan verbatim (`attemptCount`/`attemptedAt` naming, `db push` over `migrate dev`, singleton `id="compiler"`, `NOW() - 1h` seed, etc.).

## Deviations from Plan

None — plan executed exactly as written.

**Total deviations:** 0
**Impact on plan:** Clean execution. No auto-fixes, no architectural decisions surfaced, no auth gates.

## Issues Encountered

- `prisma db execute --stdin` initially failed with `Either --url or --schema must be provided` — Prisma 6 CLI change. Resolved by adding `--schema=prisma/schema.prisma`. Not a deviation (transient CLI ergonomics, no plan change).
- `prisma db execute` does not print SELECT results (only "Script executed successfully"), so the plan's SQL-based verify commands don't show output. Switched to `prisma.$queryRawUnsafe` via node to inspect columns/indexes and confirm the singleton row is present. All verifications passed.

## User Setup Required

None — no external service configuration required. `.env` was pre-populated by the orchestrator with `DATABASE_URL` / `POSTGRES_URL` / `PRISMA_DATABASE_URL` (all pointing at the same Prisma Postgres).

## Next Phase Readiness

**Ready:**
- Downstream Phase 1 plans (01-02, 01-03, 01-04) can now:
  - `import { HEARTBEAT_STALE_SECONDS, STUCK_JOB_MINUTES, MAX_ATTEMPTS, ... } from '@/lib/compiler-config'`
  - Query `prisma.workerHeartbeat.findUnique({ where: { id: 'compiler' } })` — singleton row exists.
  - Read/write `Compilation.attemptCount`, `attemptedAt`, `errorMessage`, `sha256`, `sizeBytes` on the remote DB.
- Plans 02 and 03 can now run in parallel (Wave 2) — this plan removed the shared-infra bottleneck.

**Blockers/concerns:**
- Windows compile daemon still offline — that's Plans 02/03. Not a schema/config blocker.
- `prisma/migrations/` still not in repo — deferred to Phase 3 per STATE.md, no immediate action.

## Self-Check: PASSED

**Files verified:**
- FOUND: `prisma/schema.prisma` (modified)
- FOUND: `src/lib/compiler-config.ts` (created)
- FOUND: `.planning/phases/01-restore-compile-delivery/01-01-SUMMARY.md` (this file)

**Commits verified:**
- FOUND: `c55ccbb` — feat(01-01): add WorkerHeartbeat model and Compilation retry/upload fields
- FOUND: `13744ba` — feat(01-01): add compiler-config with shared timing constants

**Runtime state verified:**
- FOUND: `WorkerHeartbeat` row `{ id: "compiler", lastSeenAt: "2026-07-04T15:40:49.257Z", workerVersion: null }` in remote Postgres.
- FOUND: All 5 new `Compilation` columns (`attemptCount`, `attemptedAt`, `errorMessage`, `sha256`, `sizeBytes`) reported by `information_schema.columns`.
- FOUND: Both composite indexes `Compilation_status_createdAt_idx` and `Compilation_status_attemptedAt_idx` reported by `pg_indexes`.
- FOUND: 7 named exports in `src/lib/compiler-config.ts`; `tsc --noEmit` clean.

---
*Phase: 01-restore-compile-delivery*
*Completed: 2026-07-04*
