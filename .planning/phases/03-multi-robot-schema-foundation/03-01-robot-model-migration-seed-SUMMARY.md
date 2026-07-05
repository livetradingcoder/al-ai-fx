---
phase: 03-multi-robot-schema-foundation
plan: 01
subsystem: multi-robot-schema
tags: [prisma, postgres, migrations, robot-catalog, seed, vercel-build-channel]
requirements_closed: [CTLG-01, CTLG-05]
# CTLG-04 partial: schema/DB half (robotId FK columns) closed here; code-wiring half completes in 03-02.

# Dependency graph
requires:
  - phase: 02-payment-pricing-launch-blockers
    provides: "PricingTier enum (8 values) + WebhookDelivery table live on remote Postgres; proven Vercel build-step channel for DATABASE_URL-requiring commands"
provides:
  - "Robot catalog model (slug @unique, name, short/long description, active, artworkUrl, sortOrder, timestamps)"
  - "NON-NULL robotId FK (onDelete Restrict) on Subscription and Compilation"
  - "First checked-in Prisma migration prisma/migrations/0_init (ends the db-push era; migration history now exists)"
  - "Seeded GoldBot Robot row on remote Postgres (slug 'goldbot', active)"
  - "scripts/seed-goldbot.js idempotent seed"
  - "Minimal robotId wiring at the two existing create sites (default 'goldbot')"
