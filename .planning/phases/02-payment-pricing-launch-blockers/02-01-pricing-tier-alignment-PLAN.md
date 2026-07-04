---
phase: 02-payment-pricing-launch-blockers
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - src/lib/pricing-tiers.ts
  - src/lib/pricing-tiers.test.ts
  - src/lib/subscriptions.ts
  - src/app/api/checkout/free-trial/route.ts
autonomous: true

must_haves:
  truths:
    - "Every TierId slug in src/config/pricing.ts maps to a real PricingTier enum value (no silent downgrade)"
    - "mapTier(\"1-year\") returns PricingTier.ONE_YEAR (regression: PRIC-02) — not ONE_MONTH"
    - "mapTier(\"lifetime-source\") returns PricingTier.LIFETIME_SOURCE — not ONE_MONTH"
    - "mapTier(\"10-days\") returns PricingTier.TEN_DAYS — not ONE_MONTH"
    - "mapTier(<unknown-string>) throws UnknownTierError (never silently returns a default)"
    - "computeExpirationDate(PricingTier.ONE_YEAR) returns a date approximately 365 days out"
    - "computeExpirationDate is an exhaustive switch — adding a new PricingTier enum value without adding a case fails TypeScript compilation via assertNever"
    - "Free-trial checkout route translates UnknownTierError to HTTP 400 (not 500)"
    - "prisma db push has run against remote Coolify Postgres so PricingTier enum has all 8 values"
    - "npm run lint passes (no unused imports left from mapTier move)"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "Extended PricingTier enum with TEN_DAYS, ONE_YEAR, LIFETIME_SOURCE"
      contains: "TEN_DAYS"
    - path: "src/lib/pricing-tiers.ts"
      provides: "TIER_METADATA map + mapTier + computeExpirationDate + UnknownTierError"
      exports: ["TIER_METADATA", "mapTier", "computeExpirationDate", "UnknownTierError", "TierMetadata"]
      min_lines: 60
    - path: "src/lib/pricing-tiers.test.ts"
      provides: "node:test coverage for every tier slug + regression tests for silent-downgrade paths"
      contains: "1-year"
      min_lines: 40
    - path: "src/lib/subscriptions.ts"
      provides: "provisionSubscription (mapTier + computeExpirationDate re-exported from pricing-tiers)"
      contains: "from \"./pricing-tiers\""
    - path: "src/app/api/checkout/free-trial/route.ts"
      provides: "Catches UnknownTierError → HTTP 400"
      contains: "UnknownTierError"
  key_links:
    - from: "src/lib/pricing-tiers.ts"
      to: "@prisma/client PricingTier"
      via: "TIER_METADATA Record<TierId, {enum: PricingTier, ...}>"
      pattern: "PricingTier\\.(TEN_DAYS|ONE_YEAR|LIFETIME_SOURCE)"
    - from: "src/lib/subscriptions.ts"
      to: "src/lib/pricing-tiers.ts"
      via: "re-export of mapTier + computeExpirationDate"
      pattern: "from \"./pricing-tiers\""
    - from: "src/app/api/checkout/free-trial/route.ts"
      to: "src/lib/pricing-tiers.ts"
      via: "catch (err instanceof UnknownTierError)"
      pattern: "UnknownTierError"
---

<objective>
Kill the silent tier-downgrade bug (PRIC-02). Today a user pays $1,799 for `1-year` and `mapTier()` silently coerces the tier to `ONE_MONTH` via a `default:` branch (see `src/lib/subscriptions.ts:24-26`) — the order stores `ONE_MONTH`, dashboard displays "Monthly Plan", expiry sets to +30 days. Same silent downgrade hits `10-days`, `lifetime-source`, and any future tier ID.

Purpose: Make `PricingTier` enum, `src/config/pricing.ts`, `mapTier`, and `computeExpirationDate` a single-source-of-truth (`Record<TierId, TierMetadata>`) enforced at compile time. Any drift between the three files becomes a TypeScript error, not a runtime revenue leak. Aligns Phase 2 launch-blocker requirement PRIC-02 with the Phase 6 data-driven pricing path (per research §Standard Stack: extend the enum now, refactor to per-robot rows in Phase 6).

