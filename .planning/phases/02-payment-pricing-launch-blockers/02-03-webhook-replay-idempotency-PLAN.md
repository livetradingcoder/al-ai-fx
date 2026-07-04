---
phase: 02-payment-pricing-launch-blockers
plan: 03
type: execute
wave: 2
depends_on: ["02-01", "02-02"]
files_modified:
  - prisma/schema.prisma
  - src/app/api/webhooks/paygate/route.ts
  - src/lib/webhook-delivery.test.ts
autonomous: true

must_haves:
  truths:
    - "A replayed Paygate webhook (same signature) is rejected with HTTP 200 duplicated:true — never double-provisions"
    - "Two concurrent identical webhook deliveries produce exactly ONE Order and ONE Subscription (race-safe via DB unique constraint)"
    - "Prisma WebhookDelivery model exists with signature @unique + orderRef + receivedAt columns"
    - "The first-ever delivery for a legitimate signature creates a WebhookDelivery row AND proceeds to provisionSubscription"
    - "A second delivery of the same signature short-circuits via P2002 catch → 200 duplicated:true (never reaches provisionSubscription)"
    - "The confirmation email is sent AT MOST ONCE per signature (verified two ways: WebhookDelivery short-circuit at webhook layer + existing Order.paygateId @unique short-circuit in provisionSubscription)"
    - "prisma db push has run against remote Coolify Postgres so WebhookDelivery table exists"
    - "Non-P2002 database errors in the create WebhookDelivery call propagate (no accidental swallow)"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "WebhookDelivery model with @unique signature + orderRef index"
      contains: "model WebhookDelivery"
    - path: "src/app/api/webhooks/paygate/route.ts"
      provides: "GET handler with prisma.webhookDelivery.create + P2002 catch inserted between signature verify and provisionSubscription"
      contains: "prisma.webhookDelivery.create"
    - path: "src/lib/webhook-delivery.test.ts"
      provides: "node:test coverage for the P2002-in-catch idempotency pattern (unit-tests the pattern, not the route)"
      contains: "P2002"
      min_lines: 40
  key_links:
    - from: "src/app/api/webhooks/paygate/route.ts"
      to: "prisma.webhookDelivery (WebhookDelivery model)"
      via: "create() inside try/catch on Prisma.PrismaClientKnownRequestError code P2002"
      pattern: "prisma\\.webhookDelivery\\.create"
    - from: "src/app/api/webhooks/paygate/route.ts"
      to: "@prisma/client Prisma namespace"
      via: "instanceof Prisma.PrismaClientKnownRequestError check for code === 'P2002'"
      pattern: "P2002"
---

<objective>
Close SECR-02 (replay rejection) and SECR-03 (webhook idempotency). Today the webhook has ZERO replay protection: an attacker (or a Paygate retry storm) hitting `GET /api/webhooks/paygate?...&signature=<captured-sig>` a second time re-invokes `provisionSubscription`. `provisionSubscription` has a partial idempotency guard via `Order.paygateId @unique` (see `subscriptions.ts:104-108`) — a duplicate paygateId short-circuits BEFORE the email block — but that guarantee assumes we ever reach `provisionSubscription` in the first place, which is not a design principle we want to rely on for webhook auth.

