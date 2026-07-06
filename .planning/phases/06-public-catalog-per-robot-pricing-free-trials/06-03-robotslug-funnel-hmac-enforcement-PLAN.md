---
phase: 06-public-catalog-per-robot-pricing-free-trials
plan: 03
type: execute
wave: 2
depends_on: [06-01]
files_modified:
  - src/lib/subscriptions.ts
  - src/app/api/paygate/create-session/route.ts
  - src/app/api/webhooks/paygate/route.ts
  - src/app/api/checkout/free-trial/route.ts
  - src/app/[locale]/checkout/CheckoutClient.tsx
autonomous: true

must_haves:
  truths:
    - "provisionSubscription requires a robotSlug param and fail-closed resolves it (no GOLDBOT_SLUG default) — an unknown/inactive robot is REFUSED, never coerced to GoldBot"
    - "The Paygate HMAC signature binds robotSlug in a fixed payload order `${orderRef}${email}${robotSlug}${tier}${amount}` in BOTH create-session (signs) and the webhook (reconstructs identically) — a swapped robotSlug on the callback fails signature verification (401)"
    - "create-session accepts robotSlug, resolves the server-authoritative amount from RobotPrice (resolveRobotPrice), refuses unknown robot/tier with HTTP 400, and puts robot=<slug> on the signed callback URL — the client NEVER supplies the price"
    - "The free-trial route accepts robotSlug, resolves it fail-closed (amount must be 0 for FREE_TRIAL), and provisions per-robot — a second free trial for the same (user, robot) is rejected with a friendly message via the partial-unique-index P2002 (not a 500)"
    - "A free trial subscription runs the full lifecycle identically to paid tiers, per-robot (same provisionSubscription path, per-robot robotId)"
    - "The checkout UI reads robot from the query, sends robotSlug to both endpoints, and shows the selected robot's name (not hardcoded 'GoldBot EA')"
  artifacts:
    - path: "src/lib/subscriptions.ts"
      provides: "provisionSubscription(robotSlug required) + FREE_TRIAL P2002 friendly handling"
      contains: "resolveRobotPrice"
    - path: "src/app/api/paygate/create-session/route.ts"
      provides: "robotSlug-bound signing + server-side price resolution"
      contains: "${orderRef}${email}${robotSlug}${tier}${amount}"
    - path: "src/app/api/webhooks/paygate/route.ts"
      provides: "robotSlug reconstruction into the same signed payload + pass to provision"
      contains: "${orderRef}${email}${robotSlug}${tier}${callbackAmount}"
    - path: "src/app/api/checkout/free-trial/route.ts"
      provides: "per-robot free-trial provisioning, fail-closed robot resolution"
      contains: "robotSlug"
  key_links:
    - from: "src/app/api/paygate/create-session/route.ts"
      to: "src/app/api/webhooks/paygate/route.ts"
      via: "identical HMAC payload string including robotSlug"
      pattern: "\\$\\{orderRef\\}\\$\\{email\\}\\$\\{robotSlug\\}\\$\\{tier\\}"
    - from: "src/app/api/webhooks/paygate/route.ts"
      to: "src/lib/subscriptions.ts provisionSubscription"
      via: "passes robotSlug through"
      pattern: "provisionSubscription\\("
    - from: "src/lib/subscriptions.ts"
      to: "src/lib/robot-pricing.ts resolveRobotPrice"
      via: "fail-closed robot+price resolution"
      pattern: "resolveRobotPrice\\("
    - from: "src/app/[locale]/checkout/CheckoutClient.tsx"
      to: "src/app/api/paygate/create-session/route.ts"
      via: "sends robotSlug in the POST body"
      pattern: "robotSlug"
---

<objective>
Thread `robotSlug` through the entire purchase funnel and make it a first-class, fail-closed, HMAC-bound identity — closing the phase's key security decision (robot-swap replay) and enabling true per-robot purchases + per-robot free trials.

Purpose: Satisfies phase success criteria 2 (checkout accepts robotSlug; unknown robot/tier refused, not coerced), 4 (one free trial per robot, server-enforced), and 5 (free trial runs the full per-robot lifecycle). Depends on 06-01's `resolveRobotPrice` + the partial trial index.

