---
phase: 02-payment-pricing-launch-blockers
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/webhook-signature.ts
  - src/lib/webhook-signature.test.ts
  - src/app/api/webhooks/paygate/route.ts
  - src/app/api/paygate/create-session/route.ts
autonomous: false
user_setup:
  - service: vercel
    why: "PAYGATE_WEBHOOK_SECRET must land in Vercel prod env BEFORE code merge, otherwise create-session (now embeds signature) and webhook GET (now fail-closed) both 500 until the env var is present. Rollout order matters — this is the whole reason Task 1 is a checkpoint."
    env_vars:
      - name: PAYGATE_WEBHOOK_SECRET
        source: "Any strong random string (e.g. `openssl rand -hex 32`) — MUST match value used by any signature-embedded callback URL. If a prior test value was set, keep it (rotating breaks in-flight callbacks); if unset, generate fresh."
        scopes: ["production", "preview", "development"]

must_haves:
  truths:
    - "verifyPaygateSignature returns {ok: false, reason: 'no-secret'} when PAYGATE_WEBHOOK_SECRET is missing in production (fail-closed)"
    - "verifyPaygateSignature returns {ok: true} for a valid HMAC-SHA256 signature"
    - "verifyPaygateSignature returns {ok: false, reason: 'bad-signature'} for an invalid signature"
    - "verifyPaygateSignature returns {ok: false, reason: 'bad-length'} for a signature with wrong length (defeats timingSafeEqual pre-check)"
    - "Dev bypass requires TWO env keys: NODE_ENV !== 'production' AND PAYGATE_ALLOW_INSECURE_WEBHOOK === '1' — either alone must NOT enable bypass"
    - "GET /api/webhooks/paygate returns HTTP 401 on missing/invalid signature (not HTTP 200)"
    - "POST /api/webhooks/paygate is DELETED — Paygate.to never invokes it (dead code, verified via Paygate's own WordPress + WHMCS plugin source)"
    - "src/app/api/paygate/create-session embeds a signature query param in the registered callback URL so real Paygate callbacks pass fail-closed verification"
    - "curl to /api/webhooks/paygate without a signature returns 401 in production behavior"
    - "PAYGATE_WEBHOOK_SECRET is present in Vercel env BEFORE the code merge triggers deploy (rollout order)"
    - "Webhook GET route catches UnknownTierError (from Plan 02-01) → HTTP 400"
    - "create-session route catches UnknownTierError (from Plan 02-01) → HTTP 400"
  artifacts:
    - path: "src/lib/webhook-signature.ts"
      provides: "verifyPaygateSignature + VerifyResult type"
      exports: ["verifyPaygateSignature", "VerifyResult"]
      min_lines: 35
    - path: "src/lib/webhook-signature.test.ts"
      provides: "node:test coverage for missing-secret / missing-sig / bad-length / bad-sig / good-sig / dev-bypass paths"
      contains: "no-secret"
      min_lines: 60
    - path: "src/app/api/webhooks/paygate/route.ts"
      provides: "GET-only fail-closed webhook; POST handler deleted"
      contains: "verifyPaygateSignature"
    - path: "src/app/api/paygate/create-session/route.ts"
      provides: "Registered callback URL now includes signature query param"
      contains: "signature"
  key_links:
    - from: "src/app/api/webhooks/paygate/route.ts"
      to: "src/lib/webhook-signature.ts"
      via: "verifyPaygateSignature call before any provisioning logic"
      pattern: "verifyPaygateSignature\\("
    - from: "src/app/api/paygate/create-session/route.ts"
      to: "process.env.PAYGATE_WEBHOOK_SECRET"
      via: "createHmac to sign the callback URL"
      pattern: "createHmac.*PAYGATE_WEBHOOK_SECRET"
    - from: "src/app/api/webhooks/paygate/route.ts"
      to: "src/lib/pricing-tiers.ts (from Plan 02-01)"
      via: "catch (err instanceof UnknownTierError)"
      pattern: "UnknownTierError"
---

<objective>
Close SECR-01 — the fail-open Paygate webhook. Today `src/app/api/webhooks/paygate/route.ts:20-27` returns `true` from signature verification whenever `PAYGATE_WEBHOOK_SECRET` is missing (with only a `console.warn`). Since STATE.md confirms the secret is currently NOT in Vercel prod (`PAYGATE_WEBHOOK_SECRET` is in the "MISSING env vars" list), the endpoint is anonymously provisionable RIGHT NOW: `GET /api/webhooks/paygate?order_ref=X&email=me@evil.com&tier=lifetime-source&amount=79999` grants a `LIFETIME_SOURCE` subscription.

Also: research confirmed via Paygate.to's official WordPress + WHMCS plugin source that Paygate.to sends GET-only, no signature header, no timestamp — the entire POST handler at `route.ts:92-163` is dead code and MUST be deleted (attack surface, no legitimate caller).

