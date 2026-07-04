# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** A paying user receives their chosen, compiled, MT5-account-locked robot within minutes of checkout — automatically, every time.
**Current focus:** Phase 1 — Restore Compile Delivery

## Current Position

Phase: 1 of 7 (Restore Compile Delivery)
Plan: 3 of 4 in current phase
Status: In progress (Wave 2 complete; only Plan 01-04 remains in Phase 1)
Last activity: 2026-07-04 — Completed 01-03-heartbeat-atomic-reaper-PLAN.md (parallel with 01-02)

Progress: [███░░░░░░░░░░░░░░░░░░░░░░░░░] 11% (3/28 plans across all phases; 3/4 in Phase 1)

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 6m 28s
- Total execution time: 19m 24s

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Restore Compile Delivery | 3/4 | 19m 24s | 6m 28s |

**Recent Trend:**
- Last 5 plans: 01-01 (2m 21s), 01-02 (8m 30s), 01-03 (8m 33s)
- Trend: ↑ (Wave 2 plans larger — real infra work — but well under phase budgets)

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
- 01-03: Atomic dequeue via Postgres `FOR UPDATE SKIP LOCKED` inside `prisma.$transaction` using `$queryRaw` (Prisma issue #5983 — no native SKIP LOCKED support). Standard pattern for any future queue in this DB.
- 01-03: Hobby-plan-safe cron: second NSSM service `al-ai-fx-reaper` on the same VM as `al-ai-fx-daemon`, independent lifetime; Pro-upgrade path is a one-line `vercel.json` crons entry + `nssm stop`.
- 01-03: Reaper `attemptedAt = null` on requeue-to-PENDING so the cutoff scan does not immediately re-match the row on the next tick.
- 01-03: Heartbeat upsert is best-effort (try/catch, non-fatal) — job dequeue matters more than observability.

### Pending Todos

None yet.

### Blockers/Concerns

- **Windows compile server** — RESOLVED by Wave 2. `al-ai-fx-daemon` (from 01-02) uploads directly to Blob; `al-ai-fx-reaper` (from 01-03) auto-heals stuck rows every 60s. End-to-end retry loop validated live during 01-02.
- **`prisma/migrations/` directory is not in the repo** — Phase 3 must decide migration strategy before schema changes land.
- **External Windows worker parser strictness (Phase 4)** — Plan 01-03 confirmed the additive-only response contract works: `attemptCount` was added to `/poll` response with the daemon still parsing correctly (reads via `?? 0` fallback). Future extensions to `/poll` should stay strictly additive or version the endpoint.
- **Vercel Hobby plan** — external NSSM reaper is the compensating pattern. If/when upgrading to Pro, add `vercel.json` crons entry and `nssm stop al-ai-fx-reaper` (no code change).

## Session Continuity

Last session: 2026-07-04
Stopped at: Completed 01-03-heartbeat-atomic-reaper-PLAN.md (in parallel with 01-02). Phase 1 Wave 2 complete; only Wave 3 (Plan 01-04 admin visibility + client cap) remains in Phase 1.
Resume file: `.planning/phases/01-restore-compile-delivery/01-04-admin-visibility-client-cap-PLAN.md`