affects: [03-02-robotid-fk-wiring, 03-03-encrypted-source-storage, catalog-ux, compile-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Formal checked-in Prisma migrations from 0_init forward (migrate diff --from-empty generated offline; migrate reset --force applies via build channel)"
    - "Robot catalog SSoT: one Robot row per tradable EA; Subscription/Compilation reference it via NON-NULL robotId (Restrict, no cascade)"

key-files:
  created:
    - prisma/migrations/0_init/migration.sql
    - prisma/migrations/migration_lock.toml
    - scripts/seed-goldbot.js
  modified:
    - prisma/schema.prisma
    - package.json
    - src/app/api/licenses/update-mt5/route.ts
    - src/lib/subscriptions.ts

key-decisions:
  - "Reset-and-clean-baseline over baselining an existing DB: test data is wipeable (PROJECT.md Key Decision), so a fresh empty DB + 0_init avoids all P3005/migrate-resolve risk."
  - "Entire new schema incl. robotId FKs goes in a single 0_init migration so Plan 03-02 needs NO further schema change or deploy — the columns already exist in the DB after this plan."
  - "robotId is NON-NULL with default onDelete Restrict (no cascade) — a Robot referenced by any subscription/compilation cannot be deleted, so a paid license is never orphaned by a catalog edit; retire via active=false."
  - "Canonical lowercase slug 'goldbot' (display name 'GoldBot') — join key for Blob paths sources/<slug>/ and the compiled filename; 03-02 reconciles compiler-filename.ts's capital-GoldBot default to this."
  - "Standalone scripts/seed-goldbot.js (upsert on slug) over Prisma-native seed config — mirrors scripts/create-admin.js, avoids Prisma 6.19 seed-config-key uncertainty, invocable directly in the build chain."
  - "migrate reset --force (single atomic drop+replay of prisma/migrations) chosen over db push --force-reset + migrate deploy — the latter re-populates the schema and caused P3005; migrate reset leaves the DB with only migration-applied tables and records _prisma_migrations correctly."

patterns-established:
  - "Formal Prisma migration workflow: generate SQL offline via `migrate diff --from-empty --to-schema-datamodel --script`, commit, apply via Vercel build channel (`migrate reset --force`), revert build in a separate commit."
  - "Default-robot resolution: subscriptions.resolveDefaultRobotId() looks up slug 'goldbot' until per-robot checkout selection lands in 03-02."

# Metrics
duration: ~4.5min (task commits) / ~15min wall (incl. 3 deploys)
completed: 2026-07-05
---

# Phase 3 Plan 01: Robot Model Migration + Seed Summary

**Landed the `Robot` catalog model and the first checked-in Prisma migration (`0_init`), wiped and re-baselined the remote test Postgres via the Vercel build channel, and seeded GoldBot — ending the `db push` era with real migration history plus NON-NULL `robotId` FKs on Subscription/Compilation.**

## Performance

- **Duration:** ~4.5 min across task commits (~15 min wall incl. 3 Vercel deploys)
- **Started:** 2026-07-05T21:32:06+02:00 (first task commit)
- **Completed:** 2026-07-05T21:36:23+02:00 (revert commit)
- **Tasks:** 3 completed
- **Files created/modified:** 7

## Accomplishments
- Added the `Robot` model (all 10 CTLG-01 fields) plus NON-NULL `robotId` FKs (onDelete Restrict) on `Subscription` and `Compilation`.
- Generated the first checked-in migration `prisma/migrations/0_init/migration.sql` (161 lines, 7 CREATE TABLEs) offline via `migrate diff --from-empty`, with `migration_lock.toml`.
- Reset the remote test Postgres and applied `0_init` cleanly through the Vercel build channel — `_prisma_migrations` now tracks `0_init` (no P3005). Confirmed in build log: `Applying migration 0_init` → `Database reset successful`.
- Seeded GoldBot: `[seed-goldbot] Robot ready: id=cmr86vu530000jf5xbsggcfrv slug=goldbot active=true`.
- Reverted the build script to `prisma generate && next build` and validated a clean green production deploy (`al-ai-j1ojrzxbr`, Ready) with no destructive commands in the build.

## Task Commits

1. **Task 1: Robot model + robotId FKs + 0_init migration** - `ba4e3e2` (feat)
2. **Task 2: idempotent GoldBot seed script** - `a9579e4` (feat)
3. **Task 3 (apply): temporary db reset + migrate + seed in build** - `59e84a7` (chore)
   - **Rule 3 fix (robotId wiring):** `6dec0dc` (fix)
   - **Task 3 (revert): build script back to normal** - `faa58d5` (chore)

**Plan metadata:** _(docs commit — see final commit)_

## Files Created/Modified
- `prisma/schema.prisma` - Robot model + robotId FKs on Subscription/Compilation
- `prisma/migrations/0_init/migration.sql` - full-schema first migration (CREATE TABLE "Robot" + robotId FK constraints)
- `prisma/migrations/migration_lock.toml` - Prisma provider lock (postgresql)
- `scripts/seed-goldbot.js` - idempotent GoldBot upsert on slug
- `package.json` - build script temporarily carried reset/migrate/seed, then reverted
- `src/app/api/licenses/update-mt5/route.ts` - Compilation.create now passes robotId (denormalized from subscription)
- `src/lib/subscriptions.ts` - Subscription.create resolves default 'goldbot' robotId

## Decisions Made
See `key-decisions` in frontmatter. Headlines: reset-and-clean-baseline over baselining; full schema (incl. robotId FKs) in one 0_init so 03-02 needs no deploy; NON-NULL robotId with Restrict onDelete (protects paid licenses); canonical lowercase slug `goldbot`; standalone seed script; `migrate reset --force` for the non-interactive wipe+apply.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `db push --force-reset` + `migrate deploy` produced P3005**
- **Found during:** Task 3 (first deploy attempt, dpl al-ai-cytnec37e's predecessor al-ai-aytre24wf)
- **Issue:** The plan's build chain assumed `prisma db push --force-reset` leaves an empty DB. It does not — `db push` drops then **re-populates** the schema from `schema.prisma`, so the following `migrate deploy` saw a non-empty schema and failed with `P3005: The database schema is not empty`.
- **Fix:** Replaced `prisma db push --force-reset --accept-data-loss && prisma migrate deploy` with `prisma migrate reset --force --skip-generate --skip-seed`, which drops the `public` schema AND replays `prisma/migrations/0_init` in a single atomic Prisma operation, recording `_prisma_migrations` correctly (no P3005).
- **Files modified:** `package.json` (build script)
- **Verification:** Build log of dpl `al-ai-cytnec37e`: `Applying migration 0_init` → `Database reset successful` → `[seed-goldbot] Robot ready: ... slug=goldbot active=true`. No P3005.
- **Committed in:** `59e84a7` (amended into the temporary-build apply commit — preserves two-commit apply/revert discipline).

**2. [Rule 3 - Blocking] Required `robotId` broke `next build` typecheck at existing create sites**
- **Found during:** Task 3 (dpl al-ai-cytnec37e — build reached `next build` after the DB steps succeeded)
- **Issue:** Adding NON-NULL `robotId` made `prisma.compilation.create` (`update-mt5/route.ts:47`) and `prisma.subscription.create` (`subscriptions.ts:96`) fail `tsc` — `Property 'robotId' is missing`. The deploy build cannot complete (and the revert cannot safely ship) with a compile error.
- **Fix:** Minimal wiring only: Compilation.create denormalizes `robotId` from the subscription; provisionSubscription resolves the default `'goldbot'` Robot id via a new `resolveDefaultRobotId()` helper. Richer per-robot selection is deliberately left to 03-02.
- **Files modified:** `src/app/api/licenses/update-mt5/route.ts`, `src/lib/subscriptions.ts`
- **Verification:** Local `tsc --noEmit` exit 0, `eslint` exit 0; clean green production deploy `al-ai-j1ojrzxbr` (Ready) with the reverted build.
- **Committed in:** `6dec0dc`

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking).
**Impact on plan:** Both fixes were required to complete the deploy and land the migration; no scope creep. Deviation 2 does light-touch what 03-02 will do thoroughly — 03-02 remains responsible for real per-robot selection (checkout carries a robot slug, compiler-filename reconciliation). No architectural (Rule 4) changes; the DB wipe was pre-approved and is not a deviation.

## Issues Encountered
- Local `prisma validate`/`generate` require a `DATABASE_URL` env var even offline (P1012). Resolved by exporting a dummy localhost URL for parse-only commands (validate/generate/migrate diff never connect). Not a deviation — expected local-env behavior given `DATABASE_URL` is Vercel-Sensitive.
- Three production deploys were consumed: two failed (P3005, then typecheck) and one succeeded green. Each failure was diagnosed from `vercel inspect --logs` before the next attempt.

## User Setup Required
None - no new external service configuration required.

## Next Phase Readiness
- **03-02 (robotId FK wiring) and 03-03 (encrypted source storage)** are the Wave 2 plans; both depend only on this plan. The DB already has the `robotId` columns and the seeded GoldBot row, so 03-02 needs NO further schema change or deploy — it can wire selection through checkout/UI and reconcile `compiler-filename.ts` against slug `goldbot`.
- Migration history now exists: any future schema change follows the established workflow (generate SQL offline via `migrate diff`, apply via build channel with `migrate deploy` — no more `db push` needed for schema evolution now that a baseline exists).
- The minimal `resolveDefaultRobotId()` default and Compilation `robotId` denormalization in this plan are provisional — 03-02 should replace/extend them with real per-robot selection.

## Self-Check: PASSED

All claimed artifacts verified present:
- Files: prisma/migrations/0_init/migration.sql, prisma/migrations/migration_lock.toml, scripts/seed-goldbot.js, 03-01-...-SUMMARY.md
- Commits: ba4e3e2, a9579e4, 59e84a7, 6dec0dc, faa58d5
- Remote DB: 0_init applied + GoldBot seeded (build log dpl al-ai-cytnec37e); clean green deploy al-ai-j1ojrzxbr with reverted build.

---
*Phase: 03-multi-robot-schema-foundation*
*Completed: 2026-07-05*