Purpose:
1. Ship a `verifyPaygateSignature` helper that fail-closes when the secret is missing, uses `crypto.timingSafeEqual` (constant-time), and only permits bypass with an EXPLICIT two-key dev gate (`NODE_ENV !== "production"` AND `PAYGATE_ALLOW_INSECURE_WEBHOOK === "1"` — both, not either).
2. Rewrite `GET /api/webhooks/paygate/route.ts` to fail-closed on any verify failure (401) BEFORE any provisioning.
3. Delete the dead POST handler entirely (research finding — Paygate never calls it, POST body path is also a Vercel 4.5 MB body-limit hazard).
4. Update `src/app/api/paygate/create-session/route.ts` to embed the `signature` query param in the callback URL registered with Paygate — otherwise real Paygate callbacks fail verify.
5. Provision `PAYGATE_WEBHOOK_SECRET` in Vercel BEFORE the code merge (checkpoint gate) — otherwise both `create-session` AND webhook GET return 500 until the env var lands.
6. Wire `UnknownTierError` (from Plan 02-01) through both routes → HTTP 400 on unknown tier.

Output:
- New `src/lib/webhook-signature.ts` — `verifyPaygateSignature(payload, providedSig): VerifyResult`, fail-closed default, two-key dev bypass, `timingSafeEqual`
- New `src/lib/webhook-signature.test.ts` — six cases: missing-secret-prod, missing-secret-dev-with-bypass, missing-secret-dev-without-bypass, missing-sig, bad-length, bad-sig, good-sig
- Rewritten `src/app/api/webhooks/paygate/route.ts` — GET only; POST deleted; catches `UnknownTierError` → 400
- Updated `src/app/api/paygate/create-session/route.ts` — appends `signature` to registered callback URL; catches `UnknownTierError` → 400
- `PAYGATE_WEBHOOK_SECRET` set in Vercel prod (and preview + development) via `vercel env add` — verified by checkpoint before deploy
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
@src/app/api/webhooks/paygate/route.ts
@src/app/api/paygate/create-session/route.ts
@src/lib/subscriptions.ts
@src/config/pricing.ts
@src/lib/rate-limit.ts
@src/lib/validation.ts
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1 (preflight): Provision PAYGATE_WEBHOOK_SECRET in Vercel BEFORE code merge</name>
  <what-built>Nothing yet — this is the rollout-order gate. Task 2/3/4 must NOT ship code to `main` until this env var lands, because both `create-session` (Task 4: embeds signature — needs secret to sign) AND webhook GET (Task 3: fail-closed — rejects when secret missing) will 500 in production the instant the code merges without the env var present.</what-built>
  <why-checkpoint>
Setting Vercel env vars requires an authenticated `vercel env add` (interactive prompt for the secret value) OR the Vercel dashboard (browser). Claude has no unattended way to inject a secret value into the user's Vercel account — this is one of the rare 1% cases where a checkpoint is genuinely required. Sole reason the plan is `autonomous: false`.
  </why-checkpoint>
  <how-to-verify>
1. From the project directory run: `vercel env ls production | grep PAYGATE_WEBHOOK_SECRET` — should list the var as present.

2. If NOT present, add it via the Vercel CLI:
   ```bash
   # Generate a fresh secret if you don't have one (only if no prior test value exists):
   openssl rand -hex 32

   # Add to all three scopes (interactive prompt will accept the secret):
   vercel env add PAYGATE_WEBHOOK_SECRET production
   vercel env add PAYGATE_WEBHOOK_SECRET preview
   vercel env add PAYGATE_WEBHOOK_SECRET development
   ```

3. Confirm all three scopes:
   ```bash
   vercel env ls production | grep PAYGATE_WEBHOOK_SECRET
   vercel env ls preview | grep PAYGATE_WEBHOOK_SECRET
   vercel env ls development | grep PAYGATE_WEBHOOK_SECRET
   ```
   All three must return a line showing the var name.

4. Optionally pull it into local `.env` so `create-session` works in `next dev`:
   ```bash
   vercel env pull .env.local
   grep PAYGATE_WEBHOOK_SECRET .env.local
   ```

5. Note: If a prior test value exists (from earlier development), KEEP IT. Rotating it invalidates in-flight Paygate callbacks. Only generate a new value if the env var was never set.

