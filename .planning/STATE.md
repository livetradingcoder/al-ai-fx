# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** A paying user receives their chosen, compiled, MT5-account-locked robot within minutes of checkout — automatically, every time.
**Current focus:** Phase 1 — Restore Compile Delivery

## Current Position

Phase: 1 of 7 (Restore Compile Delivery)
Plan: 1 of 4 in current phase
Status: In progress
Last activity: 2026-07-04 — Completed 01-01-schema-and-config-PLAN.md

Progress: [█░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 4% (1/28 plans across all phases; 1/4 in Phase 1)

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 2m 21s
- Total execution time: 2m 21s

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Restore Compile Delivery | 1/4 | 2m 21s | 2m 21s |

**Recent Trend:**
- Last 5 plans: 01-01 (2m 21s)
- Trend: — (need more data)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Compile-server recovery ships before multi-robot work (the offline server is the #1 launch blocker; nothing else matters if delivery doesn't work).
- Roadmap: Pricing tier drift + webhook fail-open ship in Phase 2 (before real revenue), not deferred.
- Roadmap: Multi-robot schema (Phase 3) lands before any catalog UX or pipeline threading — one dependency source of truth for Phases 4–7.
- Project: Test users may be wiped on schema changes; no data migration burden.
- 01-01: `attemptCount`/`attemptedAt` naming locked (not `attempts`/`startedAt`) for the whole Phase 1 compiler pipeline.
- 01-01: `WorkerHeartbeat.id` is a plain String @id (no default) — singleton row keyed `"compiler"` for the entire compile daemon fleet (one worker for now).
- 01-01: `db push` (not `migrate dev`) is the Phase 1 stopgap; formal migrations arrive in Phase 3.
- 01-01: Timing thresholds live in `src/lib/compiler-config.ts` as named `export const`s — never inline in poll/complete/reaper/LicenseManager code.

### Pending Todos

None yet.

### Blockers/Concerns

- **Windows compile server is currently offline** — resolved as part of Phase 1 (CMPL-01/CMPL-02). Until it is back online and health-checked, no user can receive a compiled `.ex5`.
- **`prisma/migrations/` directory is not in the repo** — surfaced by codebase mapper. Phase 3 must decide migration strategy (checked-in migrations vs. continued `db push`) before schema changes land.
- **External Windows worker parser strictness unknown** — Phase 4 extends the `/api/compiler/poll` response; plan may need to version the endpoint to avoid breaking the worker on unknown fields.

## Session Continuity

Last session: 2026-07-04
Stopped at: Completed 01-01-schema-and-config-PLAN.md; Phase 1 Wave 2 (Plans 02 + 03) can now run in parallel
Resume file: `.planning/phases/01-restore-compile-delivery/01-02-direct-blob-worker-PLAN.md` or `.planning/phases/01-restore-compile-delivery/01-03-heartbeat-atomic-reaper-PLAN.md`
