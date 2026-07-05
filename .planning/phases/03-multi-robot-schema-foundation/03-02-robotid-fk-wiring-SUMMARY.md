---
phase: 03-multi-robot-schema-foundation
plan: 02
subsystem: multi-robot-schema
tags: [prisma, robotId, subscriptions, compilation, poll, next-api]
requirements_closed: [CTLG-04]

# Dependency graph
requires:
  - phase: 03-01-robot-model-migration-seed
    provides: "Robot catalog model + NON-NULL robotId FKs on Subscription/Compilation + seeded GoldBot (slug goldbot)"
provides:
  - "provisionSubscription resolves the goldbot Robot (findUniqueOrThrow, fail-closed) and writes robotId on every Subscription"
  - "update-mt5 creates Compilation with robotId denormalized from the parent subscription"
  - "compiler-filename.ts default slug reconciled to lowercase goldbot (matches DB Robot.slug)"
  - "poll response additively carries robotSlug for the Phase 4 compile worker; daemon contract preserved"
affects: [04-catalog-ux, 04-source-hardening, 06-multi-robot-checkout, compiler-worker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-robot resolution: GOLDBOT_SLUG constant + prisma.robot.findUniqueOrThrow (fail-closed on missing seed) as the one write-path robot lookup"
    - "robotId denormalized onto Compilation at creation (immutable), not derived by join at read time"
    - "Additive-only poll-response evolution: new field robotSlug, zero removals (daemon compatibility)"

key-files:
  created: []
  modified:
    - src/lib/subscriptions.ts
    - src/app/api/licenses/update-mt5/route.ts
    - src/app/api/compiler/poll/route.ts
    - src/lib/compiler-filename.ts

key-decisions:
  - "Single-robot GoldBot resolution via findUniqueOrThrow (fail-closed on missing seed) — replaced 03-01's provisional findUnique+manual-null-check helper"
  - "provisionSubscription signature unchanged for Phase 3 — robot resolved internally; callers (free-trial, paygate webhook) untouched"
  - "Duplicate-guard findFirst now robot-scoped (user + robot + tier), not (user + tier)"
  - "Compilation.robotId denormalized from subscription at creation and treated immutable"
  - "compiler-filename default reconciled to lowercase goldbot (filename now AL-ai-FX_goldbot_<jobId>.ex5; safe because DB was wiped in 03-01)"
  - "Poll response additively carries robotSlug for Phase 4; daemon ignores it until then"

patterns-established:
  - "GOLDBOT_SLUG canonical constant in subscriptions.ts is the single Phase-3 write-path robot key"
  - "Fail-closed robot resolution: a missing seed aborts the whole flow (P2025 -> 500) rather than creating a dangling subscription"

# Metrics
duration: 2min
completed: 2026-07-05
---

# Phase 3 Plan 02: robotId FK Wiring Summary

**robotId threaded through every write path — provisionSubscription and update-mt5 now populate the NON-NULL robotId columns from the goldbot Robot, poll response additively exposes robotSlug, and compiler-filename slug is reconciled to lowercase goldbot.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-05T19:43:34Z
- **Completed:** 2026-07-05T19:45:39Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `provisionSubscription` resolves the single GoldBot Robot via `findUniqueOrThrow` (fail-closed) and writes `robotId: robot.id` on every `Subscription`; duplicate-guard is now robot-scoped.
- `update-mt5` creates each `Compilation` with `robotId: subscription.robotId` (denormalized at creation).
- Poll response additively includes `robotSlug` (joined Robot relation) with all pre-existing daemon fields intact.
- `compiler-filename.ts` default slug reconciled from capital `GoldBot` to lowercase `goldbot`, matching DB `Robot.slug` and future Blob source paths.

## Task Commits

Each task was committed atomically:

1. **Task 1: Resolve GoldBot Robot in provisionSubscription** - `77d4a7f` (feat)
2. **Task 2: Set Compilation.robotId from subscription; reconcile compiler-filename slug** - `2e59c4a` (feat)
3. **Task 3: Additively expose robot slug in poll response** - `19c9508` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `src/lib/subscriptions.ts` - Added `GOLDBOT_SLUG` constant; replaced provisional `resolveDefaultRobotId()` with fail-closed `findUniqueOrThrow`; robot-scoped duplicate guard; `robotId: robot.id` on create.
- `src/app/api/licenses/update-mt5/route.ts` - Compilation created with `robotId: subscription.robotId` (comment clarified as immutable denormalization; robotId field was already present from 03-01's provisional edit).
- `src/lib/compiler-filename.ts` - Default slug changed `"GoldBot"` -> `"goldbot"`; docstring updated to note canonical lowercase DB slug and Phase 4 threading.
- `src/app/api/compiler/poll/route.ts` - Joined `robot: { slug: true }`; extended null-check; added `robotSlug` to claimed shape and final response.

## Decisions Made
- **Single-robot GoldBot resolution via `findUniqueOrThrow` (fail-closed).** A missing seed throws P2025 -> surfaced as 500 by existing caller try/catch, rather than creating a dangling subscription. Replaced 03-01's provisional `findUnique` + manual null-check helper.
- **`provisionSubscription` signature unchanged for Phase 3.** Robot resolved internally; `free-trial` and `paygate` webhook callers stay as-is. Multi-robot slug threading is Phase 4+/6 work.
- **Duplicate-guard now robot-scoped** — an active subscription is unique per (user, robot, tier).
- **`Compilation.robotId` denormalized from subscription at creation and treated immutable** — the compile worker needs the slug directly; the compilation's robot must not change even if the subscription is later re-pointed.
- **compiler-filename default reconciled to lowercase `goldbot`** — filename now `AL-ai-FX_goldbot_<jobId>.ex5`; safe because the DB was wiped in 03-01 (no artifacts keyed on the old capitalized name).
- **Poll response additively carries `robotSlug`** for Phase 4; daemon ignores it until then, preserving the load-bearing daemon contract.

## Deviations from Plan

None - plan executed exactly as written.

The `<execution_context>` note anticipated 03-01's provisional edits: `subscriptions.ts` had a `resolveDefaultRobotId()` helper (findUnique + manual null-check + a throw) and `update-mt5` already carried `robotId: subscription.robotId`. Per the note, these were refactored/reconciled to this plan's exact target shape (canonical `GOLDBOT_SLUG`, `findUniqueOrThrow`, robot-scoped `findFirst`) rather than treated as net-new — this was the intended work, not an unplanned deviation.

## Issues Encountered
- Initial file reads failed at `/Users/klev/Code/src/...` — the actual project root is `/Users/klev/Code/al-ai-fx` (the git repo). Resolved by locating the repo via the `AL-ai-FX_` filename convention and operating against the correct absolute paths.

## User Setup Required

None - no external service configuration required. Schema/DB columns already exist server-side (applied in 03-01); no migration or deploy needed for this plan.

## Next Phase Readiness
- CTLG-04 fully closed (03-01 schema half + this code half). Success Criterion 2 holds at runtime: every new Subscription and Compilation is robot-scoped.
- `robotSlug` is now available in the poll response for the Phase 4 compile worker to fetch per-robot source and generate per-robot filenames via `opts.robotSlug`.
- `tsc --noEmit` and `eslint` clean across all six touched files.
- Note: 03-03 (encrypted source storage) runs in parallel — Wave 2 not yet complete (orchestrator confirms after both land).

---
*Phase: 03-multi-robot-schema-foundation*
*Completed: 2026-07-05*

## Self-Check: PASSED
- Files verified present: src/lib/subscriptions.ts, src/app/api/licenses/update-mt5/route.ts, src/app/api/compiler/poll/route.ts, src/lib/compiler-filename.ts
- Commits verified present: 77d4a7f, 2e59c4a, 19c9508
</content>
</invoke>
