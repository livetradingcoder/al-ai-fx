---
phase: 02-payment-pricing-launch-blockers
plan: 01
subsystem: payments-pricing
tags: [prisma, pricing, enum, typescript, node-test, exhaustiveness]
requirements_closed: [PRIC-02]

# Dependency graph
requires:
  - phase: 01-restore-compile-delivery
    provides: "db push (not migrate dev) as the established remote-Postgres schema-change pattern"
provides:
  - "PricingTier enum extended 5 → 8 (adds TEN_DAYS, ONE_YEAR, LIFETIME_SOURCE)"
  - "src/lib/pricing-tiers.ts — single source of truth (TIER_METADATA, mapTier, computeExpirationDate, UnknownTierError, TierMetadata)"
  - "Compile-time alignment between src/config/pricing.ts TierId slugs and the PricingTier DB enum"
  - "UnknownTierError → HTTP 400 wiring in the free-trial checkout route"
affects: [02-02-fail-closed-webhook-signature, 02-03-webhook-replay-idempotency, phase-06-data-driven-pricing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Record<TierId, TierMetadata> map as compile-time drift guard between config slugs and DB enum"
    - "assertNever exhaustive-switch pattern for enum-total functions"
    - "Total mapping functions throw a typed error (UnknownTierError) instead of returning a silent default"

key-files:
  created:
    - src/lib/pricing-tiers.ts
    - src/lib/pricing-tiers.test.ts
  modified:
    - prisma/schema.prisma
    - src/lib/subscriptions.ts
    - src/app/api/checkout/free-trial/route.ts

key-decisions:
  - "Enum values chosen: TEN_DAYS, ONE_YEAR, LIFETIME_SOURCE (life-cycle order in schema; no existing value renamed)"
  - "db push used per the established Phase 1/2 remote-Postgres pattern — no prisma/migrations dir yet (Phase 3 owns migration strategy)"
  - "Canonical-slug-only policy: mapTier normalises trim+lowercase but old aliases (monthly, one_month, biannual, free_trial, secret_test) now throw UnknownTierError instead of resolving — aliases were a drift source"
  - "assertNever compile-time exhaustiveness chosen over a runtime coverage check — a future PricingTier value without a computeExpirationDate case fails tsc --noEmit"

patterns-established:
  - "Pattern: config↔DB-enum alignment enforced by Record<TierId, {enum: PricingTier}> — adding a slug forces the map to grow or TS fails"
  - "Pattern: exhaustive switch + assertNever(x: never) for any function total over an enum"

# Metrics
duration: ~9min (incl. env/DB access investigation)
completed: 2026-07-05
---

# Phase 2 Plan 01: Pricing Tier Alignment Summary

**Killed the silent tier-downgrade revenue leak (PRIC-02): PricingTier enum extended to 8 values and a new `src/lib/pricing-tiers.ts` makes `src/config/pricing.ts`, the DB enum, `mapTier`, and `computeExpirationDate` a single, compile-time-enforced source of truth — unknown tiers now throw `UnknownTierError` (→ HTTP 400) instead of coercing to `ONE_MONTH`.**

## Performance

- **Duration:** ~9 min (includes investigating that the DB URL is a Vercel-Sensitive secret)
- **Started:** 2026-07-05T14:31Z
- **Completed:** 2026-07-05T14:35Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `PricingTier` enum grown 5 → 8: `TEN_DAYS`, `ONE_YEAR`, `LIFETIME_SOURCE` added (additive-only; regenerated Prisma client exposes all three).
- New `src/lib/pricing-tiers.ts`: `TIER_METADATA` (`Record<TierId, TierMetadata>`), total `mapTier` (throws `UnknownTierError`), exhaustive `computeExpirationDate` guarded by `assertNever`.
- Legacy inline `mapTier` (with its `default: return PricingTier.ONE_MONTH` downgrade) and inline `computeExpirationDate` deleted from `subscriptions.ts`, replaced by re-exports so existing callers keep working unchanged.
- Free-trial route catches `UnknownTierError` → HTTP 400 (defense-in-depth matching the 02-02 pattern) and its stale magic-link email copy fixed.
- 8 `node:test` cases pass, including four PRIC-02 regression tests (`1-year`, `lifetime-source`, `10-days` no longer downgrade; unknown input throws).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend PricingTier enum** - `956bf1f` (feat)
2. **Task 2: pricing-tiers.ts SSoT module + tests** - `255010f` (feat)
3. **Task 3: Delete legacy mapTier; wire UnknownTierError → 400** - `c2ce679` (refactor)

_(Commit `a457ce3` interleaved in the log belongs to Plan 02-02, running in parallel — not part of this plan.)_

## Files Created/Modified
- `prisma/schema.prisma` - PricingTier enum extended with TEN_DAYS, ONE_YEAR, LIFETIME_SOURCE
- `src/lib/pricing-tiers.ts` - TIER_METADATA + mapTier + computeExpirationDate + UnknownTierError + TierMetadata
- `src/lib/pricing-tiers.test.ts` - 8 node:test cases incl. PRIC-02 regression coverage
- `src/lib/subscriptions.ts` - inline mapTier/computeExpirationDate deleted; re-exported from pricing-tiers
- `src/app/api/checkout/free-trial/route.ts` - catches UnknownTierError → 400; fixed stale sign-in-link email copy

## Decisions Made
- Enum extension is additive-only; `LIFETIME` and `SECRET_TEST_TIER` untouched (external code depends on them).
- `db push` remains the schema-change mechanism (per Phase 1/2 decision); no `migrate dev`.
- mapTier is a total function — canonical `TierId` slugs only; legacy aliases now throw rather than silently resolving.
- Exhaustiveness enforced at compile time via `assertNever`, not at runtime.

## Deviations from Plan

### Auto-fixed Issues

None affecting code correctness — all three tasks implemented exactly as written. One in-plan copy change (free-trial email "welcome sign-in link" wording) was already specified in the plan action and is not a deviation.

**Total deviations:** 0
**Impact on plan:** None — plan executed as written.

## Issues Encountered

**`prisma db push` to remote Coolify Postgres could not be run (BLOCKED — not completed).**
- `vercel env pull .env.local --environment=production` returned an **empty** value for `DATABASE_URL` (and `POSTGRES_URL`, `PRISMA_DATABASE_URL`). `vercel env ls` shows them as `Encrypted`, but their values are not returned by `env pull` — they are Vercel **Sensitive** (write-only) secrets. Several other secrets (`COMPILER_SECRET`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`) came back empty for the same reason. No local `.env` with the real connection string exists (gitignored, not present), and it is not in the shell environment.
- Consequence: the schema-side and code-side work is complete and fully verified offline, but the **remote enum has NOT yet been extended**. Until `prisma db push` runs against the remote DB, writing an order/subscription with `TEN_DAYS`/`ONE_YEAR`/`LIFETIME_SOURCE` will fail at the DB layer (the enum value does not exist server-side).
- `prisma generate` succeeded and the generated client exposes all three new values (`node -e` prints `TEN_DAYS ONE_YEAR LIFETIME_SOURCE`), so `tsc` and the tests are green.
- `.env.local` was deleted after the investigation (it must not persist in the working tree).

**Everything else verified green:**
- `npx tsc --noEmit` — clean (proves TierId↔PricingTier alignment + assertNever exhaustiveness).
- `node --test` on the transpiled test module — 8/8 pass, incl. all four PRIC-02 regression tests (Node v20.15.1 lacks `--experimental-strip-types` and no `tsx` is installed, so the plan's manual-transpile fallback was used).
- `grep -rn "return PricingTier.ONE_MONTH" src/lib/` — no matches (silent-downgrade fallthrough gone).
- `npx eslint` on the three touched files — clean. (Full `npm run lint` reports 20 pre-existing problems, all in unrelated files: scripts/*, page.tsx, seo.test.ts — none introduced by this plan.)

## User Setup Required

**Remote schema push is pending and requires DB access this environment does not have.** One of:
1. Run locally where the real `DATABASE_URL` is available:
   ```
   export DATABASE_URL="<coolify-postgres-url>"
   npx prisma db push
   ```
   Expect: `The database is now in sync with your Prisma schema.`
2. Or set the URL for the CLI session another way (e.g. a local `.env` with the real value) before `db push`.

Verify afterward: a second `npx prisma db push` should report no pending changes, and the remote `PricingTier` type should list all 8 values.

## Next Phase Readiness
- Code + local Prisma client are ready; `mapTier`/`computeExpirationDate` are the SSoT that 02-02 (webhook) and future callers should import from `@/lib/pricing-tiers`.
- **BLOCKER for revenue correctness:** remote `prisma db push` must be executed before any order/subscription can be written with the three new tiers. Tracked below in STATE.md Blockers/Concerns.
- Aligns with the Phase 6 data-driven pricing path (extend enum now, refactor to per-robot rows later).

## Self-Check: PASSED
- FOUND: src/lib/pricing-tiers.ts
- FOUND: src/lib/pricing-tiers.test.ts
- FOUND: prisma/schema.prisma (enum extended)
- FOUND commit: 956bf1f
- FOUND commit: 255010f
- FOUND commit: c2ce679
- CAVEAT: remote `prisma db push` NOT executed (DATABASE_URL is a Vercel-Sensitive secret, unreachable here) — documented as a blocker, not silently claimed done.

---
*Phase: 02-payment-pricing-launch-blockers*
*Completed: 2026-07-05*