**SECURITY — atomic HMAC change (do NOT split):** the signature payload gains `robotSlug` in a fixed order `${orderRef}${email}${robotSlug}${tier}${amount}`. The signing site (`create-session`) and the verifying site (`webhook`) MUST change together in this one plan — if they land out of order, EVERY real Paygate callback 401s. Both sites carry an identical code comment documenting the exact payload order.

This plan is file-disjoint from 06-02 (catalog) and 06-04 (admin price editor) and depends only on 06-01, so it runs in parallel with them in Wave 2.

Output:
- `src/lib/subscriptions.ts` — `provisionSubscription` gains required `robotSlug`, drops `GOLDBOT_SLUG`, resolves via `resolveRobotPrice`, adds FREE_TRIAL P2002 friendly handling
- `src/app/api/paygate/create-session/route.ts` — accepts robotSlug, server-side price, robotSlug-bound signature + callback param
- `src/app/api/webhooks/paygate/route.ts` — reads robotSlug, reconstructs the identical signature, passes it to provision
- `src/app/api/checkout/free-trial/route.ts` — accepts + fail-closed-resolves robotSlug, friendly P2002 on duplicate trial
- `src/app/[locale]/checkout/CheckoutClient.tsx` — reads `?robot=`, sends robotSlug, shows selected robot name
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/06-public-catalog-per-robot-pricing-free-trials/6-RESEARCH.md
@.planning/phases/06-public-catalog-per-robot-pricing-free-trials/06-01-SUMMARY.md
@src/lib/subscriptions.ts
@src/lib/pricing-tiers.ts
@src/lib/webhook-signature.ts
@src/app/api/paygate/create-session/route.ts
@src/app/api/webhooks/paygate/route.ts
@src/app/api/checkout/free-trial/route.ts
@src/app/[locale]/checkout/CheckoutClient.tsx
@prisma/schema.prisma
@AGENTS.md
</context>

<critical_environment_notes>
- **Node:** prepend `export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"` for every node/npx/tsc/eslint call.
- **HMAC payload order is LOAD-BEARING.** The exact string is `` `${orderRef}${email}${robotSlug}${tier}${amount}` `` in create-session and `` `${orderRef}${email}${robotSlug}${tier}${callbackAmount}` `` in the webhook. `amount`/`callbackAmount` are the SAME formatted value (`amount.toFixed(2)` echoed on the URL; Paygate omits `value_coin` for USD). Both files must produce byte-identical payloads or callbacks 401. Put an identical comment block at both sites naming the order.
- **Never trust a client amount.** create-session computes `amount` from `resolveRobotPrice(robotSlug, tier).amount` (replacing `PRICING_TIERS[tier].amount`). The URL `amount` is only an echo for signature reconstruction; the authoritative number is the RobotPrice row.
- **Fail-closed everywhere (mirror UnknownTierError handling):** map `UnknownRobotError` / `UnknownRobotPriceError` (from `@/lib/robot-pricing`) to HTTP 400 in create-session, webhook, and free-trial — exactly as `UnknownTierError` is already mapped. Never fall back to GoldBot.
- **Trial uniqueness is DB-enforced (06-01 partial index).** The old "no ACTIVE dup" check permits re-claim after expiry — keep a pre-check only for a nice message, but rely on the P2002 from the partial index as the real guard. In `provisionSubscription`, wrap the `subscription.create` for FREE_TRIAL so a `P2002` becomes a friendly "You already used your free trial for this robot" result, not a 500. Note: the existing code has a broad idempotency guard on `paygateId` — free trials have no paygateId, so the trial P2002 path must be handled at the `subscription.create` call.
- **Backward-compat callers:** `provisionSubscription` is called from the webhook AND free-trial route (both updated here). Grep for any OTHER caller before changing the signature; update all. Adding `robotSlug` as a required param is intentional (drops the GoldBot default) — every caller must now pass it.
- **Next 16:** API routes + `"use client"` checkout are per AGENTS.md's diverging conventions — read `node_modules/next/dist/docs/` if unsure; otherwise the existing files are the template.
- **File disjointness:** do NOT touch `robots/actions.ts`, `RobotForm.tsx` (06-04), or `catalog/page.tsx` (06-02).
</critical_environment_notes>