Output:
- `prisma/schema.prisma` `PricingTier` enum extended from 5 → 8 values
- New `src/lib/pricing-tiers.ts` with `TIER_METADATA`, `mapTier` (throws `UnknownTierError`), `computeExpirationDate` (exhaustive switch + `assertNever`)
- New `src/lib/pricing-tiers.test.ts` — full slug coverage + explicit regression tests for `1-year` and `lifetime-source`
- `src/lib/subscriptions.ts` re-exports the two functions from the new module (deletes the old inline switch); `provisionSubscription` unchanged in behavior for the 5 already-supported tiers
- `src/app/api/checkout/free-trial/route.ts` catches `UnknownTierError` → 400
- `prisma db push` executed against remote Coolify Postgres (STATE.md: `db push` is the established Phase 2 pattern; migrations arrive in Phase 3)
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
@src/config/pricing.ts
@src/lib/subscriptions.ts
@prisma/schema.prisma
@src/app/api/checkout/free-trial/route.ts
@src/lib/pricing-showcase.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend PricingTier enum + push schema to remote Postgres</name>
  <files>prisma/schema.prisma</files>
  <action>
Extend the `PricingTier` enum in `prisma/schema.prisma` (currently 5 values at lines 82-88) to include the three missing tiers so every slug in `src/config/pricing.ts` has a real DB representation.

Add exactly these three enum values (order shown below matches life-cycle progression — keeps schema readable):

```prisma
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

Do NOT rename any existing value (LIFETIME, SECRET_TEST_TIER stay as-is — external code depends on them).

After editing, run `npx prisma generate` locally to regenerate the client, then push the schema to the remote Coolify Postgres:

```bash
npx prisma db push
```

Per STATE.md: `db push` is the established Phase 2 pattern (no `prisma/migrations/` dir per Phase 1 decision). Do NOT run `prisma migrate dev` — that requires the migrations dir which does not exist.

Since this project only has test users (STATE.md + PROJECT.md: "test users only, no live revenue"), the enum extension is additive and safe — no existing rows will conflict. If `db push` reports data loss (unlikely — we are only ADDing enum values), stop and report; do NOT auto-accept.
  </action>
  <verify>
Run all three:
1. `grep -n "TEN_DAYS\|ONE_YEAR\|LIFETIME_SOURCE" prisma/schema.prisma` — must show all three enum values on separate lines inside the `enum PricingTier` block.
2. `npx prisma generate` — must complete without error and produce a client with the three new enum members.
3. `npx prisma db push` — must print `The database is now in sync with your Prisma schema.` (or the equivalent up-to-date message). If it reports pending data loss, STOP and report — do NOT force.
4. `node -e "const {PricingTier} = require('@prisma/client'); console.log(PricingTier.TEN_DAYS, PricingTier.ONE_YEAR, PricingTier.LIFETIME_SOURCE);"` — must print `TEN_DAYS ONE_YEAR LIFETIME_SOURCE` (proves generated client exposes them).
  </verify>
  <done>
PricingTier enum in `prisma/schema.prisma` contains all 8 values (FREE_TRIAL, TEN_DAYS, ONE_MONTH, SIX_MONTHS, ONE_YEAR, LIFETIME, LIFETIME_SOURCE, SECRET_TEST_TIER). Generated Prisma client exposes all three new values. Remote Coolify Postgres schema is in sync (`db push` reported no pending changes on second invocation).
  </done>
</task>

<task type="auto">
  <name>Task 2: Create pricing-tiers.ts single-source-of-truth module + tests</name>
  <files>src/lib/pricing-tiers.ts, src/lib/pricing-tiers.test.ts</files>
  <action>
Create `src/lib/pricing-tiers.ts` as the single source of truth for tier metadata. Follow the exact pattern from 2-RESEARCH.md §Pattern 1.

```typescript
// src/lib/pricing-tiers.ts
import { PricingTier } from "@prisma/client";
import type { TierId } from "@/config/pricing";

export class UnknownTierError extends Error {
  constructor(tier: string) {
    super(`Unknown pricing tier: ${tier}`);
    this.name = "UnknownTierError";
  }
}

export interface TierMetadata {
  enum: PricingTier;
  amount: number;
  priceString: string;
  durationDays: number | "lifetime";
}

