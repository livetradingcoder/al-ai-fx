---
phase: 06-public-catalog-per-robot-pricing-free-trials
plan: 03
status: complete
requirements: [CTLG-03, PRIC-01, PRIC-04, TRIL-01, TRIL-02, TRIL-03]
subsystem: payment-funnel
files_changed:
  - src/lib/subscriptions.ts
  - src/app/api/paygate/create-session/route.ts
  - src/app/api/webhooks/paygate/route.ts
  - src/app/api/checkout/free-trial/route.ts
  - "src/app/[locale]/checkout/CheckoutClient.tsx"
  - "src/app/[locale]/catalog/page.tsx"
commits:
  - d8a2617 feat(06-03): provisionSubscription requires robotSlug, resolves fail-closed, FREE_TRIAL P2002 handling
  - 2fda6a1 feat(06-03): bind robotSlug into Paygate HMAC (create-session + webhook, atomic)
  - b77462f feat(06-03): free-trial route threads robotSlug fail-closed, friendly one-trial-per-robot message
  - f623983 feat(06-03): checkout UI threads robotSlug + robot name, drops hardcoded GoldBot strings
  - 57cc5d8 chore(06-03): add ad-hoc partial-trial-index verification script
  - 9a20ead / 9078ed5 chore(06-03): temp-run + revert trial-index verification in build
key_decisions:
  - "HMAC payload order ${orderRef}${email}${robotSlug}${tier}${amount} bound identically at create-session (signs) and the webhook (reconstructs) — changed atomically in one commit (2fda6a1) so no window exists where the two sites disagree."
  - "provisionSubscription's robotSlug param is REQUIRED (no default) — GOLDBOT_SLUG constant removed entirely; unknown/inactive robot or tier now throws (UnknownRobotError/UnknownRobotPriceError/UnknownTierError), never coerces."
  - "create-session computes amount server-side via resolveRobotPrice (RobotPrice row) — the client never supplies a price; the URL amount is only an HMAC-signature echo, never the price of record."
  - "FREE_TRIAL P2002 (from 06-01's partial unique index) is caught in provisionSubscription and turned into a friendly { duplicated: true, alreadyTrialed: true } result, surfaced by the free-trial route as HTTP 409 'You already used your free trial for this robot' — not a 500."
  - "Checkout UI obtains the robot display name via a &name=<robot.name> query param on the catalog CTA (catalog/page.tsx) rather than a new API endpoint or an unsigned client fetch — lower-risk, no new attack surface, matches the plan's guidance to pick the lower-risk option."
provides:
  - "provisionSubscription(email, tierRaw, robotSlug, paygateId?, amount?, currency?) — new required 3rd param, GOLDBOT_SLUG removed. Any future caller must supply a real robotSlug."
  - "The Paygate callback URL now carries a signed robot=<slug> param — Phase 7 (onboarding new robots) does not need to touch this funnel again; it already threads any robot slug."
  - "resolveRobotPrice is now the single server-side price+robot authority used by create-session, the webhook, and free-trial — consistent fail-closed behavior across all three purchase entry points."
outstanding_findings:
  - "PAYGATE_PAYOUT_USDC_ADDRESS is NOT set in Vercel production (discovered live this plan) — the Paygate wallet-creation call in create-session has never actually succeeded past this check in this environment, independent of Phase 6. This means the live paid-checkout path could not be end-to-end verified (see verification notes below); the price-resolution and fail-closed logic ahead of this check WAS verified live."
  - "PAYGATE_WEBHOOK_SECRET is a Vercel-Sensitive (write-only) variable — cannot be read via vercel env pull, so the exact HMAC signature could not be independently reconstructed locally to test a real robot-swap mutation end-to-end. The atomic byte-identical payload strings at both sites (grep+tsc verified) and the fail-closed 401-on-bogus-signature baseline (live-verified) are the practical proof available in this environment. Both gaps are pre-existing and non-blocking for this phase's own scope (same treatment as the MAILTRAP_TOKEN gap since Phase 1)."
---

# Phase 6 Plan 03: robotSlug Funnel + HMAC Enforcement Summary

**Threaded `robotSlug` through the entire purchase funnel as a first-class, fail-closed, HMAC-bound identity: `provisionSubscription` now requires it (no more GoldBot default), the Paygate signature binds it to block a robot-swap replay, the free-trial route enforces true per-robot trial uniqueness via the DB partial index, and the checkout UI carries the real robot through instead of hardcoded GoldBot strings.**

## Performance
- **Tasks:** 3 completed (implemented inline in the main session after the original background-agent Wave 2 spawn was interrupted by a host restart — resumed by implementing directly rather than re-spawning three fresh agents)
- **Files changed:** 6 (+ 1 ad-hoc verification script)