<tasks>

<task type="auto">
  <name>Task 1: provisionSubscription requires robotSlug (drop GoldBot default) + FREE_TRIAL P2002 handling</name>
  <files>src/lib/subscriptions.ts</files>
  <action>
Refactor `provisionSubscription` to take a REQUIRED `robotSlug` and resolve the robot fail-closed via `resolveRobotPrice`, removing the `GOLDBOT_SLUG` constant and the `findUniqueOrThrow({ slug: GOLDBOT_SLUG })` block.

1. Import `resolveRobotPrice` (and the error classes if you want to re-map, though callers map them): `import { resolveRobotPrice } from "@/lib/robot-pricing";` and `import { Prisma } from "@prisma/client";`.
2. Change the signature to put `robotSlug` first among the new params (keep existing optional payment params). Recommended:
   ```ts
   export async function provisionSubscription(
     email: string,
     tierRaw: string,
     robotSlug: string,        // REQUIRED — no GoldBot default
     paygateId?: string,
     amount?: number,
     currency?: string,
   ) { ... }
   ```
   (This reorders params vs today — update BOTH callers in Tasks 2 & 4 accordingly. Do a repo grep to be sure there are no other callers.)
3. Replace the GoldBot resolution + `mapTier` call with a single fail-closed resolve:
   ```ts
   const { robot, tier } = await resolveRobotPrice(robotSlug, tierRaw);
   ```
   `resolveRobotPrice` throws `UnknownTierError` / `UnknownRobotError` / `UnknownRobotPriceError`; let them propagate so each route maps them to 400. Delete the now-unused direct `mapTier(tierRaw)` line and the `GOLDBOT_SLUG` constant + its comment.
4. Keep the existing `paygateId` idempotency short-circuit.
5. Keep the "already has an active <tier> subscription" pre-check (scoped to `robot.id`) — it still gives a nice duplicate message for paid tiers. But for FREE_TRIAL, the real guard is the DB partial index. Wrap the `subscription.create` so a `P2002` (from the trial index) returns a friendly duplicated result instead of throwing:
   ```ts
   let subscription;
   try {
     subscription = await prisma.subscription.create({
       data: { userId: user.id, robotId: robot.id, tier, expiresAt, status: "ACTIVE" },
     });
   } catch (err) {
     if (
       err instanceof Prisma.PrismaClientKnownRequestError &&
       err.code === "P2002" &&
       tier === "FREE_TRIAL"
     ) {
       // Partial unique index Subscription_one_free_trial_per_robot fired:
       // this user already claimed (ever) a free trial for this robot.
       return {
         userId: user.id,
         duplicated: true,
         alreadyTrialed: true,
         emailSuccess: true,
       };
     }
     throw err;
   }
   ```
   (Place `const expiresAt = computeExpirationDate(tier);` before the try, as today.)