// Record<TierId, ...> guarantees every TierId slug is present.
// Adding a slug to TierId in src/config/pricing.ts forces this map to grow — TS error otherwise.
export const TIER_METADATA: Record<TierId, TierMetadata> = {
  "free-trial":      { enum: PricingTier.FREE_TRIAL,       amount:     0, priceString: "$0",      durationDays: 3 },
  "10-days":         { enum: PricingTier.TEN_DAYS,         amount:    69, priceString: "$69",     durationDays: 10 },
  "1-month":         { enum: PricingTier.ONE_MONTH,        amount:   199, priceString: "$199",    durationDays: 30 },
  "6-months":        { enum: PricingTier.SIX_MONTHS,       amount:   999, priceString: "$999",    durationDays: 182 },
  "1-year":          { enum: PricingTier.ONE_YEAR,         amount:  1799, priceString: "$1,799",  durationDays: 365 },
  "lifetime":        { enum: PricingTier.LIFETIME,         amount:  7999, priceString: "$7,999",  durationDays: "lifetime" },
  "lifetime-source": { enum: PricingTier.LIFETIME_SOURCE,  amount: 79999, priceString: "$79,999", durationDays: "lifetime" },
  "secret-test":     { enum: PricingTier.SECRET_TEST_TIER, amount:    10, priceString: "$10",     durationDays: 7 },
};

// NOTE: mapTier is a TOTAL function — throws UnknownTierError on unknown input.
// Every caller MUST translate that throw to HTTP 400 (never fall back to a default).
export function mapTier(tierRaw: string): PricingTier {
  const normalized = tierRaw.trim().toLowerCase();
  const meta = TIER_METADATA[normalized as TierId];
  if (!meta) throw new UnknownTierError(tierRaw);
  return meta.enum;
}

// Exhaustive switch — assertNever fires at COMPILE TIME if PricingTier grows
// without a matching case added here.
export function computeExpirationDate(tier: PricingTier): Date {
  const now = new Date();
  switch (tier) {
    case PricingTier.FREE_TRIAL: {
      const d = new Date(now);
      d.setDate(d.getDate() + 3);
      return d;
    }
    case PricingTier.TEN_DAYS: {
      const d = new Date(now);
      d.setDate(d.getDate() + 10);
      return d;
    }
    case PricingTier.ONE_MONTH: {
      const d = new Date(now);
      d.setMonth(d.getMonth() + 1);
      return d;
    }
    case PricingTier.SIX_MONTHS: {
      const d = new Date(now);
      d.setMonth(d.getMonth() + 6);
      return d;
    }
    case PricingTier.ONE_YEAR: {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() + 1);
      return d;
    }
    case PricingTier.LIFETIME:
    case PricingTier.LIFETIME_SOURCE: {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() + 100);
      return d;
    }
    case PricingTier.SECRET_TEST_TIER: {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      return d;
    }
    default:
      return assertNever(tier);
  }
}