The correct architecture (per 2-RESEARCH.md §Pattern 3 and industry-standard webhook idempotency, e.g. Hookdeck's guide): a Prisma `WebhookDelivery` table with `signature @unique`. On webhook arrival AFTER signature verify, immediately try to `create` a row keyed by the callback signature. If Postgres throws `P2002` (unique constraint violation), this delivery is a replay — return HTTP 200 with `duplicated: true` (so Paygate stops retrying). Only if create succeeds do we proceed to `provisionSubscription`. This is race-safe across concurrent retries because Postgres handles the unique-index check atomically — the "check-then-act" race between `findFirst` + `create` doesn't exist.

Purpose:
1. Extend `prisma/schema.prisma` with a `WebhookDelivery` model (`id`, `signature @unique`, `orderRef`, `receivedAt`).
2. `prisma db push` to remote Coolify Postgres.
3. Insert the `prisma.webhookDelivery.create` + `P2002`-in-catch short-circuit into `src/app/api/webhooks/paygate/route.ts` GET handler (into the NOTE-block insertion point left by Plan 02-02).
4. Add unit tests exercising the P2002-in-catch pattern.

Output:
- `prisma/schema.prisma` — new `WebhookDelivery` model
- Updated `src/app/api/webhooks/paygate/route.ts` — replay short-circuit inserted between signature verify and provisionSubscription
- New `src/lib/webhook-delivery.test.ts` — validates the P2002 catch pattern shape (stubs Prisma, does not require a live DB)
- Schema pushed to remote Coolify Postgres via `prisma db push`
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-payment-pricing-launch-blockers/2-RESEARCH.md
@.planning/phases/02-payment-pricing-launch-blockers/02-01-pricing-tier-alignment-PLAN.md
@.planning/phases/02-payment-pricing-launch-blockers/02-02-fail-closed-webhook-signature-PLAN.md
@prisma/schema.prisma
@src/app/api/webhooks/paygate/route.ts
@src/lib/subscriptions.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add WebhookDelivery model to schema.prisma + push to remote Postgres</name>
  <files>prisma/schema.prisma</files>
  <action>
Append a new `WebhookDelivery` model to `prisma/schema.prisma`. Place it AFTER the existing `WorkerHeartbeat` model (currently at lines 109-114 in the current schema) — no upstream model has a relation to it, so ordering is cosmetic but grouping infrastructure-only models together helps readability.

```prisma
/// One row per authenticated Paygate GET callback delivery.
///
/// The `signature` field is the natural per-delivery nonce: it embeds
/// PAYGATE_WEBHOOK_SECRET via HMAC-SHA256 over ${orderRef}${email}${tier}${amount},
/// so it is deterministic per legitimate order but unforgeable without the secret.
/// A `P2002` on insert = this delivery is a replay of a signature we've already
/// processed → webhook GET returns 200 duplicated:true without provisioning.
///
/// Closes SECR-02 (replay rejection) and SECR-03 (idempotency).
model WebhookDelivery {
  id         String   @id @default(cuid())
  signature  String   @unique
  orderRef   String
  receivedAt DateTime @default(now())

  @@index([orderRef])
  @@index([receivedAt]) // supports future cleanup cron (deferred — see 2-RESEARCH.md Open Q 3)
}
```

Notes on field choices:
- `signature @unique` — the UNIQUE INDEX is the entire mechanism. Without it, the pattern degenerates into a check-then-act race.
- `orderRef` — NOT unique (a legitimate order can produce multiple callback URL versions if `create-session` is retried by the user; the `signature` differs even if `orderRef` matches). Indexed for support lookups.
- `receivedAt` — default now. Indexed to support the future cleanup cron mentioned in research (skip for Phase 2 unless row count grows > 100k).
- No `orderId` FK — a replayed delivery has no legitimate Order to link to, and a first-time delivery's Order is created downstream. Leaving this out keeps the model independent of the Order lifecycle.
- No `receivedAtIP` / no rate-limit metadata — out of scope for SECR-02/03. Rate limiting is already handled by `checkWebhookRateLimit` in the route.

After editing:

```bash
npx prisma generate
npx prisma db push
```

Per STATE.md: `db push` is the established Phase 2 pattern (Phase 3 introduces `prisma/migrations/`). Do NOT run `prisma migrate dev`.

Because this is an ADD-only schema change, `db push` MUST report "in sync" or "table created" without any data-loss warning. If it warns about data loss, STOP and investigate — we did not intend to alter existing tables.

NOTE ON PARALLEL WAVE 1: Plan 02-01 (Task 1) also ran `prisma db push` earlier in Wave 1. The schema on disk when THIS task starts already contains 02-01's extended `PricingTier` enum. `db push` at this point publishes both 02-01's enum extension (already in remote) AND this task's `WebhookDelivery` table (new). The `enum PricingTier` block MUST already be extended per 02-01 — verify by grepping BEFORE the push.
  </action>
  <verify>
1. `grep -n "TEN_DAYS\|ONE_YEAR\|LIFETIME_SOURCE" prisma/schema.prisma` — must show all three (proves 02-01's Wave 1 push landed and this schema is on top of it). If missing, STOP — 02-01 did not complete.
2. `grep -n "model WebhookDelivery" prisma/schema.prisma` — must show one match.
3. `grep -n "signature  String   @unique\|signature String @unique" prisma/schema.prisma` — must show one match inside the WebhookDelivery block.
4. `npx prisma generate` — must succeed and produce a client with `prisma.webhookDelivery.create` in the type surface.
5. `npx prisma db push` — must print "in sync" (or "table created" on first run). If it reports data loss, STOP.
6. `node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); console.log(typeof p.webhookDelivery.create); p.$disconnect();"` — must print `function`, proving the model made it into the generated client.
  </verify>
  <done>
`prisma/schema.prisma` has a `WebhookDelivery` model with `signature @unique`, `orderRef`, `receivedAt`, and the two indexes. Remote Coolify Postgres has the `WebhookDelivery` table. Generated Prisma client exposes `prisma.webhookDelivery.create`. Existing tables (User, Subscription, Order, Compilation, WorkerHeartbeat) are unaffected — additive schema change only.
  </done>
</task>

<task type="auto">
  <name>Task 2: Insert P2002 short-circuit into webhook GET (between verify and provisionSubscription)</name>
  <files>src/app/api/webhooks/paygate/route.ts</files>
  <action>
Edit `src/app/api/webhooks/paygate/route.ts` (post-02-02 state) to insert the `prisma.webhookDelivery.create` + `P2002`-in-catch short-circuit at the NOTE-block insertion point that Plan 02-02 left. Do NOT change anything else in the file — the fail-closed verify (Plan 02-02) stays at the top, the `UnknownTierError` catch (Plan 02-02) stays at the bottom.

First, add the `Prisma` namespace to the existing `@prisma/client` import area. Since Plan 02-02 added `import { prisma } from "@/lib/prisma"`, add ONE more import line:

```typescript
import { Prisma } from "@prisma/client";
```

Place it immediately after the existing `import { prisma } from "@/lib/prisma"` line.

Then locate the NOTE block Plan 02-02 left (search for the string `Replay + idempotency`). It sits between the parameter-validation block and the `let result; try { result = await provisionSubscription(...) } catch (err) { ... }` block. Replace the NOTE comment AND the subsequent `let result; try { ... } catch { ... }` block with:

```typescript
    // Replay + idempotency: signature is a natural per-delivery nonce (embeds
    // PAYGATE_WEBHOOK_SECRET). Try to record the delivery; on P2002 (unique
    // constraint violation), this is a replay — return 200 duplicated:true
    // WITHOUT calling provisionSubscription. Race-safe across concurrent
    // Paygate retries because Postgres handles the unique-index check atomically.
    //
    // Non-null assertion on `signature`: verifyPaygateSignature already returned
    // { ok: false, reason: "no-signature" } when signature was null/empty, so if
    // we reach here `signature` is a valid string.
    try {
      await prisma.webhookDelivery.create({
        data: {
          signature: signature!,
          orderRef,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Legitimate replay. Return 200 so Paygate stops retrying.
        console.log(
          "[paygate] duplicate delivery — orderRef=%s (P2002 short-circuit)",
          orderRef,
        );
        return NextResponse.json(
          { success: true, duplicated: true, source: "paygate-get-callback" },
          { status: 200 },
        );
      }
      // Non-P2002 DB errors propagate to the outer catch → 500. Do NOT swallow.
      throw err;
    }

    // First-time delivery — safe to provision. provisionSubscription's own
    // Order.paygateId @unique check (subscriptions.ts:104-108) is a second layer
    // that also short-circuits duplicates without sending a second confirmation
    // email, but the WebhookDelivery guard above prevents us from ever reaching
    // that path on a replay.
    let result;
    try {
      result = await provisionSubscription(email, tier, orderRef, amount, currency);
    } catch (err) {
      if (err instanceof UnknownTierError) {
        console.error("[paygate] unknown tier — orderRef=%s tier=%s", orderRef, tier);
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    return NextResponse.json(
      { success: true, source: "paygate-get-callback", ...result },
      { status: 200 },
    );
```

Preserve the outer try/catch that Plan 02-02 wrote (converts uncaught errors into 500). Preserve the rate-limit and signature-verify blocks above the insertion. Preserve the parameter-validation calls (`validateEmail`, `validateAmount`, orderRef/email/tier presence checks).

Anti-patterns to AVOID during this edit:
- Do NOT wrap the WebhookDelivery.create in a `findFirst` first — that's the "check-then-act" race the P2002-in-catch pattern exists to eliminate.
- Do NOT return 4xx on the P2002 branch — sender webhook retriers hammer non-2xx. Return 200.
- Do NOT catch generic `Error` in the WebhookDelivery try block — only the P2002 branch is a legitimate replay; anything else is a real DB failure and MUST propagate.
- Do NOT re-order this block AFTER `provisionSubscription`. Replay short-circuit MUST run BEFORE the provisioning call — the whole point is to avoid the provisioning call on replays.
- Do NOT store the raw email or PII in the log line beyond what's already logged (`orderRef` is fine — it's a UUID, not PII).
  </action>
  <verify>
1. `grep -n "prisma.webhookDelivery.create" src/app/api/webhooks/paygate/route.ts` — must show one match.
2. `grep -n "P2002" src/app/api/webhooks/paygate/route.ts` — must show one match.
3. `grep -n "duplicated: true" src/app/api/webhooks/paygate/route.ts` — must show one match in the P2002 branch.
4. `grep -n "import { Prisma }" src/app/api/webhooks/paygate/route.ts` — must show the added import.
5. `grep -n "findFirst\|findUnique" src/app/api/webhooks/paygate/route.ts` — must return NOTHING (proves we didn't accidentally regress to check-then-act pattern).
6. Verify ordering by hand-inspection of the file: (a) rate-limit → (b) parse params → (c) verifyPaygateSignature → (d) param validation → (e) prisma.webhookDelivery.create + P2002 catch → (f) provisionSubscription + UnknownTierError catch → (g) return success. If (e) is anywhere other than BETWEEN (d) and (f), fix.
7. `npx tsc --noEmit` — must pass. Proves the Prisma type surface exposes `webhookDelivery.create` (would fail if Task 1's schema push didn't happen).
8. Live smoke (requires `PAYGATE_WEBHOOK_SECRET=<value>` and a running dev server against a dev DB with the new table):
   - First curl with valid signature → HTTP 200, `success: true` (provisions).
   - Immediate second curl with the SAME URL → HTTP 200, `duplicated: true` (short-circuits at the P2002 branch, does not double-provision).
   - Query DB: `SELECT count(*) FROM "WebhookDelivery" WHERE "orderRef" = '<test-ref>';` returns 1. `SELECT count(*) FROM "Order" WHERE "paygateId" = '<test-ref>';` returns 1. Not 2.
  </verify>
  <done>
Webhook GET handler contains the P2002-in-catch idempotency block between signature verify and provisionSubscription. Two identical deliveries produce one WebhookDelivery row, one Order row, one Subscription row, one confirmation email. Non-P2002 DB errors propagate (do not silently return 200). `Prisma` namespace imported alongside `prisma` singleton. TypeScript + live smoke both pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Unit-test the P2002-in-catch idempotency pattern (stubbed Prisma)</name>
  <files>src/lib/webhook-delivery.test.ts</files>
  <action>
Create `src/lib/webhook-delivery.test.ts` — a unit test that exercises the SHAPE of the P2002-in-catch pattern using a stubbed Prisma. This test does NOT require a live DB; it validates that the pattern correctly (a) treats a `P2002`-code `PrismaClientKnownRequestError` as a duplicate, (b) treats other Prisma errors as fatal, (c) treats non-Prisma errors as fatal, and (d) treats a successful create as a first-time delivery.

The route handler itself is a Next.js integration boundary that this project has zero existing integration-test infrastructure for (no supertest, no @vercel/next test harness, no next-test setup — see `.planning/codebase/TESTING.md` if present, or observe the current test files under `src/lib/*.test.ts`). So the appropriate test is at the pattern level, not the route level.

Extract the shape into a small tested helper `recordWebhookDelivery` in this new file, then verify against a stub. This helper is optional to actually IMPORT into the route (it's a 5-line pattern; inlining in the route is fine) — but writing it as a testable function documents the intended behavior and gives us regression coverage.

```typescript
// src/lib/webhook-delivery.test.ts
//
// Unit tests for the P2002-in-catch idempotency pattern used by the Paygate
// webhook GET handler. See src/app/api/webhooks/paygate/route.ts for the
// production use site, and 2-RESEARCH.md §Pattern 3 for the design.
//
// These tests validate the PATTERN. The route handler inlines the same shape
// (import { Prisma } and use prisma.webhookDelivery.create in a try/catch on
// err.code === "P2002"). If the pattern changes here, mirror in the route.
import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

// Local, testable helper that mirrors the route's P2002-in-catch shape.
// Consumers pass a `create` function (typically `prisma.webhookDelivery.create`)
// and receive either { firstDelivery: true } or { firstDelivery: false, duplicate: true }.
type CreateFn = () => Promise<unknown>;

export async function recordWebhookDelivery(
  create: CreateFn,
): Promise<{ firstDelivery: true } | { firstDelivery: false; duplicate: true }> {
  try {
    await create();
    return { firstDelivery: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { firstDelivery: false, duplicate: true };
    }
    throw err;
  }
}

test("first-time delivery: create succeeds → firstDelivery: true", async () => {
  const create: CreateFn = async () => ({ id: "row1" });
  const result = await recordWebhookDelivery(create);
  assert.deepEqual(result, { firstDelivery: true });
});

test("duplicate delivery: P2002 → duplicate: true (SECR-02 replay rejection)", async () => {
  const create: CreateFn = async () => {
    // Simulate Prisma's exact P2002 shape. Constructor signature varies across
    // Prisma major versions; use PrismaClientKnownRequestError from @prisma/client
    // which we know is available at ^6.19.3.
    throw new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`signature`)",
      { code: "P2002", clientVersion: "6.19.3", meta: { target: ["signature"] } },
    );
  };
  const result = await recordWebhookDelivery(create);
  assert.deepEqual(result, { firstDelivery: false, duplicate: true });
});

test("non-P2002 Prisma error propagates (do NOT silently return 200)", async () => {
  const create: CreateFn = async () => {
    throw new Prisma.PrismaClientKnownRequestError(
      "Some other DB failure",
      { code: "P2003", clientVersion: "6.19.3" }, // foreign key constraint, not unique
    );
  };
  await assert.rejects(() => recordWebhookDelivery(create), Prisma.PrismaClientKnownRequestError);
});

test("non-Prisma errors propagate (do NOT accidentally swallow real crashes)", async () => {
  const create: CreateFn = async () => {
    throw new TypeError("connection lost");
  };
  await assert.rejects(() => recordWebhookDelivery(create), TypeError);
});
```

Notes:
- The `Prisma.PrismaClientKnownRequestError` constructor signature took `{ code, clientVersion, meta? }` in Prisma 5+ (still true in 6.x). Verify by reading `node_modules/@prisma/client/runtime/library.d.ts` if the type-check fails — if the shape changed, adapt the two-arg form.
- These tests are NOT flaky and do NOT require any DB — the `create` fn is a Promise-returning stub.
- The exported `recordWebhookDelivery` helper is available if the route wants to use it, but the route CAN continue to inline the pattern. Both are correct — the test file is the contract.
  </action>
  <verify>
1. `test -f src/lib/webhook-delivery.test.ts` — file exists.
2. `npx tsc --noEmit` — compiles. If the `PrismaClientKnownRequestError` constructor signature is different in the installed Prisma version, adapt the two-arg form based on `node_modules/@prisma/client/runtime/library.d.ts`.
3. `node --test --experimental-strip-types src/lib/webhook-delivery.test.ts` — ALL 4 tests pass. (Fallback: `npx tsx --test src/lib/webhook-delivery.test.ts`.)
4. Test output must include the 4 named tests: `first-time delivery`, `duplicate delivery`, `non-P2002 Prisma error propagates`, `non-Prisma errors propagate`.
5. `grep -n "recordWebhookDelivery\|P2002" src/lib/webhook-delivery.test.ts` — must show both name AND code.
  </verify>
  <done>
`src/lib/webhook-delivery.test.ts` has 4 tests, all passing under `node:test`. The exported `recordWebhookDelivery` helper documents the P2002-in-catch pattern shape (matching what the route inlines). Failure modes covered: first-time success, P2002 duplicate, non-P2002 Prisma error, non-Prisma error.
  </done>
</task>

</tasks>

<verification>
Overall Plan 02-03 verification (proves SECR-02 and SECR-03 are closed):

1. **Schema deployed:** `WebhookDelivery` table exists in remote Coolify Postgres. `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='WebhookDelivery';` returns `id`, `signature`, `orderRef`, `receivedAt`. Unique index on `signature` exists: `SELECT indexname FROM pg_indexes WHERE tablename='WebhookDelivery';` includes a unique index over `(signature)`.

2. **Route contains the pattern:** `grep -c "prisma.webhookDelivery.create" src/app/api/webhooks/paygate/route.ts` = 1. `grep -c "P2002" src/app/api/webhooks/paygate/route.ts` = 1. `grep -c "duplicated: true" src/app/api/webhooks/paygate/route.ts` = 1.

3. **Pattern unit tests pass:** `node --test --experimental-strip-types src/lib/webhook-delivery.test.ts` — 4 tests pass.

4. **Live idempotency smoke** (`PAYGATE_WEBHOOK_SECRET=<value>` set, dev server running):
   ```bash
   # Compute a valid signature for the test payload
   SIG=$(printf 'test-order-refuser@test.com1-month199' | openssl dgst -sha256 -hmac "$PAYGATE_WEBHOOK_SECRET" -hex | awk '{print $2}')
   URL="http://localhost:3000/api/webhooks/paygate?order_ref=test-order-ref&email=user@test.com&tier=1-month&currency=USD&amount=199&signature=$SIG"

   # First delivery — should provision
   curl -s "$URL" | jq
   # Expect: { "success": true, ..., "duplicated": ...false or absent }

   # Second identical delivery — should short-circuit
   curl -s "$URL" | jq
   # Expect: { "success": true, "duplicated": true, "source": "paygate-get-callback" }
   ```

5. **Live DB counts** (after the two curls above):
   ```sql
   SELECT count(*) FROM "WebhookDelivery" WHERE "orderRef" = 'test-order-ref';  -- 1
   SELECT count(*) FROM "Order" WHERE "paygateId" = 'test-order-ref';           -- 1
   SELECT count(*) FROM "Subscription" WHERE "userId" = (SELECT id FROM "User" WHERE email = 'user@test.com'); -- 1
   ```

6. **Concurrent replay** (bonus, if `wrk` or `xargs -P` available): fire 10 identical curls in parallel to the same URL → exactly 1 provision (1 Order, 1 Subscription, 1 WebhookDelivery), 9 `duplicated: true` responses. This is the race-safety proof.
</verification>

<success_criteria>
SECR-02 closed:
- [x] A replayed Paygate webhook payload (same signature) is rejected without double-fulfilling an order.

SECR-03 closed:
- [x] Repeating a legitimate webhook delivery for the same order is idempotent — one `Order`, one `Subscription`, one confirmation email.

Acceptance metrics:
- `WebhookDelivery` model exists in schema with `signature @unique` (grep-verified)
- Remote Postgres has the table + unique index (SQL-verified)
- Webhook GET returns 200 `duplicated: true` on second identical delivery (curl-verified)
- Race-safety verified by concurrent-curl smoke test (bonus) OR by inspection of the pattern (P2002 is atomic in Postgres)
- Two identical deliveries → exactly one row in each of `WebhookDelivery`, `Order`, `Subscription` (SQL-verified)
- Non-P2002 errors propagate (unit-tested)
- No accidental `findFirst`-before-`create` regression (grep-verified: file contains no `findFirst` or `findUnique` calls added by this plan)
</success_criteria>

<output>
After completion, create `.planning/phases/02-payment-pricing-launch-blockers/02-03-webhook-replay-idempotency-SUMMARY.md` following `/Users/klev/.claude/get-shit-done/templates/summary.md`. Include in frontmatter:
- `requirements_closed: [SECR-02, SECR-03]`
- `subsystem: payments-webhook`
- `key_files: [prisma/schema.prisma, src/app/api/webhooks/paygate/route.ts, src/lib/webhook-delivery.test.ts]`
- `schema_changes: [added model WebhookDelivery]`
- `decisions:` bullet list capturing (a) `signature @unique` chosen as natural nonce (over an in-memory Set or a client-generated nonce header), (b) P2002-in-catch chosen over `findFirst`-then-`create` (race-safe), (c) duplicates return 200 not 4xx (Paygate retries stop on 2xx), (d) `orderRef` NOT unique (multiple legitimate signatures per order possible after create-session retry), (e) `receivedAt` indexed for future cleanup cron but cleanup deferred (research Open Q 3).

Also: Phase 2 is COMPLETE after this plan's SUMMARY lands. Update `.planning/STATE.md` current-position to reflect Phase 2 completion in a follow-up commit (that's the orchestrator's job, not this plan's).
</output>