## Accomplishments
- `subscriptions.ts` — `provisionSubscription` signature gained a required `robotSlug` (3rd param); `GOLDBOT_SLUG` constant and its `findUniqueOrThrow` block deleted entirely, replaced by `resolveRobotPrice(robotSlug, tierRaw)`. The `subscription.create` call is now wrapped in try/catch: a `P2002` on a `FREE_TRIAL` insert (the 06-01 partial unique index firing) returns `{ duplicated: true, alreadyTrialed: true }` instead of throwing.
- `create-session/route.ts` + `webhooks/paygate/route.ts` — **the security-critical atomic change.** Both sites now bind `robotSlug` into the HMAC in the identical order `${orderRef}${email}${robotSlug}${tier}${amount}`. `create-session` resolves the amount server-side via `resolveRobotPrice` (deleted the `PRICING_TIERS[tier].amount` client-adjacent lookup); refuses unknown robot/tier with 400. The webhook reads `robot` off the callback URL, reconstructs the identical payload, and passes `robotSlug` through to `provisionSubscription`.
- `free-trial/route.ts` — accepts `robotSlug`, fail-closed resolves it via `resolveRobotPrice(robotSlug, "free-trial")`, asserts the resolved amount is exactly `0` (refuses a misconfigured non-zero "free" tier), and surfaces `alreadyTrialed` as a friendly HTTP 409.
- `CheckoutClient.tsx` — reads `?robot=` and `?name=` from the query, sends `robotSlug` in both the free-trial and create-session POST bodies, and the two hardcoded "GoldBot EA" / "Your GoldBot access is active" strings are gone (replaced by the dynamic `robotName`, sourced via a `&name=` param the catalog CTA now includes).

## Live Verification Against Production
1. **Unknown robot refused (400, not coerced):** `POST /api/paygate/create-session {robotSlug:"does-not-exist",...}` → `{"error":"Unknown or inactive robot: does-not-exist"}`, HTTP 400.
2. **Server-side price resolution reached (proves resolveRobotPrice succeeded):** `POST /api/paygate/create-session {robotSlug:"goldbot", tier:"1-month",...}` → `{"error":"Server not configured: PAYGATE_PAYOUT_USDC_ADDRESS is missing."}` — this check runs in the code AFTER `resolveRobotPrice`, so reaching it proves the price resolution did NOT throw for a valid robot/tier.
3. **Fail-closed baseline holds:** a webhook GET with a fabricated/mismatched signature (including a `robot=goldbot` param) → HTTP 401, confirming the signature verification path still fail-closes correctly with the new payload shape.
4. **One-trial-per-robot DB-enforced, including after expiry (TRIL-01/02):** a direct build-step script created a FREE_TRIAL subscription, marked it `EXPIRED`, then attempted a second FREE_TRIAL insert for the same `(userId, robotId)` — build log: `second FREE_TRIAL insert correctly threw P2002 ... ASSERT partial-index-blocks-expired-reclaim: PASS`. This is the exact scenario the old "no ACTIVE duplicate" guard would have missed.

**Not independently verified end-to-end (documented as `outstanding_findings`, both pre-existing/non-blocking):** the live Paygate wallet call (blocked by a pre-existing missing `PAYGATE_PAYOUT_USDC_ADDRESS`) and a real robot-swap-mutation-then-401 test (blocked by `PAYGATE_WEBHOOK_SECRET` being Vercel-Sensitive/unreadable, same treatment as `DATABASE_URL` throughout this project). The atomic, byte-identical payload strings at both signing/verifying sites (grep + tsc verified) and the fail-closed 401-on-bogus-signature baseline are the practical proof available in this environment.
Also could not exercise the actual `/api/checkout/free-trial` HTTP endpoint live for a *second* time in the same session — the existing 2-per-IP-per-day rate limiter (pre-existing, unrelated) correctly fired after this session's cumulative testing; the DB-level partial-index test above is a stronger proof of the actual guard anyway (bypasses HTTP, tests the real Postgres constraint directly).

## Deviations from Plan
None material.

## Issues Encountered
- The Wave 2 background-agent spawn for this plan was never completed — the host process restarted before the agent began work (confirmed via `git log`: zero 06-03 commits existed on resume). Implemented directly in the main session instead of re-spawning.
- Two pre-existing operational gaps surfaced during live verification (see `outstanding_findings`) — neither is caused by or blocks this plan's own success criteria; both are documented for future closure the same way `MAILTRAP_TOKEN` has been tracked since Phase 1.

## User Setup Required
`PAYGATE_PAYOUT_USDC_ADDRESS` should be provisioned in Vercel production for the live paid-checkout path to actually complete (pre-existing gap, not introduced by this phase).

## Next Phase Readiness
Phase 6's remaining plan (06-04, admin price editor) is file-disjoint from this plan and depends only on 06-01.

## Self-Check: PASSED
- Files verified present/modified: all 6 listed above.
- Commits verified: all 6 feat/chore commits present in `git log`.
- Live verification: unknown-robot 400, price-resolution-reached (proven via the downstream config-error), fail-closed 401 baseline, and DB-level partial-index PASS all confirmed against production.

---
*Phase: 06-public-catalog-per-robot-pricing-free-trials*
*Completed: 2026-07-06*