function assertNever(x: never): never {
  throw new Error(`Non-exhaustive PricingTier switch: ${JSON.stringify(x)}`);
}
```

Notes:
- Do NOT re-implement date math via a library; Node stdlib `Date` mutators are what the current code uses (see `src/lib/subscriptions.ts:29-45`). Consistency matters.
- Keep `mapTier` lowercase-normalising (`tierRaw.trim().toLowerCase()`) so the aliases `free_trial`, `one_month`, `monthly`, `six_months`, `biannual`, `secret_test` from the old switch stop working — that's INTENTIONAL. Aliases were a source of drift. Every caller (`create-session`, webhook GET, free-trial) now passes the canonical `TierId` slug (kebab-case with digits). If any caller passes an alias like `monthly`, it will now throw `UnknownTierError` → 400. Grep for `mapTier(` usage after this change is Task 3's responsibility.
- `TierId` is imported as a type-only import (`import type`) — no runtime code from `src/config/pricing.ts`.

Then create `src/lib/pricing-tiers.test.ts` following the project's existing `node:test` pattern (see `src/lib/pricing-showcase.test.ts` for style — `import test from "node:test"; import assert from "node:assert/strict";`):

```typescript
// src/lib/pricing-tiers.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { PricingTier } from "@prisma/client";
import {
  mapTier,
  computeExpirationDate,
  TIER_METADATA,
  UnknownTierError,
} from "./pricing-tiers";

test("every TierId slug maps to the correct PricingTier enum value (no silent downgrade)", () => {
  for (const [slug, meta] of Object.entries(TIER_METADATA)) {
    assert.equal(mapTier(slug), meta.enum, `${slug} → ${meta.enum}`);
  }
});

test("mapTier throws UnknownTierError on unknown input (regression: PRIC-02 default fallthrough)", () => {
  assert.throws(() => mapTier("not-a-real-tier"), UnknownTierError);
  assert.throws(() => mapTier(""), UnknownTierError);
  assert.throws(() => mapTier("monthly"), UnknownTierError); // old alias — no longer supported
});

test("mapTier normalises case and whitespace", () => {
  assert.equal(mapTier("  1-YEAR  "), PricingTier.ONE_YEAR);
  assert.equal(mapTier("Lifetime-Source"), PricingTier.LIFETIME_SOURCE);
});

test("1-year does NOT silently downgrade to ONE_MONTH (regression: PRIC-02)", () => {
  assert.equal(mapTier("1-year"), PricingTier.ONE_YEAR);
  const expiry = computeExpirationDate(PricingTier.ONE_YEAR);
  const daysOut = Math.round((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  assert.ok(daysOut >= 364 && daysOut <= 366, `expected ~365 days, got ${daysOut}`);
});

test("lifetime-source does NOT silently downgrade to ONE_MONTH (regression: PRIC-02)", () => {
  assert.equal(mapTier("lifetime-source"), PricingTier.LIFETIME_SOURCE);
});

test("10-days does NOT silently downgrade to ONE_MONTH (regression: PRIC-02)", () => {
  assert.equal(mapTier("10-days"), PricingTier.TEN_DAYS);
  const expiry = computeExpirationDate(PricingTier.TEN_DAYS);
  const daysOut = Math.round((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  assert.ok(daysOut >= 9 && daysOut <= 11, `expected ~10 days, got ${daysOut}`);
});

test("computeExpirationDate returns a far-future date for lifetime tiers", () => {
  const lifetimeExpiry = computeExpirationDate(PricingTier.LIFETIME);
  const yearsOut = Math.round((lifetimeExpiry.getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000));
  assert.ok(yearsOut >= 99 && yearsOut <= 101, `expected ~100 years, got ${yearsOut}`);
});

test("computeExpirationDate handles every enum value (compile-time exhaustiveness)", () => {
  for (const meta of Object.values(TIER_METADATA)) {
    // Must not throw the assertNever runtime guard.
    assert.ok(computeExpirationDate(meta.enum) instanceof Date);
  }
});
```
  </action>
  <verify>
1. `test -f src/lib/pricing-tiers.ts && test -f src/lib/pricing-tiers.test.ts` — both files exist.
2. `npx tsc --noEmit` — TypeScript compilation must pass (proves TierId ↔ PricingTier alignment and assertNever exhaustiveness).
3. `node --test --experimental-strip-types src/lib/pricing-tiers.test.ts` — ALL tests pass. (If `--experimental-strip-types` is unavailable on this Node version, fall back to `npx tsx --test src/lib/pricing-tiers.test.ts`; if neither works, transpile manually via `npx tsc src/lib/pricing-tiers.test.ts --outDir /tmp/test --module nodenext --target es2022 --moduleResolution nodenext && node --test /tmp/test/pricing-tiers.test.js`.)
4. Expected test output must include lines confirming the four regression tests pass: `1-year does NOT silently downgrade`, `lifetime-source does NOT silently downgrade`, `10-days does NOT silently downgrade`, and `mapTier throws UnknownTierError`.
  </verify>
  <done>
`src/lib/pricing-tiers.ts` exports `TIER_METADATA`, `mapTier`, `computeExpirationDate`, `UnknownTierError`, `TierMetadata`. `src/lib/pricing-tiers.test.ts` has ≥7 tests, all passing under `node:test`. `mapTier("1-year")` returns `ONE_YEAR`; `mapTier("lifetime-source")` returns `LIFETIME_SOURCE`; `mapTier("10-days")` returns `TEN_DAYS`; `mapTier("unknown")` throws `UnknownTierError`. TypeScript compilation is clean.
  </done>
</task>

<task type="auto">
  <name>Task 3: Delete legacy mapTier from subscriptions.ts; wire UnknownTierError through free-trial route</name>
  <files>src/lib/subscriptions.ts, src/app/api/checkout/free-trial/route.ts</files>
  <action>
Delete the legacy inline `mapTier` and `computeExpirationDate` from `src/lib/subscriptions.ts` (currently lines 6-45) and replace with re-exports from the new module so existing callers keep working.

At the top of `src/lib/subscriptions.ts`, delete the inline `mapTier` function (lines 6-27 of the current file) AND the inline `computeExpirationDate` function (lines 29-45). Replace with a single import at the top of the file:

```typescript
import { PricingTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendPurchaseConfirmationEmail } from "@/lib/mail";
import { buildMagicLinkUrl, createMagicLinkToken } from "@/lib/magic-links";
import { mapTier, computeExpirationDate, UnknownTierError } from "@/lib/pricing-tiers";

// Re-export so existing imports elsewhere (webhook route.ts, create-session, etc.)
// don't need to change their import path in this plan. Plan 02-02 may migrate
// callers to import directly from ./pricing-tiers.
export { mapTier, computeExpirationDate, UnknownTierError };
```

Keep everything else in `src/lib/subscriptions.ts` unchanged (`findOrCreateUser`, `formatTierLabel`, `createUserMagicLink`, `provisionSubscription`). The `provisionSubscription` function already calls `mapTier(tierRaw)` on its first line (currently line 100) — after this change, that call now throws `UnknownTierError` on bad input INSTEAD of silently returning `ONE_MONTH`. Callers of `provisionSubscription` must catch the error → return HTTP 400.

Then update `src/app/api/checkout/free-trial/route.ts` (currently line 31 calls `provisionSubscription(normalizedEmail, "free-trial")`). Since `"free-trial"` is a hardcoded literal that IS a valid `TierId`, the `UnknownTierError` case is impossible today — BUT for defense-in-depth and to match the pattern the webhook + create-session routes will adopt in Plan 02-02, wrap the `provisionSubscription` call in a try/catch that surfaces `UnknownTierError` as HTTP 400:

Replace the current `try` block body (lines 18-44) with:

```typescript
  try {
    const body = await req.json();
    const { email } = body;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[Free Trial] Processing trial for: ${normalizedEmail}`);

    let result;
    try {
      result = await provisionSubscription(normalizedEmail, "free-trial");
    } catch (err) {
      if (err instanceof UnknownTierError) {
        // Defensive: should never fire for hardcoded "free-trial", but matches
        // the webhook + create-session pattern (Plan 02-02) — no silent 500 on tier drift.
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    if (!result.emailSuccess) {
      return NextResponse.json({
        error: "Your account was created, but we failed to send the welcome sign-in link. Please contact support@al-ai-fx.xyz for a secure sign-in link."
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Free trial activated successfully.",
      ...result
    }, { status: 201 });

  } catch (error) {
    console.error("Free trial error:", error);
    return NextResponse.json({ error: "Failed to process free trial." }, { status: 500 });
  }
```

Add the import at the top of `src/app/api/checkout/free-trial/route.ts`:

```typescript
import { UnknownTierError } from "@/lib/pricing-tiers";
```

Note: the error copy update ("welcome sign-in link" vs old "welcome email with your credentials / get your password") also fixes the stale magic-link mismatch flagged in CONCERNS.md line 63-67. Keep this copy change — it's one line and the current copy is a support-confusion hazard.

Do NOT touch `src/app/api/webhooks/paygate/route.ts` or `src/app/api/paygate/create-session/route.ts` in this plan — those files are owned by Plan 02-02 (which will import `UnknownTierError` from `@/lib/pricing-tiers` in parallel).
  </action>
  <verify>
1. `grep -n "^function mapTier\|^function computeExpirationDate\|^export function mapTier\|^export function computeExpirationDate" src/lib/subscriptions.ts` — must return NOTHING (both inline definitions deleted).
2. `grep -n "from \"@/lib/pricing-tiers\"" src/lib/subscriptions.ts` — must show the import line.
3. `grep -n "UnknownTierError" src/app/api/checkout/free-trial/route.ts` — must show both the import AND the instanceof check.
4. `npx tsc --noEmit` — TypeScript compilation must pass (proves all downstream callers of `mapTier`/`computeExpirationDate` still type-check after the re-export path).
5. `npx eslint src/lib/subscriptions.ts src/app/api/checkout/free-trial/route.ts src/lib/pricing-tiers.ts` — no unused-import errors.
6. `node --test --experimental-strip-types src/lib/pricing-tiers.test.ts` — all tests still pass (regression: the re-export from subscriptions.ts must not break the module).
  </verify>
  <done>
`src/lib/subscriptions.ts` no longer defines `mapTier` or `computeExpirationDate` inline — both are re-exported from `@/lib/pricing-tiers`. `provisionSubscription` now throws `UnknownTierError` (via `mapTier`) on unknown tier strings instead of silently returning `ONE_MONTH`. `src/app/api/checkout/free-trial/route.ts` catches `UnknownTierError` → HTTP 400. TypeScript + ESLint + `node:test` all pass.
  </done>
</task>

</tasks>

<verification>
Overall Plan 02-01 verification (proves PRIC-02 is closed):

1. **Schema is deployed:** `npx prisma db push` reports "in sync" (no pending changes) on second invocation.
2. **Tests pass:** `node --test --experimental-strip-types src/lib/pricing-tiers.test.ts` — all ≥7 tests green, including the four regression tests for `1-year`, `lifetime-source`, `10-days`, and `UnknownTierError`.
3. **No dead code:** `grep -rn "return PricingTier.ONE_MONTH" src/lib/` returns NOTHING (proves the `default: return PricingTier.ONE_MONTH` fallthrough is gone).
4. **Type-safety:** `npx tsc --noEmit` clean — proves the exhaustive switch in `computeExpirationDate` is TypeScript-enforced.
5. **Lint clean:** `npx eslint src/lib/pricing-tiers.ts src/lib/subscriptions.ts src/app/api/checkout/free-trial/route.ts` — no errors, no dead imports.
6. **Manual smoke (optional, dev):** From a Node REPL, `require("./dist/lib/pricing-tiers.js").mapTier("1-year")` (after `npx tsc`) returns the string `"ONE_YEAR"`; `require("./dist/lib/pricing-tiers.js").mapTier("bogus")` throws `UnknownTierError`.
</verification>

<success_criteria>
PRIC-02 closed:
- [x] Every tier advertised in `src/config/pricing.ts` maps to a real `PricingTier` enum value with a correct expiry — no `default` fallthrough. An unknown tier is refused, not coerced.

Acceptance metrics:
- `mapTier("1-year")` returns `PricingTier.ONE_YEAR` (verified by `pricing-tiers.test.ts`)
- `mapTier("lifetime-source")` returns `PricingTier.LIFETIME_SOURCE` (verified)
- `mapTier("10-days")` returns `PricingTier.TEN_DAYS` (verified)
- `mapTier("unknown")` throws `UnknownTierError` (verified)
- `computeExpirationDate(PricingTier.ONE_YEAR)` ≈ +365d (verified)
- `computeExpirationDate` is exhaustive — a future enum extension without a matching case fails `tsc --noEmit` (verified by `assertNever` pattern)
- Remote Postgres has all 8 enum values (`prisma db push` in-sync)
- Free-trial route surfaces `UnknownTierError` as HTTP 400 (verified by grep + inspection)
</success_criteria>

<output>
After completion, create `.planning/phases/02-payment-pricing-launch-blockers/02-01-pricing-tier-alignment-SUMMARY.md` following `/Users/klev/.claude/get-shit-done/templates/summary.md`. Include in frontmatter:
- `requirements_closed: [PRIC-02]`
- `subsystem: payments-pricing`
- `key_files: [prisma/schema.prisma, src/lib/pricing-tiers.ts, src/lib/pricing-tiers.test.ts, src/lib/subscriptions.ts, src/app/api/checkout/free-trial/route.ts]`
- `decisions:` bullet list capturing (a) enum values chosen (TEN_DAYS/ONE_YEAR/LIFETIME_SOURCE), (b) `db push` used per Phase 2 pattern, (c) canonical-slug-only policy (aliases like `monthly` now throw), (d) `assertNever` exhaustiveness pattern chosen over runtime coverage checks.
</output>
