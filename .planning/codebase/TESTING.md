# Testing Patterns

**Analysis Date:** 2026-07-04

## Test Framework

**Runner:**
- **Node.js built-in test runner** (`node:test`) — no Jest, Vitest, or Mocha.
- Version: whatever Node ships (project targets `@types/node: ^20`, so Node 20+).
- No dedicated test config file (no `jest.config.*`, `vitest.config.*`).

**Assertion Library:**
- **Node's built-in `node:assert/strict`** — imported as `import assert from "node:assert/strict";`.
- Provides `assert.equal`, `assert.deepEqual`, `assert.throws`, etc. Strict variants use `===` semantics.

**Test discovery:**
- Tests are co-located with source files as `<name>.test.ts` (e.g., `src/lib/seo.ts` + `src/lib/seo.test.ts`).
- No `__tests__/` directory convention.

**Run Commands:**
- **There is no `test` script in `package.json`** — see `/Users/klev/Code/al-ai-fx/package.json`. Scripts are limited to `dev`, `build`, `start`, `lint`, `postinstall`.
- Tests must be run manually. Suggested commands:

```bash
# Run a single test file (requires a TS loader for node:test — tsx is the simplest):
npx tsx --test src/lib/seo.test.ts

# Or use Node's --experimental-strip-types flag on Node 22+:
node --test --experimental-strip-types src/lib/seo.test.ts

# There is no wired-up "run all tests" command; add one before writing more tests, e.g.:
#   "test": "tsx --test 'src/**/*.test.ts'"
```

**Gap:** A test script should be added to `package.json` and to CI. This is currently a manual/local workflow.

## Test File Organization

**Location:**
- Co-located with the module under test. Example: `src/lib/magic-links.ts` → `src/lib/magic-links.test.ts`.
- Message-parity test lives with the messages: `src/messages/landing-localization.test.ts`.

**Naming:**
- `<module-name>.test.ts` — matches the source file's kebab-case name.

**Existing test files (6 total, 349 lines total):**
- `src/lib/auth-redirects.test.ts` (18 lines, 2 tests) — locale-aware login redirect URL builder.
- `src/lib/magic-links.test.ts` (50 lines, 3 tests) — JWT round-trip and magic-link URL construction.
- `src/lib/marketing.test.ts` (45 lines, 5 tests) — Google Ads / Meta Pixel env-var normalization and thank-you URL builder.
- `src/lib/pricing-showcase.test.ts` (72 lines, 4 tests) — subscription/pass/coming-soon/contact plan shape and ordering.
- `src/lib/seo.test.ts` (65 lines, 6 tests) — SEO metadata generation, canonical URLs, hreflang alternates, sitemap coverage.
- `src/messages/landing-localization.test.ts` (94 lines, 1 test) — verifies every locale JSON contains all required Landing-namespace keys.

**Structure:**
```
src/
├── lib/
│   ├── auth-redirects.ts
│   ├── auth-redirects.test.ts       # co-located
│   ├── magic-links.ts
│   ├── magic-links.test.ts
│   ├── marketing.ts
│   ├── marketing.test.ts
│   ├── pricing-showcase.ts
│   ├── pricing-showcase.test.ts
│   ├── seo.ts
│   └── seo.test.ts
└── messages/
    ├── en.json
    ├── de.json
    ├── ... (7 locales)
    └── landing-localization.test.ts # cross-locale parity check
```

## Test Structure

**Suite Organization:**

Tests are written flat as top-level `test(name, fn)` calls — there is no `describe` block, no `beforeEach`/`afterEach`. Each `test` is a self-contained function that constructs its inputs inline and asserts on outputs.

**Actual pattern from `src/lib/magic-links.test.ts`:**

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMagicLinkUrl,
  createMagicLinkToken,
  verifyMagicLinkToken,
} from "./magic-links";

test("createMagicLinkToken round-trips the payload", () => {
  const token = createMagicLinkToken(
    {
      email: "test@example.com",
      purpose: "login",
      userId: "user_123",
    },
    "secret",
    "15m",
  );

  const payload = verifyMagicLinkToken(token, "secret");

  assert.equal(payload.email, "test@example.com");
  assert.equal(payload.purpose, "login");
  assert.equal(payload.userId, "user_123");
});
```

**Patterns:**
- **Setup:** inline in each test — no shared fixtures or `before` hooks.
- **Teardown:** none — all tests are pure functions with no side effects to clean up.
- **Assertion style:** `assert.equal(actual, expected)` for primitives; `assert.deepEqual(actual, expected)` for arrays/objects.
- **Naming:** Test names are declarative sentences describing the behavior (`"buildLoginRedirectPath keeps default locale unprefixed"`, `"subscription plans keep the yearly plan featured"`, `"contact offers replace public lifetime pricing with concierge paths"`).
- **Imports:** `test` from `node:test`, `assert` from `node:assert/strict`, then module under test via relative path (`./magic-links`).
- **One assertion cluster per test** — a test may assert several fields of one output, but does not exercise multiple unrelated behaviors.

## Mocking

**Framework:** None. Node's built-in test runner supports `mock` (`import { mock } from "node:test"`) but the codebase does not use it.

**Actual pattern — hand-rolled stubs:**

`src/lib/pricing-showcase.test.ts` fakes the `next-intl` translator by passing a plain function that mimics `t(key, values)`:

```typescript
type TranslatorValues = {
  fallback?: string;
  price?: string;
};

const t = (_key: string, values?: TranslatorValues) => {
  if (values?.price) {
    return `(${values.price} / month)`;
  }
  return values?.fallback ?? _key;
};

