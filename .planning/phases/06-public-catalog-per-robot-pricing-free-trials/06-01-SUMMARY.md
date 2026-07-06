---
phase: 06-public-catalog-per-robot-pricing-free-trials
plan: 01
status: complete
requirements: [PRIC-01, PRIC-03, TRIL-01]
subsystem: pricing / schema foundation
files_changed:
  created:
    - prisma/migrations/20260706_add_robot_pricing_and_trial_index/migration.sql
    - src/lib/robot-pricing.ts
    - scripts/seed-robot-prices.js
  modified:
    - prisma/schema.prisma
    - package.json  # temp build-step then reverted (net zero)
commits:
  - a5eed71: "feat(06-01): add RobotPrice model + migration with partial trial index"
  - af3f323: "feat(06-01): add resolveRobotPrice resolver + GoldBot price seed"
  - e5c0a76: "chore(06-01): temp build-step to apply robot-pricing migration + seed"
  - 342bade: "chore(06-01): revert temp build-step after robot-pricing migration applied"
metrics:
  duration: ~15m
  completed: 2026-07-06
---

# Phase 6 Plan 1: Robot Price Schema, Resolver & Seed Summary

Per-robot pricing data foundation: a price-only `RobotPrice` table (composite unique `(robotId, tier)`, `amount`, `active`), a Postgres **partial unique index** enforcing one-free-trial-per-robot existence-ever, a fail-closed `resolveRobotPrice()` server-side price authority, and an idempotent GoldBot seed — all applied live to production via the incremental build-step `migrate deploy` channel.

## What Was Built

- **`RobotPrice` model** (`prisma/schema.prisma`): `id`, `robotId` (FK → Robot, cascade delete), `tier` (`PricingTier` enum — DB enforces tier validity for free), `amount Float`, `active Boolean @default(true)`, timestamps. `@@unique([robotId, tier])` yields the `robotId_tier` composite lookup key; `@@index([robotId, active])`. `prices RobotPrice[]` back-relation added to `Robot`. Price-only by design — no duration/priceString (TIER_METADATA stays the SSoT for those).
- **Migration** (`20260706_add_robot_pricing_and_trial_index/migration.sql`): Prisma-generated `CREATE TABLE "RobotPrice"` + FK + indexes, then a hand-appended partial unique index `Subscription_one_free_trial_per_robot ON "Subscription"("userId","robotId") WHERE "tier" = 'FREE_TRIAL'`. Nothing destructive.
- **`resolveRobotPrice(robotSlug, tierRaw)`** (`src/lib/robot-pricing.ts`): fail-closed, server-authoritative. Reuses `mapTier` (throws `UnknownTierError`), throws `UnknownRobotError` for missing/inactive robot, `UnknownRobotPriceError` for missing/inactive price row. Returns `{ robot, tier, amount }` with `amount` computed from the DB row — never a default, never a client-supplied value.
- **`scripts/seed-robot-prices.js`**: idempotent upsert (`update: {}`) of GoldBot's 8 tiers from TIER_METADATA amounts on the `robotId_tier` composite.

## Production Application Evidence

Applied via the incremental build-step channel (deployment `dpl_AtHHfeSYAjuKFFh6AALs1DdovC2o`, `https://al-ai-qwxqm23n1-ltl-proj.vercel.app`, READY). Build log:

```
Applying migration `20260706_add_robot_pricing_and_trial_index`
All migrations have been successfully applied.
[seed-robot-prices] Seeded 8 RobotPrice rows for goldbot (id=cmr86vu530000jf5xbsggcfrv).
```

Incremental `migrate deploy` (1 of 3 migrations applied) — **no reset, no P3005, no DROP**. Temp build-step reverted in a separate commit (342bade); `build` is back to `prisma generate && next build`.

## Key Decisions

- **`RobotPrice` is price-only** (`amount` + `active`); TIER_METADATA remains the single source of truth for tier durations/priceStrings. `RobotPrice.tier` is the `PricingTier` enum, so the DB validates tier for free.
- **Partial unique index applied as raw SQL**, intentionally invisible to `migrate diff` (not expressible in schema.prisma). A future diff must NOT "correct"/drop it.
- **`resolveRobotPrice` is fail-closed** — mirrors the `UnknownTierError` discipline; throws `UnknownRobotError` / `UnknownRobotPriceError` rather than defaulting to zero. Amount is always server-computed.
- **Incremental `migrate deploy`, never reset** — history since `0_init`; a reset would wipe production data.
- **GoldBot seeded from TIER_METADATA amounts** so GoldBot checkout does not fail-closed to zero prices after the migration; seed is idempotent (`update: {}`) so admin edits in 06-04 are never clobbered on re-run.

## Provides (for downstream Wave 2 plans)

- **`resolveRobotPrice(robotSlug, tierRaw)`** (`src/lib/robot-pricing.ts`) is the single server-side price authority — 06-02 (catalog), 06-03 (payment funnel), 06-04 (admin editor) must resolve prices through it, never trust client amounts.
- Composite lookup key is **`robotId_tier`** (`prisma.robotPrice.findUnique({ where: { robotId_tier: { robotId, tier } } })`).
- The partial unique index throws **P2002** on a second `FREE_TRIAL` Subscription insert for the same `(userId, robotId)` — the code-level throw handling (map to a friendly "trial already used") lands in 06-03.
- `UnknownRobotError` / `UnknownRobotPriceError` exported for callers to translate to HTTP 400/404.

## Deviations from Plan

**1. [Rule 3 - Blocking] `prisma migrate diff --from-migrations` requires a shadow DB (unavailable offline).**
- **Found during:** Task 1b — the plan's `--from-migrations prisma/migrations` diff command failed with "You must pass the --shadow-database-url".
- **Fix:** Generated the identical DDL offline via a schema-to-schema diff (`--from-schema-datamodel <current-minus-RobotPrice> --to-schema-datamodel <current>`), which needs no DB. Output was byte-identical to expected Prisma DDL; then hand-appended the partial index. No behavior change vs. plan intent.
- **Files:** prisma/migrations/20260706_add_robot_pricing_and_trial_index/migration.sql
- **Commit:** a5eed71

**2. [Rule 3 - Blocking] `prisma validate`/`generate` require `DATABASE_URL` to be set (even for file-only ops in this Prisma 6.19 config).**
- **Fix:** Ran file-only commands with a throwaway `DATABASE_URL="postgresql://u:p@localhost:5432/db"` (never connected — validate/generate are static). No real DB access.

## Self-Check: PASSED

- FOUND: prisma/schema.prisma (model RobotPrice, prices relation)
- FOUND: prisma/migrations/20260706_add_robot_pricing_and_trial_index/migration.sql (CREATE TABLE + partial index)
- FOUND: src/lib/robot-pricing.ts (resolveRobotPrice + both error classes)
- FOUND: scripts/seed-robot-prices.js (robotId_tier upsert, update:{})
- FOUND commit a5eed71, af3f323, e5c0a76, 342bade
- tsc --noEmit clean; eslint clean; production migrate+seed confirmed in build log
