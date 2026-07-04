# Phase 2: Payment + Pricing Launch Blockers — Research

**Researched:** 2026-07-04
**Domain:** Payment webhook security (fail-closed / replay / idempotency) + `PricingTier` enum ↔ `config/pricing.ts` alignment
**Confidence:** HIGH (Paygate.to contract verified in official plugin source; Next.js 16 route conventions verified from bundled `node_modules/next/dist/docs/`; Prisma error semantics verified via docs)

## Summary

Phase 2 has two orthogonal launch blockers, both silent (they don't crash — they leak revenue / access). The pricing side is a three-way drift bug: `src/config/pricing.ts` advertises **8 tier slugs**, `PricingTier` enum has **5 values**, and `mapTier()`'s `default` branch silently coerces `10-days`, `1-year`, `lifetime-source` down to `ONE_MONTH`. The fix is a single-source-of-truth pattern: extend the Prisma enum to match the config surface, rewrite `mapTier` as a total function (throwing on unknown input), and refactor `computeExpirationDate` as a TypeScript exhaustive switch guarded by `assertNever` so any future enum extension fails to compile until every tier's expiry is defined.

The webhook side is more nuanced than "add HMAC verification" because I verified — by reading Paygate.to's official WordPress and WHMCS plugin source — that **Paygate.to does not sign its own IPN callbacks**. Paygate sends `GET` with `value_coin`, `coin`, `txid_in` appended to whatever URL the merchant registered when creating the wallet; there is no `X-Paygate-Signature` header, no timestamp, no Paygate-supplied nonce. The security model is: the merchant embeds an unguessable per-order token in the callback URL and Paygate blindly appends payment fields when hitting it. Paygate's own official plugins implement replay/tamper protection as a **merchant-side HMAC(orderId, per-order-nonce) → `sig` query param** they emit and verify themselves. This is the same pattern our code already follows in spirit (`orderRef` acts as the per-order token; `signature` param is HMAC over `orderRef+email+tier+amount`), but the current implementation is fail-open (`return true` when secret missing) and has no replay protection. Meanwhile the entire `POST` handler with `x-paygate-signature` header in `src/app/api/webhooks/paygate/route.ts:92-163` is **dead code** — Paygate.to never invokes it and no client-side code posts to it. The recommendation is: keep only `GET`, harden signature verification to fail-closed, and add replay/idempotency via a new `WebhookDelivery` table keyed on the callback signature (natural nonce) or on `Order.paygateId` unique + a first-write-wins state machine.

**Primary recommendation:** Two focused plans plus one cleanup: **(A)** extend `PricingTier` enum to cover all 8 tier IDs, rewrite `mapTier`+`computeExpirationDate` as total functions with `assertNever`, and validate the tier on both `create-session` and webhook entry; **(B)** rewrite `/api/webhooks/paygate/route.ts` — delete the POST handler, make the GET handler fail-closed on missing secret in production, add a `WebhookDelivery` table with `@unique` on the callback signature for replay rejection, and short-circuit provisioning inside a single Prisma transaction so double delivery of an already-processed order is a no-op that returns 200 (never 500, or Paygate will hammer us).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Client | `@prisma/client ^6.19.3` (already installed) | Enum + `@@unique` constraint + `P2002` error semantics | Existing DB layer; `Prisma.PrismaClientKnownRequestError.code === 'P2002'` is the idiomatic race-safe idempotency signal |
| Node `crypto` (stdlib) | Node ≥ 20 (bundled with Next 16) | `createHmac`, `timingSafeEqual`, `randomUUID` | No external dep needed; Snyk / GitHub / Stripe all use this exact API for webhook verify |
| Node `node:test` + `node:assert/strict` | Node stdlib | Unit tests for `mapTier`, `computeExpirationDate`, signature verify | Project already uses `node:test` in `src/lib/*.test.ts` (magic-links, pricing-showcase, seo, marketing). No new test framework needed. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript `never` type | 5.x (installed) | Exhaustive switch guard | Around `PricingTier` switches so adding an enum value without updating expiry math fails to compile |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `PricingTier` enum (adding `TEN_DAYS`, `ONE_YEAR`, `LIFETIME_SOURCE`) | Data-driven `Tier` table in Postgres | Data-driven is Phase 6 territory (`PRIC-01` / `PRIC-04` — admin-editable per-robot prices). In Phase 2 we're pre-multi-robot; keeping enum + config in lockstep is 3 files vs a schema migration + admin UI. **Decision: extend the enum now, refactor to data-driven in Phase 6 when we already have to migrate to per-robot pricing.** |
| Custom in-memory replay map | `WebhookDelivery` DB row w/ `@unique(signature)` | In-memory is per-serverless-instance and evaporates on cold start (same class of bug as `InMemoryRateLimiter` — see CONCERNS.md). DB unique constraint is race-safe across concurrent Paygate retries and durable across cold starts. |
| Application-level "have we seen this?" `findFirst` then `create` | `create` inside try/catch on `P2002` | The check-then-act pattern is a race — two concurrent Paygate retries hitting the same order both see "not seen" and both provision. `P2002`-in-catch is atomic and idempotent-by-construction. |
| Rejecting duplicate deliveries with 4xx | Returning 200 OK on duplicate | Paygate.to has no documented retry contract, but every mainstream webhook provider retries on non-2xx. Returning 4xx on a legitimate retry causes the sender to keep hammering. Duplicate = 200 with `duplicated: true` (as the current code already does for POST — reuse this for GET). |

**Installation:** No new npm packages required. Everything is stdlib + already-installed `@prisma/client`.

## Architecture Patterns

### Recommended Project Structure

Additions/edits, not a re-layout:

```
prisma/
├── schema.prisma             # + extend PricingTier enum, + WebhookDelivery model
src/
├── config/
│   └── pricing.ts            # source of truth for tier slugs (unchanged surface)
├── lib/
│   ├── pricing-tiers.ts      # NEW — bidirectional TierId ↔ PricingTier mapping + expiry
│   ├── subscriptions.ts      # mapTier + computeExpirationDate MOVED to pricing-tiers.ts;
│   │                         # subscriptions.ts keeps only provisionSubscription orchestration
│   ├── pricing-tiers.test.ts # NEW — node:test coverage for every tier slug
│   ├── webhook-signature.ts  # NEW — HMAC verify with timingSafeEqual, fail-closed
│   └── webhook-signature.test.ts # NEW — coverage: missing secret, missing sig, bad sig, good sig
└── app/api/
    ├── webhooks/paygate/route.ts       # rewritten GET; POST handler DELETED
    └── paygate/create-session/route.ts # + include signature in registered callback URL
```

### Pattern 1: Single Source of Truth for Tier Metadata
**What:** Every tier's slug, USD amount, price string, `PricingTier` enum value, and duration-in-days live in one exported map keyed by `TierId`. `mapTier` looks up the map; `computeExpirationDate` looks up the map; the map is exhaustive over `TierId` (enforced by `Record<TierId, TierMetadata>`).

**When to use:** Now. Three drift points (`config/pricing.ts`, `PricingTier` enum, `mapTier`+`computeExpirationDate`) are exactly the problem PRIC-02 targets.

**Example:**
```typescript
// src/lib/pricing-tiers.ts
import { PricingTier } from "@prisma/client";
import type { TierId } from "@/config/pricing";

export interface TierMetadata {
  enum: PricingTier;
  amount: number;
  priceString: string;
  durationDays: number | "lifetime";
}

// Record<TierId, ...> guarantees every TierId slug is present.
// Adding a slug to TierId in config/pricing.ts forces this map to grow — TS error otherwise.
export const TIER_METADATA: Record<TierId, TierMetadata> = {
  "free-trial":       { enum: PricingTier.FREE_TRIAL,       amount:     0, priceString: "$0",      durationDays: 3 },
  "10-days":          { enum: PricingTier.TEN_DAYS,         amount:    69, priceString: "$69",     durationDays: 10 },
  "1-month":          { enum: PricingTier.ONE_MONTH,        amount:   199, priceString: "$199",    durationDays: 30 },
  "6-months":         { enum: PricingTier.SIX_MONTHS,       amount:   999, priceString: "$999",    durationDays: 182 },
  "1-year":           { enum: PricingTier.ONE_YEAR,         amount:  1799, priceString: "$1,799",  durationDays: 365 },
  "lifetime":         { enum: PricingTier.LIFETIME,         amount:  7999, priceString: "$7,999",  durationDays: "lifetime" },
  "lifetime-source":  { enum: PricingTier.LIFETIME_SOURCE,  amount: 79999, priceString: "$79,999", durationDays: "lifetime" },
  "secret-test":      { enum: PricingTier.SECRET_TEST_TIER, amount:    10, priceString: "$10",     durationDays: 7 },
};

export function mapTier(tierRaw: string): PricingTier {
  const meta = TIER_METADATA[tierRaw as TierId];
  if (!meta) {
    // Callers (webhook, checkout) MUST return HTTP 400 on this throw.
    throw new UnknownTierError(`Unknown pricing tier: ${tierRaw}`);
  }
  return meta.enum;
}

export function computeExpirationDate(tier: PricingTier): Date {
  // Exhaustive switch — assertNever fires at compile time if PricingTier grows.
  const now = new Date();
  switch (tier) {
    case PricingTier.FREE_TRIAL:       return addDays(now, 3);
    case PricingTier.TEN_DAYS:         return addDays(now, 10);
    case PricingTier.ONE_MONTH:        return addMonths(now, 1);
    case PricingTier.SIX_MONTHS:       return addMonths(now, 6);
    case PricingTier.ONE_YEAR:         return addYears(now, 1);
    case PricingTier.LIFETIME:
    case PricingTier.LIFETIME_SOURCE:  return addYears(now, 100);
    case PricingTier.SECRET_TEST_TIER: return addDays(now, 7);
    default: return assertNever(tier);
  }
}

function assertNever(x: never): never {
  throw new Error(`Non-exhaustive PricingTier switch: ${JSON.stringify(x)}`);
}
```
Source pattern: [Discriminated Unions and Exhaustiveness Checking in TypeScript (Fullstory)](https://www.fullstory.com/blog/discriminated-unions-and-exhaustiveness-checking-in-typescript/); Node date arithmetic pattern is stdlib.

### Pattern 2: Fail-Closed HMAC Verification with `timingSafeEqual`
**What:** The verify function returns `false` — and the route returns 401 — whenever *any* of {secret missing, signature header/query missing, signature length mismatch, `timingSafeEqual` fails}. The only escape hatch is an explicit `PAYGATE_ALLOW_INSECURE_WEBHOOK=1` env AND `NODE_ENV !== 'production'`.

**When to use:** Every path in `/api/webhooks/paygate/route.ts`. This is `SECR-01`.

**Example:**
```typescript
// src/lib/webhook-signature.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no-secret" | "no-signature" | "bad-length" | "bad-signature" };

export function verifyPaygateSignature(payload: string, providedSig: string | null): VerifyResult {
  const secret = process.env.PAYGATE_WEBHOOK_SECRET;

  if (!secret) {
    // Explicit dev bypass. Anything less explicit is a footgun (see current fail-open bug).
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.PAYGATE_ALLOW_INSECURE_WEBHOOK === "1"
    ) {
      console.warn("[paygate] insecure webhook bypass enabled — DEV ONLY");
      return { ok: true };
    }
    console.error("[paygate] PAYGATE_WEBHOOK_SECRET missing — refusing webhook");
    return { ok: false, reason: "no-secret" };
  }

  if (!providedSig) return { ok: false, reason: "no-signature" };

  const expected = Buffer.from(
    createHmac("sha256", secret).update(payload).digest("hex"),
    "utf8",
  );
  const provided = Buffer.from(providedSig, "utf8");

  // timingSafeEqual requires equal-length buffers — a length mismatch itself is a fail.
  if (expected.length !== provided.length) return { ok: false, reason: "bad-length" };
  return timingSafeEqual(expected, provided)
    ? { ok: true }
    : { ok: false, reason: "bad-signature" };
}
```
Sources: [Snyk — verifying webhook signatures](https://snyk.io/blog/verifying-webhook-signatures/); [Node.js `crypto.timingSafeEqual`](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b) (constant-time comparison to defeat statistical timing attacks); [GitHub docs — validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) — same `timingSafeEqual`-with-length-check pattern.

### Pattern 3: DB-Level Idempotency via `@@unique` + `P2002`
**What:** Replay and duplicate-fulfilment protection lives in a Prisma unique index, not in application code. On webhook arrival, immediately try to `create` a `WebhookDelivery` row keyed by the callback signature (which is a natural per-delivery nonce because it embeds the per-order secret). If create throws `P2002`, this delivery is a replay — return 200 no-op. Only if create succeeds do we proceed to `provisionSubscription`. That itself is already idempotent via `Order.paygateId @unique` (existing schema).

**When to use:** `SECR-02` (replay) and `SECR-03` (idempotency). This is race-safe across concurrent Paygate retries because Postgres handles the unique-constraint check atomically.

**Example:**
```typescript
// inside /api/webhooks/paygate/route.ts GET handler
import { Prisma } from "@prisma/client";

const provided = url.searchParams.get("signature");
const verified = verifyPaygateSignature(signaturePayload, provided);
if (!verified.ok) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}

// Replay check: signature is the natural nonce (per-order secret is baked in).
try {
  await prisma.webhookDelivery.create({
    data: {
      signature: provided!,   // provided is non-null here (verified.ok implies it)
      orderRef,
      receivedAt: new Date(),
    },
  });
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    // Replay: silently accept with 200 so Paygate stops retrying.
    return NextResponse.json({ success: true, duplicated: true }, { status: 200 });
  }
  throw err;
}

// First-time delivery — safe to provision.
const result = await provisionPayment({ email, tierRaw: tier, amount, currency, paygateId: orderRef });
return NextResponse.json({ success: true, ...result }, { status: 200 });
```

Schema addition:
```prisma
model WebhookDelivery {
  id         String   @id @default(cuid())
  signature  String   @unique          // natural nonce — embeds per-order secret
  orderRef   String                    // for observability / support lookups
  receivedAt DateTime @default(now())

  @@index([orderRef])
}
```

Sources: [Prisma error reference — P2002](https://www.prisma.io/docs/orm/reference/error-reference#p2002); [Webhook idempotency at Hookdeck](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency) — same "unique constraint on event ID, treat P2002 as duplicate" pattern.

### Anti-Patterns to Avoid

- **`return true` when secret missing.** This is the current bug (`route.ts:24-27`). Any misconfig — Vercel env not set, secret rotation gap, staging accidentally hitting prod URL — becomes an anonymous provisioning endpoint. `return false` fail-closed is the only safe default.
- **`===` comparison of signatures.** JS `===` short-circuits on the first mismatched character, leaking bits about the correct signature via timing. Always `timingSafeEqual`.
- **`JSON.parse` before signature verify.** The signature is computed over exact bytes. Re-serializing changes property order / whitespace and the signatures never match. Always `req.text()` (raw) → verify → `JSON.parse`. Current POST handler does this correctly; keep the pattern if we ever add a POST path.
- **Application-level "seen it" check via `findFirst`.** Two concurrent Paygate retries both see "not seen", both proceed. Use `@@unique` + `P2002` for atomicity. `Order.paygateId @unique` is already correct in the schema — reuse it.
- **Returning 4xx/5xx to a legitimate duplicate.** Webhook senders typically retry on non-2xx and stop on 2xx. If we 500 on a duplicate we get hammered indefinitely. Duplicate = 200 with `duplicated: true`.
- **Silent tier coercion (`default: return ONE_MONTH`).** This is PRIC-02. `default` should `throw`; the caller returns HTTP 400. No user pays for `1-year` and gets `ONE_MONTH`.
- **Using `Object.prototype.hasOwnProperty.call(PRICING_TIERS, tier)` as the only server-side tier gate.** Current `create-session` does this (`route.ts:39`), which is sufficient for known slugs but is silently bypassed if a caller sends `constructor` or `__proto__` (returns `true` for those on plain objects, though `hasOwnProperty.call` guards against prototype pollution — this is OK but noisy). Prefer `if (!(tier in TIER_METADATA))` or `if (!TIER_METADATA[tier])`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Constant-time string comparison | `sig === expected` or manual XOR | `crypto.timingSafeEqual` | Node stdlib, hardware-accelerated, defeats statistical timing attacks; every mainstream webhook implementer uses this exact call. |
| Cross-process replay cache | In-memory `Set<signature>` with TTL | Prisma `WebhookDelivery` with `@@unique` | Serverless instances share nothing; in-memory sets evaporate on cold start (exact same bug class as `InMemoryRateLimiter`). DB unique index is race-safe and durable. |
| "Seen this order?" idempotency guard | `findFirst` then `create` | `create` inside try/catch on `P2002` | Check-then-act races between concurrent retries. Unique-constraint-in-catch is atomically first-write-wins. |
| Enum ↔ config sync verification | Runtime "did I forget one?" check | `Record<TierId, ...>` + `assertNever` in switch | TypeScript catches drift at compile time. Runtime checks catch it after deploy. |
| Idempotency-key scheme design | Custom `sha256(nonce+timestamp+…)` | Paygate's already-signed URL IS the nonce | The `signature` query param is already a per-order unguessable value (it embeds the merchant secret). Reuse it as the idempotency key instead of inventing a second nonce. |

**Key insight:** For this phase, "don't hand-roll" is mostly "use Postgres' unique constraint + Prisma's `P2002` code + Node's `timingSafeEqual`". The three combined are the well-worn Stripe-webhook / GitHub-webhook pattern. There is no third-party library that fits better because both the signature scheme and the idempotency table live inside our schema.

## Common Pitfalls

### Pitfall 1: The "Paygate.to sends a signature" false assumption
**What goes wrong:** Naïvely adding `X-Paygate-Signature` header verification (like the current dead POST handler does at `route.ts:103,106`) breaks nothing because Paygate never calls POST — but it wastes design effort and can mislead the plan.
**Why it happens:** Every well-known payment provider (Stripe, PayPal, Coinbase Commerce) signs its own webhooks with a header. It's easy to assume Paygate does too.
**How to avoid:** The verified truth (from Paygate's own official WordPress plugin at [`paygate-to/WooCommerce-Crypto-Payment-Gateway`](https://github.com/paygate-to/WooCommerce-Crypto-Payment-Gateway) and WHMCS plugin at [`paygate-to/WHMCS-Crypto-Payment-Gateway`](https://github.com/paygate-to/WHMCS-Crypto-Payment-Gateway) — see `modules/gateways/paygatecrypto/lib.php:245-260`): **Paygate.to only appends `value_coin`, `coin`, `txid_in` to the callback URL via GET. It does not send any header, timestamp, or signature. The signature scheme in our current code (HMAC over `orderRef+email+tier+amount`) is 100% merchant-side and stays in the merchant-registered callback URL.** So the entire POST handler in `route.ts:92-163` is dead code (nothing calls it externally, no client posts to it internally).
**Warning signs:** Any plan that says "verify Paygate's signature header" or "check Paygate's timestamp field" — pause and re-verify against their plugin source.

### Pitfall 2: Silent tier downgrade goes unnoticed in tests
**What goes wrong:** A user pays $1,799 for `1-year`. `mapTier("1-year")` hits the `default` branch and returns `ONE_MONTH`. `computeExpirationDate(ONE_MONTH)` sets `expiresAt` to +30 days. The `Order.pricingTier` column stores `ONE_MONTH`. The user's dashboard shows "Monthly Plan" and expires 335 days early. No exception, no log line, no failing test.
**Why it happens:** The `default: return ONE_MONTH` branch converts an unknown-tier bug into a well-typed but wrong subscription. TypeScript happily accepts it (it's a valid `PricingTier` return). The order-status endpoint reports `SUCCESS`.
**How to avoid:** Make `mapTier` a total function that `throw`s on unknown input. Every caller (webhook GET, `create-session` POST, `free-trial` POST) must translate the throw into `HTTP 400`. Add `node:test` coverage over every slug in `TierId`.
**Warning signs:** Support tickets like "I paid for a year but my dashboard says monthly". Also: any grep for `default:` in a tier switch that returns a value instead of throwing.

### Pitfall 3: Fail-open bypass shipped to production
**What goes wrong:** `PAYGATE_WEBHOOK_SECRET` was never set in Vercel (see STATE.md — currently in the "MISSING env vars" list). Current code returns `true` from verify with a warning log. Attacker POSTs — or GETs — `/api/webhooks/paygate?order_ref=X&email=me@evil.com&tier=lifetime-source&amount=79999&signature=whatever` and gets a `LIFETIME_SOURCE` subscription. Log line is silent in Vercel's high-volume stdout.
**Why it happens:** "Fail open in dev, fail closed in prod" without a strict `NODE_ENV === "production"` gate; a `console.warn` that no one alerts on.
**How to avoid:**
1. Verify function returns `false` unless secret is present. Full stop.
2. Dev bypass is a *two-key* gate: `NODE_ENV !== "production"` AND `PAYGATE_ALLOW_INSECURE_WEBHOOK === "1"`. Both, not either.
3. Deploy sequence: **provision `PAYGATE_WEBHOOK_SECRET` in Vercel BEFORE merging the fail-closed code**. If we merge code first, all Paygate callbacks 500 until the env var lands.
**Warning signs:** Any `console.warn(...)` followed by `return true`. Any `NODE_ENV !== "production" ? bypass : verify` without a second explicit env-var gate.

### Pitfall 4: `req.json()` before signature verify
**What goes wrong:** If we ever add a POST path back, calling `req.json()` first consumes the body stream. Signature computed on re-stringified JSON has different bytes than the original (property order, whitespace, escape sequences). Verify always fails.
**Why it happens:** Reflex to parse the body first, then think about auth.
**How to avoid:** For POST: `const raw = await req.text(); const sig = verify(raw, header); if (!sig.ok) return 401; const body = JSON.parse(raw);`. Current POST handler at `route.ts:102-111` does this correctly — preserve the pattern if we ever revive POST.
**Warning signs:** `await req.json()` earlier than the signature check in any route under `/api/webhooks/`.

### Pitfall 5: Replay window without a persistent store
**What goes wrong:** Adding a "seen nonces in the last 5 min" in-memory `Set` looks correct locally but fails on Vercel: each serverless invocation runs on a warm-or-cold instance with its own memory. Two concurrent Paygate retries land on two instances, both see empty sets, both provision.
**Why it happens:** Standard mistake for serverless newcomers; same class as the in-memory rate limiter already flagged in CONCERNS.md.
**How to avoid:** Persist the "seen it" marker in Postgres via `WebhookDelivery.signature @unique`. The DB is the only shared state across serverless instances (Redis/KV would work too but adds a dependency Phase 2 doesn't need).
**Warning signs:** Any `new Set<string>()` or `new Map<...>()` at module scope inside `/api/`.

### Pitfall 6: Vercel body limit tripping a "fixed" webhook
**What goes wrong:** Paygate.to's `GET` callback is small (few hundred bytes of query string) — no body limit issue. But if Phase 2 accidentally introduces a POST path with a base64-encoded payload we could hit Vercel's 4.5 MB limit (same class as CMPL-06 in Phase 1).
**Why it happens:** Copy-paste from other webhook examples that use POST bodies.
**How to avoid:** Phase 2 only touches GET. Delete the dead POST handler outright. If Paygate ever adds a POST spec, revisit.
**Warning signs:** Any `req.text()` for a body larger than a URL fragment in this route.

### Pitfall 7: Prisma singleton bypass
**What goes wrong:** New route code that does `import { PrismaClient } from "@prisma/client"; const prisma = new PrismaClient();` leaks connection pools on cold start (same class of bug already fixed for compile routes in Phase 1 CMPL-05).
**Why it happens:** Muscle memory / IDE autocomplete on a fresh file.
**How to avoid:** In every route this phase touches, use `import { prisma } from "@/lib/prisma";`. The webhook route already does this correctly at `route.ts:2` (indirectly via `subscriptions.ts`); `order-status` also does at `route.ts:3`. Keep it.
**Warning signs:** `new PrismaClient(` anywhere outside `src/lib/prisma.ts`.

## Code Examples

Verified patterns from official sources and current-codebase conventions.

### Example 1: Rewritten `verifyWebhookSignature` (fail-closed with `timingSafeEqual`)
```typescript
// src/lib/webhook-signature.ts
// Source pattern: Snyk (https://snyk.io/blog/verifying-webhook-signatures/)
// Source pattern: Node crypto docs (https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no-secret" | "no-signature" | "bad-length" | "bad-signature" };

export function verifyPaygateSignature(payload: string, providedSig: string | null): VerifyResult {
  const secret = process.env.PAYGATE_WEBHOOK_SECRET;

  if (!secret) {
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.PAYGATE_ALLOW_INSECURE_WEBHOOK === "1"
    ) {
      console.warn("[paygate] insecure bypass — dev only");
      return { ok: true };
    }
    return { ok: false, reason: "no-secret" };
  }

  if (!providedSig) return { ok: false, reason: "no-signature" };

  const expected = Buffer.from(
    createHmac("sha256", secret).update(payload).digest("hex"),
    "utf8",
  );
  const provided = Buffer.from(providedSig, "utf8");
  if (expected.length !== provided.length) return { ok: false, reason: "bad-length" };
  return timingSafeEqual(expected, provided)
    ? { ok: true }
    : { ok: false, reason: "bad-signature" };
}
```

### Example 2: Rewritten GET webhook (fail-closed + replay + idempotent)
```typescript
// src/app/api/webhooks/paygate/route.ts (partial — GET only; POST deleted)
// Source: Hookdeck idempotency guide (https://hookdeck.com/webhooks/guides/implement-webhook-idempotency)
// Source: Prisma P2002 (https://www.prisma.io/docs/orm/reference/error-reference#p2002)
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { provisionSubscription } from "@/lib/subscriptions";
import { verifyPaygateSignature } from "@/lib/webhook-signature";
import { UnknownTierError } from "@/lib/pricing-tiers";
import { checkWebhookRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail, validateAmount } from "@/lib/validation";

export async function GET(req: Request) {
  const identifier = getClientIdentifier(req);
  const { success: rlOk } = await checkWebhookRateLimit(identifier);
  if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const url = new URL(req.url);
  const orderRef = url.searchParams.get("order_ref") || "";
  const email    = (url.searchParams.get("email") || "").trim().toLowerCase();
  const tier     = url.searchParams.get("tier") || "";
  const currency = (url.searchParams.get("currency") || "USD").toUpperCase();
  const amountS  = url.searchParams.get("value_coin") || url.searchParams.get("amount") || "0";
  const signature = url.searchParams.get("signature");

  const signaturePayload = `${orderRef}${email}${tier}${amountS}`;
  const verified = verifyPaygateSignature(signaturePayload, signature);
  if (!verified.ok) {
    console.error(`[paygate] webhook rejected: ${verified.reason}`, { orderRef, email, tier });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!orderRef || !email) {
    return NextResponse.json({ error: "Missing required callback parameters." }, { status: 400 });
  }
  const emailV = validateEmail(email);
  if (!emailV.valid) return NextResponse.json({ error: emailV.error }, { status: 400 });
  const amount = Number.parseFloat(amountS);
  const amountV = validateAmount(amount);
  if (!amountV.valid) return NextResponse.json({ error: amountV.error }, { status: 400 });

  // Replay protection: signature is the natural nonce (embeds per-order secret).
  try {
    await prisma.webhookDelivery.create({
      data: { signature: signature!, orderRef },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Idempotent replay — 200 OK so Paygate stops retrying.
      return NextResponse.json({ success: true, duplicated: true, source: "paygate-get" }, { status: 200 });
    }
    throw err;
  }

  try {
    const result = await provisionSubscription(email, tier, orderRef, amount, currency);
    return NextResponse.json({ success: true, source: "paygate-get", ...result }, { status: 200 });
  } catch (err) {
    if (err instanceof UnknownTierError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[paygate] webhook processing failed:", err);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
```

### Example 3: `node:test` coverage of tier mapping (project's existing test style)
```typescript
// src/lib/pricing-tiers.test.ts
// Source pattern: existing src/lib/pricing-showcase.test.ts, magic-links.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { PricingTier } from "@prisma/client";
import { mapTier, computeExpirationDate, TIER_METADATA, UnknownTierError } from "./pricing-tiers";

test("every TierId slug maps to a real PricingTier enum value", () => {
  for (const [slug, meta] of Object.entries(TIER_METADATA)) {
    assert.equal(mapTier(slug), meta.enum, `slug ${slug} → ${meta.enum}`);
  }
});

test("mapTier throws UnknownTierError on unknown input (no silent downgrade)", () => {
  assert.throws(() => mapTier("not-a-real-tier"), UnknownTierError);
  assert.throws(() => mapTier(""), UnknownTierError);
});

test("1-year does NOT silently downgrade to ONE_MONTH (regression: PRIC-02)", () => {
  assert.equal(mapTier("1-year"), PricingTier.ONE_YEAR);
  // 1-year expiry is approximately 365 days out
  const expiry = computeExpirationDate(PricingTier.ONE_YEAR);
  const daysOut = Math.round((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  assert.ok(daysOut >= 364 && daysOut <= 366, `expected ~365d, got ${daysOut}`);
});

test("lifetime-source does NOT silently downgrade to ONE_MONTH (regression: PRIC-02)", () => {
  assert.equal(mapTier("lifetime-source"), PricingTier.LIFETIME_SOURCE);
});
```

Run with (no package.json script yet — add one this phase if desired):
```bash
node --test --experimental-strip-types src/lib/pricing-tiers.test.ts
# or with tsx: npx tsx --test src/lib/pricing-tiers.test.ts
```

### Example 4: `WebhookDelivery` Prisma model
```prisma
// prisma/schema.prisma — additions
model WebhookDelivery {
  id         String   @id @default(cuid())
  signature  String   @unique          // per-delivery natural nonce
  orderRef   String
  receivedAt DateTime @default(now())

  @@index([orderRef])
  @@index([receivedAt])                // for optional cleanup cron
}

enum PricingTier {
  FREE_TRIAL
  TEN_DAYS           // NEW — was silently downgraded to ONE_MONTH
  ONE_MONTH
  SIX_MONTHS
  ONE_YEAR           // NEW — was silently downgraded to ONE_MONTH
  LIFETIME
  LIFETIME_SOURCE    // NEW — was silently downgraded to ONE_MONTH
  SECRET_TEST_TIER
}
```
Applied via `prisma db push` per Phase 1's established Coolify Postgres pattern (STATE.md: "`db push` is the Phase 1 stopgap; formal migrations arrive in Phase 3.").

### Example 5: `create-session` embeds signature in callback URL
The current code at `src/app/api/paygate/create-session/route.ts:63-68` builds the callback URL but does NOT append a `signature` parameter — meaning any GET callback with an empty `signature=` fails the fail-closed verify. Fix:
```typescript
// After building callbackUrl with order_ref/tier/email/currency/amount:
const signaturePayload = `${orderRef}${email}${tier}${amount}`;
const sig = createHmac("sha256", process.env.PAYGATE_WEBHOOK_SECRET!)
  .update(signaturePayload)
  .digest("hex");
callbackUrl.searchParams.set("signature", sig);
```
Note: this is why Phase 2 must provision `PAYGATE_WEBHOOK_SECRET` in Vercel *before* deploying — `create-session` will 500 on missing secret otherwise.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fail-open verify with warning log | Fail-closed with explicit two-key dev bypass | ~2020 industry standard (post-Stripe DSN incidents) | Any misconfig becomes a rejected request, not a free-provisioning endpoint |
| String `===` on signatures | `timingSafeEqual(Buffer, Buffer)` | Node ≥ 6 (2016+), universal by 2020 | Defeats statistical timing attacks that leak bits of the correct signature |
| In-memory replay cache | DB unique constraint w/ `P2002` catch | Serverless mainstream ~2019+ | Race-safe across concurrent retries, durable across cold starts |
| `switch/default: return X` on enums | Exhaustive switch + `assertNever(x: never)` | TypeScript 2.x (2018+), best-practice by 2020 | Compile-time detection of new enum members without matching logic |
| Config drift across files | `Record<Key, ...>` + `assertNever` | Standard TS pattern | Adding a slug forces the map to grow; adding an enum forces the switch to grow — both TS errors, not runtime silent-downgrades |

**Deprecated/outdated:**
- **NextAuth v4** (project's current version) is in maintenance; v5/Auth.js is the current line. Out of scope for Phase 2 — noted for Phase 3+.
- **`log: ["query"]` in `src/lib/prisma.ts`** logs every query in production (PII leak). Flagged in CONCERNS.md but out of Phase 2 scope unless we accidentally trip on it during webhook debugging.

## Open Questions

1. **Does Paygate.to include any per-delivery uniqueness in the callback URL beyond what the merchant registered?**
   - What we know: Their official plugins (WooCommerce, WHMCS) only receive `value_coin`, `coin`, `txid_in` (per plugin source at [`paygatecryptomulti.php`](https://github.com/paygate-to/WHMCS-Crypto-Payment-Gateway/blob/main/modules/gateways/callback/paygatecryptomulti.php) and [`class-paygatedotto-crypto-payment-gateway-multicoin.php:430-490`](https://github.com/paygate-to/WooCommerce-Crypto-Payment-Gateway/blob/main/includes/class-paygatedotto-crypto-payment-gateway-multicoin.php)). The `txid_in` is the on-chain transaction ID.
   - What's unclear: For USDC on Polygon (our payout chain), is `txid_in` unique per delivery? If Paygate retries on non-2xx it presumably re-uses the same `txid_in` — meaning our unique index on `signature` (which is deterministic per order+email+tier+amount, NOT per delivery) will catch legitimate retries as replays, which is what we want. But we should confirm empirically once we have a real Paygate callback in staging.
   - Recommendation: Design as-if `signature` is the unique key (it is deterministic per order). If we ever need per-attempt uniqueness (unlikely), add `txid_in` to the `WebhookDelivery` row and change the unique index. **Action for planner:** Include a task to log the full raw callback URL (redacted email) on first-time delivery so we can inspect actual Paygate behavior against the production DB in staging.

2. **Should we ever restore the POST handler?**
   - What we know: Paygate.to does not invoke POST. All observable evidence in their plugin ecosystem is GET-only.
   - What's unclear: Whether Paygate has an internal / undocumented POST spec for high-value merchants.
   - Recommendation: **Delete** the current POST handler this phase. If Paygate later documents a POST path, resurrect via git history with the same fail-closed / replay-idempotent pattern.

3. **Do we need a `WebhookDelivery` cleanup cron?**
   - What we know: Rows accumulate 1-per-legitimate-delivery + 1-per-attacker-attempt. At low volume this is trivial (kilobytes/month).
   - What's unclear: When we'd need to cap it. Phase 1 established a reaper cron pattern; that infra is available if needed.
   - Recommendation: Skip cleanup in Phase 2. Add if `WebhookDelivery` row count exceeds ~100k. Index on `receivedAt` is there for future cleanup.

4. **Is the `pricing-showcase-section` on the landing page (`page.tsx`) using tiers that should be deprecated?**
   - What we know: `buildContactOffers` (`pricing-showcase.ts:255+`) shows `lifetime`/`lifetime-source` as "concierge" contact-us paths, not buy-now buttons. The public checkout may not actually offer these tiers via `/checkout` UI even though `TierId` includes them.
   - What's unclear: Whether we should also drop `lifetime`/`lifetime-source` from `TierId` if they're contact-us-only.
   - Recommendation: Keep them in `TierId` and add real enum values. The checkout page (`CheckoutClient.tsx`) still renders them, so removing the type would break TypeScript compilation. Marketing decisions about which tiers to show are out of Phase 2 scope (deferred to Phase 6 `PRIC-01`).

5. **Rollout sequencing**: does `create-session` also need `PAYGATE_WEBHOOK_SECRET`?
   - What we know: If we add the `signature` param to the registered callback URL (Example 5 above), then `create-session` also fails if the secret is missing.
   - Rollout order to avoid downtime: **(1) Provision `PAYGATE_WEBHOOK_SECRET` in Vercel prod → (2) merge the code change → (3) deploy.** In reverse order, `create-session` starts 500ing before the env var lands.
   - Recommendation: Planner should include a preflight task to `vercel env add PAYGATE_WEBHOOK_SECRET production` before the code-deploy task in the wave order.

## Sources

### Primary (HIGH confidence)
- **Paygate.to official WordPress plugin** — [`paygate-to/WooCommerce-Crypto-Payment-Gateway`](https://github.com/paygate-to/WooCommerce-Crypto-Payment-Gateway), file `includes/class-paygatedotto-crypto-payment-gateway-multicoin.php:262-355,430-490`. Confirms Paygate.to sends only `value_coin`, `coin`, `txid_in` on GET; no header signature, no timestamp. Merchant embeds their own `nonce`.
- **Paygate.to official WHMCS plugin** — [`paygate-to/WHMCS-Crypto-Payment-Gateway`](https://github.com/paygate-to/WHMCS-Crypto-Payment-Gateway), files `modules/gateways/callback/paygatecrypto.php:13-43` and `modules/gateways/paygatecrypto/lib.php:242-266`. Same GET-only contract; documents the merchant-side `pgc_verify_sig` HMAC(orderId, per-order-nonce) pattern we're already using in spirit.
- **Node.js `crypto` docs** — [`crypto.timingSafeEqual`](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b), [`crypto.createHmac`](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options). Verifies the constant-time comparison semantics and Buffer requirements.
- **Prisma error reference** — [P2002 unique constraint violation](https://www.prisma.io/docs/orm/reference/error-reference#p2002). Confirms `Prisma.PrismaClientKnownRequestError.code === "P2002"` is the idiomatic race-safe idempotency signal.
- **Next.js 16 bundled docs** — `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`. Confirms `export const runtime = 'nodejs'` is the current App Router route config; `crypto` stdlib works in Node runtime (not Edge).
- **Existing project code** — `src/app/api/webhooks/paygate/route.ts` (current fail-open bug at lines 20-27), `src/lib/subscriptions.ts:6-27` (current silent-downgrade bug at line 25), `src/config/pricing.ts:1-17` (8 tier slugs), `prisma/schema.prisma:82-88` (5 enum values), `src/app/[locale]/checkout/CheckoutClient.tsx:27-36` (all 8 slugs surfaced in UI).
- **Snyk — The importance of verifying webhook signatures** — [snyk.io/blog/verifying-webhook-signatures](https://snyk.io/blog/verifying-webhook-signatures/). Confirms the fail-closed + `timingSafeEqual` pattern.
- **GitHub docs — Validating webhook deliveries** — [docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries). Same fail-closed + `timingSafeEqual` + length-check pattern, from a first-party source.
- **Fullstory — Discriminated Unions and Exhaustiveness Checking in TypeScript** — [fullstory.com/blog/discriminated-unions-and-exhaustiveness-checking-in-typescript](https://www.fullstory.com/blog/discriminated-unions-and-exhaustiveness-checking-in-typescript/). Verifies the `assertNever(x: never): never` pattern.

### Secondary (MEDIUM confidence)
- **Hookdeck — How to Implement Webhook Idempotency** — [hookdeck.com/webhooks/guides/implement-webhook-idempotency](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency). Confirms the "unique constraint on event ID → P2002-in-catch → 2xx duplicate" pattern is industry-standard.
- **Nerd Level Tech — Idempotency Keys for a Node.js API with Postgres (2026)** — [nerdleveltech.com/idempotency-keys-nodejs-postgres-api-tutorial](https://nerdleveltech.com/idempotency-keys-nodejs-postgres-api-tutorial). Same pattern, Node+Postgres specific, 2026 dated.
- **The Agent Practice — Idempotent webhook handlers in Next.js 16** — [theagentpractice.com/blog/nextjs-webhook-idempotency-hmac](https://theagentpractice.com/blog/nextjs-webhook-idempotency-hmac). Next.js 16 specific; corroborates raw-body-first, then verify, then handle.

### Tertiary (LOW confidence — informational only, no plan decisions rest on these alone)
- **Paygate.to WooCommerce troubleshooting page** — [paygate.to/woocommerce-payment-gateway-troubleshooting](https://paygate.to/woocommerce-payment-gateway-troubleshooting/). Confirms "nonce" concept but is user-facing troubleshooting, not a spec.
- **DEV.to — Next.js 16 Webhook Handler Pattern** — general Next.js 16 webhook patterns, cross-verifies with Snyk/GitHub. Not authoritative for Paygate.to specifically.

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — every recommended library is Node stdlib or already-installed Prisma. `node:test` pattern is verified in existing project test files.
- **Paygate.to contract:** HIGH — verified via Paygate.to's own official WordPress + WHMCS plugin source code, cross-referenced across two independent repos.
- **Architecture patterns:** HIGH — `timingSafeEqual` + `P2002`-in-catch + `assertNever` are all well-worn patterns backed by multiple first-party sources (Node docs, Prisma docs, TS handbook).
- **Pitfalls:** HIGH — the current codebase's `route.ts:20-27` and `subscriptions.ts:25` bugs are directly grep-verified. Serverless pitfalls (in-memory shared state) are already documented in existing CONCERNS.md.
- **Rollout sequencing (env before code):** MEDIUM — logical inference; no source cited. Verify by inspecting `vercel env ls` before merge and rolling env-first.

**Research date:** 2026-07-04
**Valid until:** ~2026-08-04 (30 days). Payment provider APIs move slowly, but recheck if Paygate.to publishes formal webhook docs (their current "docs" is a Postman collection that we could not verify contents of — [documenter.getpostman.com/view/14826208/2sA3Bj9aBi](https://documenter.getpostman.com/view/14826208/2sA3Bj9aBi)) before Phase 6 revisits payment code.

## Recommended Plan Breakdown

To help the planner (ROADMAP.md already sketches 3 plans; this confirms and refines):

- **Plan 02-01: PricingTier enum + config alignment (PRIC-02).**
  - Extend `PricingTier` enum with `TEN_DAYS`, `ONE_YEAR`, `LIFETIME_SOURCE`.
  - Create `src/lib/pricing-tiers.ts` with `TIER_METADATA: Record<TierId, TierMetadata>`, `mapTier` (throwing `UnknownTierError`), `computeExpirationDate` (exhaustive switch + `assertNever`).
  - Delete old `mapTier`/`computeExpirationDate` from `subscriptions.ts`, re-export from new module.
  - Update `create-session`, webhook GET, and `free-trial` routes to catch `UnknownTierError` → HTTP 400.
  - Add `pricing-tiers.test.ts` with `node:test` coverage for every slug + regression tests for the silent-downgrade paths.
  - `prisma db push` to remote.

- **Plan 02-02: Fail-closed webhook signature verification (SECR-01).**
  - Create `src/lib/webhook-signature.ts` with `verifyPaygateSignature` (fail-closed + `timingSafeEqual` + two-key dev bypass).
  - Rewrite GET `/api/webhooks/paygate/route.ts`: verify → 401 on any failure; delete POST handler entirely.
  - Update `create-session` to embed `signature` in the registered callback URL (so real callbacks pass verify).
  - **Preflight task (must run BEFORE deploy):** `vercel env add PAYGATE_WEBHOOK_SECRET production` (also `preview`, `development`).
  - Add `webhook-signature.test.ts`: missing secret, missing sig, wrong sig, right sig, dev-bypass both keys.

- **Plan 02-03: Replay protection + idempotency (SECR-02, SECR-03).**
  - Add `WebhookDelivery` model to `schema.prisma` with `signature @unique` + `orderRef` + `receivedAt`.
  - Wrap webhook GET handler's provision path in a `prisma.webhookDelivery.create({ ... })` + `P2002`-in-catch → 200 `duplicated: true` short-circuit.
  - Verify email dedup: the existing `provisionSubscription` short-circuits on `existingOrder` (`subscriptions.ts:105-109`) — but the confirmation email in the same function (`subscriptions.ts:156-168`) is NOT gated on that check. Currently: a duplicate `paygateId` returns early at line 107 BEFORE the email block, so the email is not double-sent. ✅ The existing code is idempotent for email IF the P2002-on-Order path is hit. With the new `WebhookDelivery` short-circuit at the top of the webhook route, we never even call `provisionSubscription` on a replay, so email dedup is a two-layer guarantee.
  - `prisma db push` to remote.
  - Add integration-style test that stubs Prisma and simulates two identical webhook deliveries — assert one Order, one Subscription, no exception on second.