test("subscription plans keep the yearly plan featured", () => {
  const plans = buildSubscriptionPlans(t);
  // ...
});
```

**Pattern — dependency injection over mocking:**

`src/lib/marketing.ts` accepts an env-var object as a parameter so tests can pass a synthetic `MarketingEnv` without touching `process.env`:

```typescript
// Under test — production defaults to process.env:
export function getMarketingConfig(env: MarketingEnv = process.env as unknown as MarketingEnv): MarketingConfig { ... }

// In the test:
const config = getMarketingConfig({
  NEXT_PUBLIC_GOOGLE_ADS_ID: " AW-123456 ",
  // ...
});
```

**What to Mock:**
- Nothing is mocked. The testable functions are designed to be pure or to accept their dependencies as arguments.

**What NOT to Mock:**
- Do not mock Prisma, next-auth, mailtrap, or `@vercel/blob` — none of the code that touches these is currently under test. Extract pure logic into a helper that can be called with plain values (as `pricing-showcase.ts` and `marketing.ts` do) and test the helper.

**File-system access (used sparingly):**

`src/messages/landing-localization.test.ts` reads the locale JSON files directly with `node:fs` — no mocking, real filesystem:

```typescript
import fs from "node:fs";
import path from "node:path";

const messagesDir = path.join(process.cwd(), "src/messages");
const localeFiles = fs.readdirSync(messagesDir).filter((f) => f.endsWith(".json"));
```

## Fixtures and Factories

**Test Data:**

Inline literal objects. No factory library, no shared fixtures directory.

Example — building a payload inline:
```typescript
const token = createMagicLinkToken(
  {
    email: "test@example.com",
    purpose: "login",
    userId: "user_123",
  },
  "secret",
  "15m",
);
```

Example — synthetic env object:
```typescript
const config = getMarketingConfig({
  NEXT_PUBLIC_GOOGLE_ADS_ID: " AW-123456 ",
  NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_BEGIN_CHECKOUT: " begin123 ",
  NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_PURCHASE: " purchase456 ",
  NEXT_PUBLIC_META_PIXEL_ID: " 987654321 ",
});
```

**Location:**
- Fixtures live inline in the test that uses them. No shared `fixtures/`, `factories/`, or `__fixtures__/` directory.
- Real assets used for parity: `src/messages/*.json` are the "fixture" for locale tests.

## Coverage

**Requirements:** None enforced. There is no coverage configuration, no CI gate.

**Current coverage state:**
- 6 test files exercise ~5 modules in `src/lib/` plus a locale-parity check on `src/messages/`.
- **Untested areas:** all API routes (`src/app/api/**`), all React components (`src/components/**`, `src/app/[locale]/**/page.tsx`), NextAuth callbacks (`src/lib/auth.ts`), Prisma-touching services (`src/lib/subscriptions.ts`), mailtrap sender (`src/lib/mail.ts`), rate limiter (`src/lib/rate-limit.ts`), input validators (`src/lib/validation.ts`), middleware (`src/proxy.ts`).

**View Coverage:**
- No coverage tooling installed. If needed, add `c8` and run `npx c8 --reporter=text tsx --test 'src/**/*.test.ts'`.

## Test Types

**Unit Tests:**
- All existing tests are unit tests over pure functions in `src/lib/`.
- Scope: input → output, no I/O (except `landing-localization.test.ts` reading JSON files).
- Approach: import the function, call it with literal inputs, assert on the return value.

**Integration Tests:**
- None. Nothing exercises the API-route → Prisma → response chain end-to-end.

**E2E Tests:**
- Not used. No Playwright, Cypress, or Puppeteer.

**Locale parity tests:**
- `src/messages/landing-localization.test.ts` iterates all locale JSON files and asserts every required `Landing.*` key is a non-empty string. Extend the `requiredLandingKeys` array when adding new Landing namespace strings.

## Common Patterns

**Async Testing:**
- Existing tests are all synchronous. If an async function is under test, `test(name, async () => { ... })` is the pattern to use — Node's test runner awaits returned promises.

**Error Testing:**
- No existing tests assert on thrown errors, but the pattern would be:

```typescript
test("verifyMagicLinkToken throws on bad signature", () => {
  assert.throws(() => verifyMagicLinkToken("bad", "secret"));
});
```

**Filesystem access:**
- Use `node:fs` and `node:path` directly (see `landing-localization.test.ts`). Anchor paths at `process.cwd()` so tests work regardless of where they are invoked from.

**Deep-object assertions:**
- Use `assert.deepEqual(actual, expected)` for arrays and objects — see `pricing-showcase.test.ts:30-34` mapping plans to price arrays before comparing.

**Type-narrowing in assertions:**
- When Next.js metadata unions get in the way, cast through `any` at the assertion site — this is the only pragmatic `any` usage in tests (see `seo.test.ts:47-48`). Prefer proper narrowing when adding new metadata tests.

## Guidance for New Tests

1. Create `<module>.test.ts` co-located with the source.
2. Use only `node:test` + `node:assert/strict` — do not introduce Jest/Vitest without team agreement (would require a build change).
3. Write flat `test("behavior sentence", () => { ... })` — no `describe`.
4. If the function needs a `next-intl` translator or `process.env`, refactor the function to accept it as a parameter (as `getMarketingConfig` and `buildSubscriptionPlans` do) rather than mocking module state.
5. Do not add tests that require a live Prisma or Mailtrap connection until a test-DB/mock strategy exists — extract pure logic instead.
6. Add a `"test"` script to `package.json` before adding tests across new directories.

---

*Testing analysis: 2026-07-04*