6. Ensure the returned shape stays compatible with existing consumers (webhook spreads `...result`; free-trial reads `result.emailSuccess`). The `alreadyTrialed` field is additive.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
! grep -q 'GOLDBOT_SLUG' src/lib/subscriptions.ts && echo NO_GOLDBOT_DEFAULT_OK
grep -q 'resolveRobotPrice(robotSlug, tierRaw)' src/lib/subscriptions.ts && echo RESOLVE_OK
grep -q 'robotSlug: string' src/lib/subscriptions.ts && echo REQUIRED_PARAM_OK
grep -q "tier === \"FREE_TRIAL\"" src/lib/subscriptions.ts && grep -q 'P2002' src/lib/subscriptions.ts && echo TRIAL_P2002_OK
# confirm no stray other callers left unpatched (should only be webhook + free-trial after Tasks 2&4):
grep -rn 'provisionSubscription(' src/ | grep -v 'export async function'
npx tsc --noEmit && npx eslint src/lib/subscriptions.ts && echo LINT_OK
```
  </verify>
  <done>`provisionSubscription` requires `robotSlug`, resolves fail-closed via `resolveRobotPrice` (no GoldBot default), and turns a FREE_TRIAL partial-index P2002 into a friendly `duplicated/alreadyTrialed` result; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 2: robotSlug-bound HMAC — create-session signs + webhook verifies (ATOMIC)</name>
  <files>src/app/api/paygate/create-session/route.ts, src/app/api/webhooks/paygate/route.ts</files>
  <action>
Change BOTH signing and verifying sites in this single task so they never drift.

**2a. `create-session/route.ts`:**
- Extend `CreateSessionPayload` with `robotSlug?: string;` and read `const robotSlug = (body.robotSlug || "").trim().toLowerCase();`. If empty → HTTP 400 "Missing robotSlug." (fail-closed; no GoldBot default).
- Replace `import { TierId, PRICING_TIERS } from "@/config/pricing";` usage for the amount: compute the server-authoritative amount from RobotPrice. Add `import { resolveRobotPrice, UnknownRobotError, UnknownRobotPriceError } from "@/lib/robot-pricing";` and `import { UnknownTierError } from "@/lib/pricing-tiers";`. Wrap resolution in try/catch mapping the three errors → 400:
  ```ts
  let resolved;
  try {
    resolved = await resolveRobotPrice(robotSlug, tier);
  } catch (err) {
    if (err instanceof UnknownTierError || err instanceof UnknownRobotError || err instanceof UnknownRobotPriceError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
  const amount = resolved.amount.toFixed(2);
  ```
  (Keep the existing `free-trial` guard that rejects free-trial from Paygate checkout, and the `TIER_METADATA` validity check may stay or be subsumed by resolveRobotPrice — resolveRobotPrice's mapTier already rejects unknown tiers, so the explicit `tier in TIER_METADATA` check is now redundant but harmless; leave whichever keeps the diff minimal.)
- Add the robot to the callback URL: `callbackUrl.searchParams.set("robot", robotSlug);`.
- Change the signature payload (and its comment) to bind robotSlug in the fixed order:
  ```ts
  // PHASE 6 SECURITY: robotSlug is bound into the HMAC to block robot-swap replay.
  // Payload order is LOAD-BEARING and MUST match webhooks/paygate/route.ts byte-for-byte:
  //   `${orderRef}${email}${robotSlug}${tier}${amount}`
  const signaturePayload = `${orderRef}${email}${robotSlug}${tier}${amount}`;
  ```

**2b. `webhooks/paygate/route.ts`:**
- Read the robot slug back: `const robotSlug = (url.searchParams.get("robot") || "").trim().toLowerCase();`.
- Reconstruct the identical payload (same order, `callbackAmount` is the echoed `amount`):
  ```ts
  // PHASE 6 SECURITY: identical order to create-session/route.ts — MUST match byte-for-byte:
  //   `${orderRef}${email}${robotSlug}${tier}${callbackAmount}`
  const signaturePayload = `${orderRef}${email}${robotSlug}${tier}${callbackAmount}`;
  ```
- After signature verification + validations, require robotSlug present (400 "Missing robot parameter." if empty) and pass it through to provision:
  ```ts
  result = await provisionSubscription(email, tier, robotSlug, orderRef, amount, currency);
  ```
  (Note the new param ORDER: `robotSlug` before `orderRef` — matches Task 1's signature.)
- Extend the existing `catch` around `provisionSubscription` to also map `UnknownRobotError` / `UnknownRobotPriceError` → 400 (import them alongside `UnknownTierError`). Keep the WebhookDelivery replay/idempotency block unchanged.

Both comment blocks must name the exact same payload order string.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
CS="src/app/api/paygate/create-session/route.ts"; WH="src/app/api/webhooks/paygate/route.ts"
grep -q 'robotSlug' "$CS" && echo CS_SLUG_OK
grep -q 'resolveRobotPrice(robotSlug, tier)' "$CS" && echo CS_PRICE_OK
grep -qF '`${orderRef}${email}${robotSlug}${tier}${amount}`' "$CS" && echo CS_SIG_OK
grep -q 'searchParams.set("robot", robotSlug)' "$CS" && echo CS_CALLBACK_PARAM_OK
grep -q 'searchParams.get("robot")' "$WH" && echo WH_READ_SLUG_OK
grep -qF '`${orderRef}${email}${robotSlug}${tier}${callbackAmount}`' "$WH" && echo WH_SIG_OK
grep -q 'provisionSubscription(email, tier, robotSlug, orderRef, amount, currency)' "$WH" && echo WH_PROVISION_OK
grep -q 'UnknownRobotError' "$WH" && echo WH_ERRMAP_OK
npx tsc --noEmit && npx eslint "$CS" "$WH" && echo LINT_OK
```
  </verify>
  <done>Both sites bind `robotSlug` into the HMAC in the identical `${orderRef}${email}${robotSlug}${tier}${amount}` order (documented at both); create-session computes the amount from RobotPrice and refuses unknown robot/tier with 400; webhook reconstructs the signature, requires robot, passes it to provision, and maps the new errors to 400; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 3: Free-trial route + checkout UI thread robotSlug; live verification</name>
  <files>src/app/api/checkout/free-trial/route.ts, src/app/[locale]/checkout/CheckoutClient.tsx</files>
  <action>
**3a. `free-trial/route.ts`:**
- Read `robotSlug` from the body alongside `email`: `const { email, robotSlug } = body;`. Normalize `const slug = String(robotSlug || "").trim().toLowerCase();` and reject empty with 400 "Missing robotSlug." (fail-closed — no default robot).
- Fail-closed resolve the robot + assert the FREE_TRIAL price is 0 before provisioning (Pitfall 6 — free trial must not be claimable for an inactive/unpriced robot). Reuse `resolveRobotPrice(slug, "free-trial")`; import it plus the error classes. If `resolved.amount !== 0`, treat as misconfiguration → 400 (a free trial must cost 0). Map `UnknownRobotError`/`UnknownRobotPriceError`/`UnknownTierError` → 400, same as the paid route.
- Call `provisionSubscription(normalizedEmail, "free-trial", slug)` (new param order). Handle the `alreadyTrialed` result: if `result.duplicated && result.alreadyTrialed`, return a friendly 409/200 message "You already used your free trial for this robot." (NOT a 500).

**3b. `CheckoutClient.tsx`:**
- Read the robot slug from the query: `const robotSlug = searchParams?.get("robot") || "";`. If missing, keep behavior graceful but the funnel now expects it from the catalog CTA — surface a soft error or default only for display, never send an empty slug to the APIs (send it as-is; the server refuses empty).
- Include `robotSlug` in BOTH fetch bodies:
  - free-trial POST body: `{ email: ..., robotSlug }`
  - create-session POST body: `{ tier, email: ..., currency: "USD", robotSlug }`
- Replace the hardcoded product string `GoldBot EA` (line ~338) and the `Your GoldBot access is active` copy (line ~197) with the selected robot's name. Fetch the robot name: simplest is to accept it via query too (`&name=`) OR fetch a lightweight display value. Minimal approach: read an optional `?name=` param the catalog CTA can include, falling back to a neutral "your robot" if absent — do NOT hardcode GoldBot. (If adding `name` to the catalog CTA is preferred, note it for 06-02 alignment; otherwise a small client fetch to a public robot-name endpoint is acceptable — pick the lower-risk option and document it.)
- Keep the rest of the checkout flow intact.

**3c. Live verification (production, no local DB):**
- Deploy Wave 2 (coordinate a single `vercel --prod --yes` with 06-02/06-04 if landing together; else deploy this).
- Paid path signature integrity: `curl -sS -X POST https://<prod>/api/paygate/create-session -H 'Content-Type: application/json' -d '{"tier":"1-month","email":"verify-0603@al-ai-fx.xyz","currency":"USD","robotSlug":"goldbot"}'` → expect 200 with a `checkoutUrl` and `amount":"199.00"` (server-side RobotPrice), and the returned `callbackUrl` contains `robot=goldbot`.
- Unknown robot refused: same curl with `"robotSlug":"does-not-exist"` → expect HTTP 400 (UnknownRobotError), NOT a GoldBot fallback.
- Robot-swap replay blocked: take a valid callbackUrl from the 200 above, change `robot=goldbot` to `robot=someother` (keep the signature) and GET it → expect 401 Invalid signature (proves robotSlug is signed).
- Free-trial per-robot: POST `/api/checkout/free-trial` with `{email, robotSlug:"goldbot"}` for a fresh email → 201; repeat the SAME email+robot → friendly "already used your free trial" (partial-index P2002), NOT 500.
- Capture all four curl results into the SUMMARY.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
FT="src/app/api/checkout/free-trial/route.ts"; CO="src/app/[locale]/checkout/CheckoutClient.tsx"
grep -q 'robotSlug' "$FT" && echo FT_SLUG_OK
grep -q 'resolveRobotPrice' "$FT" && echo FT_RESOLVE_OK
grep -q 'provisionSubscription(normalizedEmail, "free-trial", slug)' "$FT" && echo FT_PROVISION_OK
grep -q 'alreadyTrialed' "$FT" && echo FT_DUP_MSG_OK
grep -q 'searchParams?.get("robot")' "$CO" && echo CO_READ_SLUG_OK
grep -q 'robotSlug' "$CO" && echo CO_SEND_SLUG_OK
! grep -q 'GoldBot EA' "$CO" && echo CO_NO_HARDCODE_OK
npx tsc --noEmit && npx eslint "$FT" "$CO" && echo LINT_OK
```
Plus captured live-curl evidence: paid 200 with server-side amount + `robot=goldbot` callback; unknown-robot 400; robot-swap 401; free-trial 201 then friendly duplicate.
  </verify>
  <done>Free-trial route fail-closed-resolves robotSlug (amount must be 0), provisions per-robot, and returns a friendly message on duplicate trial; checkout UI reads `?robot=`, sends robotSlug to both endpoints, and drops the hardcoded GoldBot strings; live curls prove server-side pricing, unknown-robot refusal, robot-swap 401, and one-trial-per-robot.</done>
</task>

</tasks>

<verification>
- `provisionSubscription` requires robotSlug, resolves fail-closed (no GoldBot default), friendly FREE_TRIAL P2002.
- HMAC binds robotSlug in identical order at create-session + webhook; robot-swap callback → 401.
- create-session computes amount server-side from RobotPrice; unknown robot/tier → 400.
- free-trial route accepts + fail-closed-resolves robotSlug (amount 0), friendly duplicate-trial message.
- checkout UI threads robotSlug to both endpoints; no hardcoded GoldBot product string.
- `npx tsc --noEmit` + `npx eslint` clean; four live curls pass.
</verification>

<success_criteria>
- CTLG-03 / PRIC-04: checkout accepts robotSlug, refuses unknown robot/tier (not coerced), computes price server-side.
- TRIL-01/TRIL-02: at most one free trial per robot, DB-enforced (partial index P2002), not client-only.
- TRIL-03 / PRIC-01: free trial runs the full per-robot lifecycle via the same provision path; robot-swap replay blocked by the signed slug.
</success_criteria>

<output>
After completion, create `.planning/phases/06-public-catalog-per-robot-pricing-free-trials/06-03-SUMMARY.md` with frontmatter: `phase`, `plan`, `status: complete`, `requirements: [CTLG-03, PRIC-01, PRIC-04, TRIL-01, TRIL-02, TRIL-03]`, `files_changed`, `commits`, `key_decisions` (HMAC payload order `${orderRef}${email}${robotSlug}${tier}${amount}` bound at both sites; provisionSubscription robotSlug REQUIRED, GOLDBOT_SLUG removed; server-side amount from RobotPrice never client-supplied; FREE_TRIAL P2002 → friendly duplicated/alreadyTrialed; free-trial route asserts amount 0) and `provides` — note the new `provisionSubscription(email, tierRaw, robotSlug, paygateId?, amount?, currency?)` signature and that the callback URL now carries a signed `robot=<slug>` param. Document any decision on how checkout obtains the robot display name.
</output>
