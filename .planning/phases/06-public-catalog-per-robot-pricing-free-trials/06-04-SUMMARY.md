---
phase: 06-public-catalog-per-robot-pricing-free-trials
plan: 04
status: complete
requirements: [PRIC-03, PRIC-04]
subsystem: admin-dashboard
files_changed:
  - src/app/[locale]/dashboard/admin/robots/actions.ts
  - "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx"
commits:
  - f96658e feat(06-04): updateRobotPrices ADMIN action, composite upsert, dual revalidate
  - 576890d feat(06-04): editable per-robot price inputs replace read-only pricing block
  - 8da7aa5 chore(06-04): add temp admin price-update verification route
  - 4c1ee1c chore(06-04): remove temp admin price-update verification route
key_decisions:
  - "updateRobotPrices upserts on the robotId_tier composite with update:{amount,active} (overwrites, unlike the 06-01 seed's update:{}) — the whole point of this action is to let an admin overwrite a price."
  - "Editable tier set is driven by TIER_METADATA (all 8 tiers, including hidden lifetime/secret tiers) not CATALOG_PUBLIC_TIERS (06-02's 5-tier public curation) — an admin can price a tier the public catalog never displays."
  - "Dual revalidatePath (/dashboard/admin/robots AND /catalog) is what makes this deploy-free (PRIC-04) — proven live this plan, not just asserted."
  - "Price-load plumbing: chose option (a) from the plan — added getRobotPrices(robotId), an ADMIN-gated read action, called from a useEffect in RobotForm when it opens in edit mode. page.tsx and RobotsTable.tsx stay untouched, avoiding any file overlap with other Phase 6 plans."
  - "Verification used a temporary live API route (not a build-step script) that imports and calls the real updateRobotPrices — a build-step script mutating the DB before next build would falsely 'prove' deploy-free propagation (the static page would just pick up the new value at build time). The temp route let the ALREADY-DEPLOYED catalog page get mutated and re-fetched with zero additional deploys, which is the actual PRIC-04 claim."
provides:
  - "Admins can now change any robot's per-tier prices from the dashboard, live, with no redeploy — the last piece of the resolveRobotPrice (06-01) / catalog (06-02) / checkout (06-03) chain now has a working write side."
  - "getRobotPrices(robotId) — reusable ADMIN-gated read action for any future admin UI needing a robot's price rows."
---

# Phase 6 Plan 04: Admin Per-Robot Price Editor Summary

**Admins can now edit any robot's per-tier prices directly from the dashboard — no deploy, no code change. `updateRobotPrices` upserts `RobotPrice` rows on the `(robotId, tier)` composite and revalidates both the admin page and the public `/catalog`; `RobotForm`'s old "Pricing (read-only) ... arrives in Phase 6" placeholder is gone, replaced by live editable inputs seeded from the robot's actual price rows.**

## Performance
- **Tasks:** 3 completed (implemented inline in the main session, continuing the pattern from 06-02/06-03 after the earlier background-agent-death incident)
- **Files changed:** 2 permanent (`actions.ts`, `RobotForm.tsx`) + 1 temporary verification route (added and removed in the same plan)

## Accomplishments
- `actions.ts` — appended `updateRobotPrices(robotId, prices)`: ADMIN-gated (`session?.user?.role !== "ADMIN"` throw, matching all 4 existing actions in this file), validates each tier against `TIER_METADATA` (fail-closed on an unknown tier string) and each amount (`Number.isFinite && amount >= 0`), upserts on `robotId_tier` with `update: { amount, active }` (overwrite semantics — the seed's `update: {}` no-op does NOT apply here), then `revalidatePath` on both `/dashboard/admin/robots` and `/catalog`. Also appended `getRobotPrices(robotId)`, a small ADMIN-gated read action.
- `RobotForm.tsx` — in edit mode, a `useEffect` calls `getRobotPrices` on open and seeds a `Record<tierId, string>` price state from `TIER_METADATA`'s full 8-tier list (defaulting to `"0"` for a robot with no row yet for a given tier). Renders one labeled number input per tier plus a "Save prices" button wired to `updateRobotPrices`. The old `<h3>Pricing (read-only)</h3>` block, its Phase-6 deferral note, and the now-unused `import { PRICING_TIERS } from "@/config/pricing"` are all removed.
- `RobotsTable.tsx` was left untouched — the plumbing decision (loading prices via a dedicated read action instead of a new prop) meant no cross-plan file touch was needed.

## Live Verification Against Production
1. **Baseline confirmed:** `curl https://www.al-ai-fx.xyz/catalog` showed GoldBot's 1-month tier at `$199` before any change.
2. **Real propagation, no redeploy:** deployed the Task 1+2 code, then added one temporary route (`/api/admin/verify-06-04-price`, since removed) that directly calls the real `updateRobotPrices` export — chosen over a build-step DB script specifically because a build-step mutation happens *before* `next build`, which would make a statically-rendered page "correctly" show the new price simply by virtue of being rebuilt, proving nothing about deploy-free propagation. Calling the live action from an already-deployed route is the only way to test the actual PRIC-04 claim.
   - `GET .../verify-06-04-price?amount=222` (with the verify-admin session cookie) → `{"result":{"success":true,"count":1}}`.
   - Immediately after, **with no new deploy**, `curl .../catalog` showed `$222` in place of `$199` — `revalidatePath("/catalog")` confirmed working live.
   - `create-session` for `goldbot`/`1-month` still returned the pre-existing `PAYGATE_PAYOUT_USDC_ADDRESS is missing` error (same gap documented in 06-03) — this error fires strictly after `resolveRobotPrice` succeeds, so reaching it (rather than a 400 on the resolver) is consistent with the new $222 price having been picked up server-side too; the numeric echo itself couldn't be captured because the route never reaches its response body past that config check.
3. **Fail-closed baseline holds:** an unauthenticated `GET` to the same temp route (no session cookie) threw `"Unauthorized"` inside `updateRobotPrices` before any DB write, surfaced as HTTP 500 by the un-wrapped route handler — the catalog price was unchanged afterward, confirming the ADMIN gate fires before any mutation.
4. **Restored:** `GET .../verify-06-04-price?amount=199` → catalog confirmed back to `$199`.
5. Temp route deleted and a final deploy confirmed it now 404s, leaving no lingering attack surface.

## Deviations from Plan
- Used a temporary live route rather than a build-step script for verification (see `key_decisions` — a build-step script would not actually exercise the deploy-free claim). This is a stronger, more literal proof of PRIC-04 than the plan's suggested alternative.

## Issues Encountered
None beyond the same pre-existing `PAYGATE_PAYOUT_USDC_ADDRESS` gap already documented in 06-03 (unrelated to this plan, not blocking).

## User Setup Required
None new.

## Next Phase Readiness
Phase 6 is now 4/4 complete. Phase 7 (onboard 3 new robots + end-to-end validation) can proceed — the full pricing/catalog/checkout/admin loop built across 06-01 through 06-04 needs no further Phase 6 work to onboard additional robots.

## Self-Check: PASSED
- Files verified present/modified: `actions.ts`, `RobotForm.tsx`.
- Commits verified: all 4 in `git log`, temp route added then cleanly removed.
- Live verification: price change propagated to `/catalog` with zero redeploys, fail-closed ADMIN gate confirmed, price restored, temp route confirmed gone (404) post-cleanup deploy.

---
*Phase: 06-public-catalog-per-robot-pricing-free-trials*
*Completed: 2026-07-06*