Expected: after this checkpoint, `vercel env ls production` shows `PAYGATE_WEBHOOK_SECRET` before any Task 2/3/4 code lands on `main`. If for any reason the user cannot set this before merge, choose ONE of these fallbacks and communicate the choice:
- (a) merge with a temporary safe default that logs+alerts loudly (NOT fail-closed) — DEFERS SECR-01 to a follow-up; do NOT do this without explicit user consent.
- (b) do NOT merge Tasks 3+4 until the env var lands (recommended).
  </how-to-verify>
  <resume-signal>Reply "provisioned" (env var confirmed in all three Vercel scopes) OR "defer-secr01" (env var not yet provisioned — the executor will pause Tasks 3+4 and only ship Task 2's helper + tests, closing the loop when the env lands). Type "approved" as shorthand for "provisioned".</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Create verifyPaygateSignature helper + node:test coverage</name>
  <files>src/lib/webhook-signature.ts, src/lib/webhook-signature.test.ts</files>
  <action>
Create `src/lib/webhook-signature.ts` implementing the fail-closed HMAC-SHA256 verifier from 2-RESEARCH.md §Pattern 2. Use Node stdlib `crypto` — no new dependencies. This module has NO Prisma / no Next.js imports so it can be unit-tested with plain `node:test`.

```typescript
// src/lib/webhook-signature.ts
// Fail-closed HMAC-SHA256 verifier for Paygate.to GET callbacks.
//
// Design rules (see 2-RESEARCH.md §Pattern 2 and §Common Pitfall 3):
//   - No secret → verify FAILS (never returns true with a warning log).
//   - No signature → verify FAILS.
//   - Length mismatch → verify FAILS (before timingSafeEqual, which throws on
//     unequal-length buffers).
//   - Comparison uses crypto.timingSafeEqual (constant-time, defeats timing
//     side-channel bit-leaks that `===` would leak).
//   - Dev bypass requires TWO keys: NODE_ENV !== "production" AND
//     PAYGATE_ALLOW_INSECURE_WEBHOOK === "1". Either alone must NOT enable
//     bypass. This defeats the "we merged fail-open by accident" class of bug.
import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no-secret" | "no-signature" | "bad-length" | "bad-signature" };

export function verifyPaygateSignature(
  payload: string,
  providedSig: string | null | undefined,
): VerifyResult {
  const secret = process.env.PAYGATE_WEBHOOK_SECRET;

  if (!secret) {
    // Two-key dev bypass — NEITHER alone enables it.
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.PAYGATE_ALLOW_INSECURE_WEBHOOK === "1"
    ) {
      console.warn(
        "[paygate] insecure webhook bypass enabled — DEV ONLY (NODE_ENV=%s)",
        process.env.NODE_ENV,
      );
      return { ok: true };
    }
    console.error(
      "[paygate] PAYGATE_WEBHOOK_SECRET missing — refusing webhook (NODE_ENV=%s)",
      process.env.NODE_ENV,
    );
    return { ok: false, reason: "no-secret" };
  }

  if (!providedSig) return { ok: false, reason: "no-signature" };

  const expected = Buffer.from(
    createHmac("sha256", secret).update(payload).digest("hex"),
    "utf8",
  );
  const provided = Buffer.from(providedSig, "utf8");

  // timingSafeEqual REQUIRES equal-length buffers or it throws. Guard first.
  if (expected.length !== provided.length) return { ok: false, reason: "bad-length" };

  return timingSafeEqual(expected, provided)
    ? { ok: true }
    : { ok: false, reason: "bad-signature" };
}
```

Then create `src/lib/webhook-signature.test.ts` covering every reason code AND the dev-bypass two-key gate. Follow the project's `node:test` pattern.

```typescript
// src/lib/webhook-signature.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyPaygateSignature } from "./webhook-signature";

function signWith(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

// Every test manages env vars locally and restores them — avoid ordering deps.
function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) previous[key] = process.env[key];
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("fail-closed when secret is missing in production (SECR-01 regression)", () => {
  withEnv(
    {
      PAYGATE_WEBHOOK_SECRET: undefined,
      NODE_ENV: "production",
      PAYGATE_ALLOW_INSECURE_WEBHOOK: undefined,
    },
    () => {
      const result = verifyPaygateSignature("payload", "any-sig");
      assert.deepEqual(result, { ok: false, reason: "no-secret" });
    },
  );
});

test("fail-closed when secret is missing in production EVEN with bypass flag (SECR-01 regression)", () => {
  // Two-key gate: bypass flag alone must NOT enable bypass in production.
  withEnv(
    {
      PAYGATE_WEBHOOK_SECRET: undefined,
      NODE_ENV: "production",
      PAYGATE_ALLOW_INSECURE_WEBHOOK: "1",
    },
    () => {
      const result = verifyPaygateSignature("payload", "any-sig");
      assert.deepEqual(result, { ok: false, reason: "no-secret" });
    },
  );
});

test("fail-closed when NODE_ENV=development WITHOUT explicit bypass flag", () => {
  // Dev flag alone must NOT enable bypass — merging bypass would be too easy otherwise.
  withEnv(
    {
      PAYGATE_WEBHOOK_SECRET: undefined,
      NODE_ENV: "development",
      PAYGATE_ALLOW_INSECURE_WEBHOOK: undefined,
    },
    () => {
      const result = verifyPaygateSignature("payload", "any-sig");
      assert.deepEqual(result, { ok: false, reason: "no-secret" });
    },
  );
});

test("bypass ONLY when NODE_ENV!=production AND PAYGATE_ALLOW_INSECURE_WEBHOOK=1 (two-key gate)", () => {
  withEnv(
    {
      PAYGATE_WEBHOOK_SECRET: undefined,
      NODE_ENV: "development",
      PAYGATE_ALLOW_INSECURE_WEBHOOK: "1",
    },
    () => {
      const result = verifyPaygateSignature("payload", "any-sig");
      assert.deepEqual(result, { ok: true });
    },
  );
});

test("fail with 'no-signature' when signature param is null or empty", () => {
  withEnv({ PAYGATE_WEBHOOK_SECRET: "test-secret" }, () => {
    assert.deepEqual(verifyPaygateSignature("payload", null), { ok: false, reason: "no-signature" });
    assert.deepEqual(verifyPaygateSignature("payload", ""), { ok: false, reason: "no-signature" });
    assert.deepEqual(verifyPaygateSignature("payload", undefined), { ok: false, reason: "no-signature" });
  });
});

test("fail with 'bad-length' when signature length is wrong (timingSafeEqual precondition)", () => {
  withEnv({ PAYGATE_WEBHOOK_SECRET: "test-secret" }, () => {
    // Real HMAC-SHA256 hex is 64 chars — a 10-char input is length-mismatched.
    const result = verifyPaygateSignature("payload", "short-sig");
    assert.deepEqual(result, { ok: false, reason: "bad-length" });
  });
});

test("fail with 'bad-signature' when signature is same length but wrong bytes", () => {
  withEnv({ PAYGATE_WEBHOOK_SECRET: "test-secret" }, () => {
    // 64-char hex string that is NOT the real signature.
    const badSig = "a".repeat(64);
    const result = verifyPaygateSignature("payload", badSig);
    assert.deepEqual(result, { ok: false, reason: "bad-signature" });
  });
});

test("succeed with a valid HMAC-SHA256 signature", () => {
  withEnv({ PAYGATE_WEBHOOK_SECRET: "test-secret" }, () => {
    const payload = "orderRef123me@test.com1-year1799";
    const sig = signWith("test-secret", payload);
    assert.deepEqual(verifyPaygateSignature(payload, sig), { ok: true });
  });
});
```

Notes:
- Test file uses only `node:crypto` + `node:test` + `node:assert/strict` — no additional deps.
- The two-key gate tests ARE the compensating control for the "we shipped fail-open by accident" class of bug. Do not remove any of them.
- These tests must NOT depend on execution order. The `withEnv` helper snapshots/restores per-test.
  </action>
  <verify>
1. `test -f src/lib/webhook-signature.ts && test -f src/lib/webhook-signature.test.ts` — both files exist.
2. `npx tsc --noEmit` — TypeScript compilation must pass.
3. `node --test --experimental-strip-types src/lib/webhook-signature.test.ts` — ALL 8 tests pass. (Fallback if `--experimental-strip-types` unavailable: `npx tsx --test src/lib/webhook-signature.test.ts`.)
4. Expected output must include (as separate ok lines): "fail-closed when secret is missing in production", "fail-closed when secret is missing in production EVEN with bypass flag", "bypass ONLY when NODE_ENV!=production AND PAYGATE_ALLOW_INSECURE_WEBHOOK=1", "succeed with a valid HMAC-SHA256 signature".
5. `grep -n "return true" src/lib/webhook-signature.ts` — must return only the ONE ok:true line inside the dev-bypass conditional (verify by reading matched context). No `return true` at module scope, no `return true` outside a guard.
  </verify>
  <done>
`src/lib/webhook-signature.ts` exports `verifyPaygateSignature` and `VerifyResult`. Verifier is fail-closed on missing secret in production regardless of `PAYGATE_ALLOW_INSECURE_WEBHOOK`. Dev bypass requires BOTH keys. `src/lib/webhook-signature.test.ts` has ≥8 tests, all passing. No new npm dependencies added.
  </done>
</task>

<task type="auto">
  <name>Task 3: Rewrite GET webhook (fail-closed) + DELETE dead POST handler</name>
  <files>src/app/api/webhooks/paygate/route.ts</files>
  <action>
Rewrite `src/app/api/webhooks/paygate/route.ts` so it (a) delegates signature verification to the new module, (b) fail-closes on any verify failure, (c) catches `UnknownTierError` → 400, and (d) DELETES the POST handler entirely.

Rationale for POST deletion (from 2-RESEARCH.md §Pitfall 1 and §Sources): Paygate.to's official WordPress + WHMCS plugin source code confirms Paygate sends GET-only with `value_coin`, `coin`, `txid_in` appended to the merchant-registered callback URL. There is no `X-Paygate-Signature` header, no timestamp, no Paygate-issued nonce. The existing POST handler (route.ts:92-163) has NO legitimate caller — it is dead code AND an attack-surface hazard AND a Vercel 4.5 MB body-limit hazard.

The full new file (replace the entire current contents):

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { provisionSubscription } from "@/lib/subscriptions";
import { UnknownTierError } from "@/lib/pricing-tiers";
import { verifyPaygateSignature } from "@/lib/webhook-signature";
import { checkWebhookRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail, validateAmount } from "@/lib/validation";

// Paygate.to callback contract (verified against paygate-to/WooCommerce and
// paygate-to/WHMCS official plugin source):
//   GET /api/webhooks/paygate?order_ref=<ref>&email=<em>&tier=<t>&currency=<c>&amount=<a>&signature=<sig>&value_coin=<v>&coin=<c>&txid_in=<tx>
//
// Paygate itself does NOT sign these callbacks. The signature is merchant-side:
// create-session computes HMAC-SHA256(orderRef+email+tier+amount, PAYGATE_WEBHOOK_SECRET)
// and embeds it in the callback URL registered with Paygate. Any callback that
// arrives without a matching signature is either a replay from an old URL or
// an attacker's guess — both are 401.
//
// There is no POST handler here. Paygate does not call POST (verified via
// their WordPress + WHMCS plugin source). The former POST route was dead code.

export async function GET(req: Request) {
  const identifier = getClientIdentifier(req);
  const { success: rlOk } = await checkWebhookRateLimit(identifier);
  if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  try {
    const url = new URL(req.url);
    const orderRef = url.searchParams.get("order_ref") || "";
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();
    const tier = url.searchParams.get("tier") || "";
    const currency = (url.searchParams.get("currency") || "USD").toUpperCase();
    const callbackAmount =
      url.searchParams.get("value_coin") || url.searchParams.get("amount") || "0";
    const signature = url.searchParams.get("signature");

    // Fail-closed signature verify — must run BEFORE any DB work.
    const signaturePayload = `${orderRef}${email}${tier}${callbackAmount}`;
    const verified = verifyPaygateSignature(signaturePayload, signature);
    if (!verified.ok) {
      console.error(
        "[paygate] webhook rejected — reason=%s orderRef=%s",
        verified.reason,
        orderRef,
      );
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parameter validation — only after signature passes (avoid leaking parse
    // details to unauthenticated callers).
    if (!orderRef || !email) {
      return NextResponse.json(
        { error: "Missing required callback parameters." },
        { status: 400 },
      );
    }
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }
    const amount = Number.parseFloat(callbackAmount);
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return NextResponse.json({ error: amountValidation.error }, { status: 400 });
    }
    if (!tier) {
      // Explicit empty-tier check — mapTier's UnknownTierError would also fire,
      // but this gives a clearer error to legitimate misconfiguration.
      return NextResponse.json({ error: "Missing tier parameter." }, { status: 400 });
    }

    // NOTE: Replay + idempotency (WebhookDelivery.signature @unique + P2002
    // short-circuit) lands in Plan 02-03. THIS plan does NOT add it — Plan 02-03
    // will insert its logic between signature verify (above) and provisionSubscription
    // (below). Do NOT preempt that here.
    //
    // In the interim, provisionSubscription's existing Order.paygateId @unique
    // check (subscriptions.ts:104-108) provides one layer of idempotency: a
    // second delivery with the same orderRef returns { duplicated: true } without
    // creating a second Order.
    let result;
    try {
      result = await provisionSubscription(email, tier, orderRef, amount, currency);
    } catch (err) {
      if (err instanceof UnknownTierError) {
        // Never silently coerce — throw+catch is the whole point of Plan 02-01.
        console.error("[paygate] unknown tier — orderRef=%s tier=%s", orderRef, tier);
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    return NextResponse.json(
      { success: true, source: "paygate-get-callback", ...result },
      { status: 200 },
    );
  } catch (error) {
    console.error("Paygate GET callback error:", error);
    return NextResponse.json(
      { error: "Webhook payload processing failed." },
      { status: 500 },
    );
  }
}

// POST handler intentionally not exported — dead code deleted (Paygate.to sends
// GET-only per their WordPress + WHMCS plugin source). If Paygate ever documents
// a POST path, resurrect via git history under the same fail-closed pattern.
```

Key changes vs the current file:
1. `verifyWebhookSignature` (local, fail-open) DELETED — replaced by `verifyPaygateSignature` import from `@/lib/webhook-signature`.
2. The old `createHmac` import DELETED (no longer used in this file).
3. `provisionPayment` wrapper DELETED — was single-caller. Now inlined as `provisionSubscription(email, tier, orderRef, amount, currency)`.
4. Entire `POST` handler DELETED (lines 92-163 of the current file).
5. `UnknownTierError` import + try/catch around `provisionSubscription` — HTTP 400 on unknown tier (this closes the caller-side half of PRIC-02 for the webhook path).
6. `prisma` import added — Plan 02-03 will use it for `WebhookDelivery.create` inside this route. Adding the import now is a zero-cost forward-compatibility move that avoids a merge conflict when 02-03 lands. If unused-import lint complains, add `// eslint-disable-next-line @typescript-eslint/no-unused-vars` above the import with the comment `// used by Plan 02-03 replay-protection`. Prefer to leave it in.

Do NOT add the `WebhookDelivery` create + `P2002` catch here — that is Plan 02-03's responsibility. Comment placement inside the handler (see NOTE block above) makes the insertion point explicit for the 02-03 executor.
  </action>
  <verify>
1. `grep -n "export async function POST" src/app/api/webhooks/paygate/route.ts` — must return NOTHING (POST handler deleted).
2. `grep -n "return true" src/app/api/webhooks/paygate/route.ts` — must return NOTHING (fail-open gone).
3. `grep -n "verifyPaygateSignature" src/app/api/webhooks/paygate/route.ts` — must show one import + one call site inside `GET`.
4. `grep -n "UnknownTierError" src/app/api/webhooks/paygate/route.ts` — must show one import + one instanceof.
5. `npx tsc --noEmit` — TypeScript compilation must pass.
6. `npx eslint src/app/api/webhooks/paygate/route.ts` — must pass (may need the `unused import` disable comment on `prisma` if that check is strict — see action notes).
7. Local behavior smoke (requires Task 1's env var):
   - `NODE_ENV=production PAYGATE_WEBHOOK_SECRET=test curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/webhooks/paygate?order_ref=x&email=y@z.com&tier=1-month&amount=199"` — must print `401` (no signature).
   - `NODE_ENV=production PAYGATE_WEBHOOK_SECRET=test curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/webhooks/paygate?order_ref=x&email=y@z.com&tier=1-month&amount=199&signature=$(printf 'xy@z.com1-month199' | openssl dgst -sha256 -hmac test -hex | awk '{print $2}')"` — must print `200` (valid signature). NOTE: this smoke test will actually provision — run against dev DB only, or accept the test row.
   - `NODE_ENV=production unset PAYGATE_WEBHOOK_SECRET; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/webhooks/paygate?order_ref=x&email=y@z.com&tier=1-month&amount=199&signature=whatever"` — must print `401` (fail-closed on missing secret in production).
   - POST attempt: `curl -X POST -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/webhooks/paygate"` — must print `405` (Next.js's Method Not Allowed since POST is no longer exported).
  </verify>
  <done>
Webhook route is GET-only. Fail-open code path is GONE (`verifyWebhookSignature` local function deleted; `return true`-on-missing-secret gone). Signature is verified via imported `verifyPaygateSignature`. Unknown tier → HTTP 400 (not 500). POST handler is completely absent from the file. `prisma` import present as a stub for Plan 02-03's replay/idempotency work. Curl smoke tests confirm fail-closed behavior.
  </done>
</task>

<task type="auto">
  <name>Task 4: Embed signature query param in create-session's registered callback URL + catch UnknownTierError</name>
  <files>src/app/api/paygate/create-session/route.ts</files>
  <action>
Update `src/app/api/paygate/create-session/route.ts` so the callback URL registered with Paygate INCLUDES a `signature` query param. Without this, real Paygate GET callbacks would arrive with no signature and fail the (now fail-closed) webhook verify.

Also wire `UnknownTierError` (from Plan 02-01) through the tier check → HTTP 400. Currently the check is a `hasOwnProperty` gate at line 39 that already catches this — but the mismatch between "tier valid in config" (hasOwnProperty) and "tier valid per pricing-tiers.ts" would be a future foot-gun. Since Plan 02-01 has already made `TIER_METADATA` the source of truth, use it directly.

Edit the top imports of `src/app/api/paygate/create-session/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";
import { TierId, PRICING_TIERS } from "@/config/pricing";
import { TIER_METADATA } from "@/lib/pricing-tiers";
```

Then edit the tier-validity check (currently line 39) to use `TIER_METADATA` (the SSoT from Plan 02-01) instead of a raw `hasOwnProperty` on `PRICING_TIERS`:

Replace:
```typescript
if (!Object.prototype.hasOwnProperty.call(PRICING_TIERS, tier)) {
  return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
}
```

With:
```typescript
// Use TIER_METADATA (single source of truth from Plan 02-01) — refuses unknown
// tiers instead of coercing. Same rejection as the webhook route's UnknownTierError catch.
if (!(tier in TIER_METADATA)) {
  return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
}
```

Then, after building `callbackUrl` with `order_ref`, `tier`, `email`, `currency`, `amount` (currently lines 63-68), add a signature-computation block BEFORE `walletUrl` is constructed:

Replace the current block from line 63 through line 72:

```typescript
    const callbackUrl = new URL("/api/webhooks/paygate", callbackBase);
    callbackUrl.searchParams.set("order_ref", orderRef);
    callbackUrl.searchParams.set("tier", tier);
    callbackUrl.searchParams.set("email", email);
    callbackUrl.searchParams.set("currency", currency);
    callbackUrl.searchParams.set("amount", amount);

    const walletUrl = new URL(PAYGATE_WALLET_ENDPOINT);
    walletUrl.searchParams.set("address", payoutAddress);
    walletUrl.searchParams.set("callback", callbackUrl.toString());
```

With:

```typescript
    const callbackUrl = new URL("/api/webhooks/paygate", callbackBase);
    callbackUrl.searchParams.set("order_ref", orderRef);
    callbackUrl.searchParams.set("tier", tier);
    callbackUrl.searchParams.set("email", email);
    callbackUrl.searchParams.set("currency", currency);
    callbackUrl.searchParams.set("amount", amount);

    // Sign the callback with HMAC-SHA256 so the webhook's fail-closed verifier
    // (src/lib/webhook-signature.ts) accepts it. The payload MUST match the
    // string reconstructed on the receiving side: `${orderRef}${email}${tier}${amount}`.
    // Any drift here silently 401s legitimate callbacks in production.
    const webhookSecret = process.env.PAYGATE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Fail-closed BEFORE we spend an API call on Paygate's wallet endpoint.
      // In production this means create-session returns 500 until Vercel env is
      // provisioned — which is the whole point of the rollout order in Task 1.
      console.error("[paygate] create-session cannot sign callback: PAYGATE_WEBHOOK_SECRET missing");
      return NextResponse.json(
        { error: "Server not configured: PAYGATE_WEBHOOK_SECRET is missing." },
        { status: 500 },
      );
    }
    const signaturePayload = `${orderRef}${email}${tier}${amount}`;
    const signature = createHmac("sha256", webhookSecret)
      .update(signaturePayload)
      .digest("hex");
    callbackUrl.searchParams.set("signature", signature);

    const walletUrl = new URL(PAYGATE_WALLET_ENDPOINT);
    walletUrl.searchParams.set("address", payoutAddress);
    walletUrl.searchParams.set("callback", callbackUrl.toString());
```

Keep the rest of the file unchanged. The `walletUrl` fetch, `paymentUrl` construction, and JSON response stay as-is.

Note on the `PRICING_TIERS` import: after the change, `PRICING_TIERS[tier].amount` at (current) line 55 is still used to compute `amount` — DO NOT remove that import. The check-side switch to `TIER_METADATA` is purely additive on the metadata module.

Note for the executor: TIER_METADATA is defined in Plan 02-01 (Wave 1, parallel with this plan). Both plans complete in Wave 1; execute-phase's Wave 1 parallel runner guarantees both files are on disk BEFORE Task 4 runs `tsc --noEmit`. If this plan's Task 4 somehow runs before 02-01's Task 2 (out-of-order parallel bug), the `import { TIER_METADATA }` will fail to resolve — in that case, block on 02-01 and retry.
  </action>
  <verify>
1. `grep -n "createHmac.*webhookSecret\|createHmac.*PAYGATE_WEBHOOK_SECRET" src/app/api/paygate/create-session/route.ts` — must show one call (the HMAC sign of the callback payload).
2. `grep -n "signature" src/app/api/paygate/create-session/route.ts` — must show the `callbackUrl.searchParams.set("signature", signature)` line.
3. `grep -n "TIER_METADATA" src/app/api/paygate/create-session/route.ts` — must show one import + one `if (!(tier in TIER_METADATA))` check.
4. `grep -n "hasOwnProperty" src/app/api/paygate/create-session/route.ts` — must return NOTHING (old check replaced).
5. `npx tsc --noEmit` — TypeScript compilation must pass. This is the moment of truth for the 02-01 ↔ 02-02 parallel wave — if 02-01's `TIER_METADATA` export exists, this passes.
6. Manual walkthrough (paper-verify, no live Paygate call): given `orderRef="abc"`, `email="user@test.com"`, `tier="1-month"`, `amount="199.00"`, `PAYGATE_WEBHOOK_SECRET="secret"`, the callback URL contains `signature=` followed by 64 hex chars matching `createHmac("sha256","secret").update("abcuser@test.com1-month199.00").digest("hex")`. Confirm the payload string concatenation order matches the webhook route's `signaturePayload` in Task 3 EXACTLY — any drift silently breaks production.
  </verify>
  <done>
`src/app/api/paygate/create-session/route.ts` signs the callback URL with HMAC-SHA256 using `PAYGATE_WEBHOOK_SECRET` and embeds the result as a `signature` query param. Tier validation uses `TIER_METADATA` (single source of truth). Route returns 500 with a clear error if `PAYGATE_WEBHOOK_SECRET` is missing (fail-closed, matches the rollout-order requirement from Task 1). Signature payload string ORDER matches the webhook GET's reconstruction exactly: `${orderRef}${email}${tier}${amount}`.
  </done>
</task>

</tasks>

<verification>
Overall Plan 02-02 verification (proves SECR-01 is closed):

1. **Env var provisioned:** `vercel env ls production | grep PAYGATE_WEBHOOK_SECRET` shows the var present (Task 1 checkpoint).
2. **Verifier unit tests pass:** `node --test --experimental-strip-types src/lib/webhook-signature.test.ts` — 8 tests green including the three fail-closed regression tests + the two-key gate test.
3. **Webhook GET fail-closes:**
   - Curl to `/api/webhooks/paygate` WITHOUT the secret env var set → HTTP 401 (fail-closed on missing secret).
   - Curl WITH secret but no signature param → HTTP 401 (no-signature).
   - Curl WITH secret AND matching signature → HTTP 200 (or the appropriate error from downstream tier/email validation).
4. **POST handler removed:** `grep -n "export async function POST" src/app/api/webhooks/paygate/route.ts` returns nothing. `curl -X POST /api/webhooks/paygate` → HTTP 405 Method Not Allowed.
5. **Create-session signs callback:** New `signature` query param present in `callbackUrl.toString()` (paper-verified by tracing the code; live-verified by triggering a checkout in dev and inspecting the constructed URL in server logs).
6. **UnknownTierError → 400:** Webhook GET and create-session both surface `UnknownTierError` as HTTP 400 (grep + inspection).
7. **No new npm deps:** `git diff package.json` should be empty for this plan (Task 2 uses only Node stdlib).
</verification>

<success_criteria>
SECR-01 closed:
- [x] Paygate webhook rejects (HTTP error, no provisioning) when `PAYGATE_WEBHOOK_SECRET` is missing in production — fail-closed, not fail-open with a warning log.

Acceptance metrics:
- `verifyPaygateSignature` in `src/lib/webhook-signature.ts` returns `{ok: false, reason: "no-secret"}` when secret missing in production (unit test)
- Webhook GET returns HTTP 401 in all failure modes (missing sig, wrong sig, missing secret) — curl-verified
- Webhook POST handler DELETED (grep-verified) — attack surface removed
- `PAYGATE_WEBHOOK_SECRET` present in Vercel env (Task 1 checkpoint completed)
- create-session embeds `signature` in callback URL (grep + paper-verified)
- Both routes surface `UnknownTierError` as HTTP 400 (closes the caller-side half of PRIC-02 that Plan 02-01's helper doesn't reach on its own)

Rollout dependency: Task 1 (env var) MUST land BEFORE Task 3+4 deploy — otherwise create-session and webhook GET both 500 the moment the code merges to main.
</success_criteria>

<output>
After completion, create `.planning/phases/02-payment-pricing-launch-blockers/02-02-fail-closed-webhook-signature-SUMMARY.md` following `/Users/klev/.claude/get-shit-done/templates/summary.md`. Include in frontmatter:
- `requirements_closed: [SECR-01]`
- `partial_requirements_closed: [PRIC-02]  # caller-side UnknownTierError → 400 for webhook + create-session`
- `subsystem: payments-webhook`
- `key_files: [src/lib/webhook-signature.ts, src/lib/webhook-signature.test.ts, src/app/api/webhooks/paygate/route.ts, src/app/api/paygate/create-session/route.ts]`
- `deleted: [POST handler in src/app/api/webhooks/paygate/route.ts (lines 92-163 of old file — dead code, Paygate.to never invoked it)]`
- `env_vars_added: [PAYGATE_WEBHOOK_SECRET]`
- `decisions:` bullet list capturing (a) two-key dev bypass (both NODE_ENV!=production AND PAYGATE_ALLOW_INSECURE_WEBHOOK=1 required), (b) POST handler deleted per Paygate.to's plugin source (dead code), (c) create-session fail-closes on missing secret (500) rather than shipping unsigned callbacks Paygate would then fail-verify, (d) TIER_METADATA is the SSoT for tier validity (replaces hasOwnProperty check).
</output>
