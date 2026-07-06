---
phase: 06-public-catalog-per-robot-pricing-free-trials
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - prisma/migrations/20260706_add_robot_pricing_and_trial_index/migration.sql
  - src/lib/robot-pricing.ts
  - scripts/seed-robot-prices.js
  - package.json
autonomous: true

must_haves:
  truths:
    - "A RobotPrice table exists in production with composite unique (robotId, tier), an amount Float, and an active flag — each active robot can carry its own per-tier price rows"
    - "A Postgres PARTIAL unique index enforces at most one FREE_TRIAL Subscription per (userId, robotId) EVER — an expired trial cannot be re-claimed (existence-ever, not active-ever)"
    - "resolveRobotPrice(robotSlug, tierRaw) returns the server-authoritative { robot, tier, amount } for an active robot with an active price row, and THROWS (UnknownRobotError / UnknownRobotPriceError / UnknownTierError) for unknown/inactive robot, untiered/inactive price, or unknown tier — never coerces to a default"
    - "GoldBot has RobotPrice rows seeded from the current TIER_METADATA values for all 8 tiers, so GoldBot checkout does not fail-closed to zero prices after the migration"
    - "The migration was applied to production via the build-step channel (migrate deploy, NOT reset) and the package.json build script was reverted in a separate commit"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "RobotPrice model + prices RobotPrice[] relation on Robot"
      contains: "model RobotPrice"
    - path: "prisma/migrations/20260706_add_robot_pricing_and_trial_index/migration.sql"
      provides: "CREATE TABLE RobotPrice + partial unique trial index"
      contains: "Subscription_one_free_trial_per_robot"
    - path: "src/lib/robot-pricing.ts"
      provides: "resolveRobotPrice + UnknownRobotError + UnknownRobotPriceError"
      contains: "export async function resolveRobotPrice"
    - path: "scripts/seed-robot-prices.js"
      provides: "idempotent upsert of GoldBot RobotPrice rows from TIER_METADATA amounts"
      contains: "robotPrice.upsert"
  key_links:
    - from: "src/lib/robot-pricing.ts"
      to: "prisma.robotPrice"
      via: "findUnique on composite robotId_tier"
      pattern: "robotPrice\\.findUnique"
    - from: "src/lib/robot-pricing.ts"
      to: "src/lib/pricing-tiers.ts mapTier"
      via: "reuse fail-closed tier mapping"
      pattern: "mapTier\\("
    - from: "scripts/seed-robot-prices.js"
      to: "prisma.robotPrice"
      via: "upsert on robotId_tier composite"
      pattern: "robotId_tier"
---

<objective>
Establish the per-robot pricing data foundation the whole phase builds on: a thin `RobotPrice` table (price + active per robot+tier), a Postgres **partial unique index** that makes the one-free-trial-per-robot rule DB-enforced and race-safe, a fail-closed `resolveRobotPrice()` resolver mirroring the existing `UnknownTierError` discipline, and a seed that gives GoldBot its own price rows so nothing breaks after the migration.

Purpose: Satisfies phase success criterion 3 (each active robot has its own enforceable pricing rows) and lays the DB-level guard for criterion 4 (one free trial per robot). This is the schema/lib foundation — the catalog (06-02), payment funnel (06-03), and admin price editor (06-04) all depend on the `RobotPrice` table and `resolveRobotPrice()` existing.

Output:
- `prisma/schema.prisma` — `RobotPrice` model + `prices RobotPrice[]` on `Robot`
- `prisma/migrations/20260706_add_robot_pricing_and_trial_index/migration.sql` — `CREATE TABLE "RobotPrice"` + `CREATE UNIQUE INDEX ... WHERE "tier" = 'FREE_TRIAL'`
- `src/lib/robot-pricing.ts` — `resolveRobotPrice`, `UnknownRobotError`, `UnknownRobotPriceError`
- `scripts/seed-robot-prices.js` — idempotent GoldBot price seed from `TIER_METADATA`
- Applied to production via the build-step channel; build script reverted separately
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
@prisma/schema.prisma
@prisma/migrations/20260705_add_source_version/migration.sql
@prisma/migrations/migration_lock.toml
@scripts/seed-goldbot.js
@src/lib/pricing-tiers.ts
@src/config/pricing.ts
@src/lib/prisma.ts
@AGENTS.md
</context>

<critical_environment_notes>
- **Node:** prepend `export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"` for every node/npx/tsc/eslint/prisma call.
- **NO local DB access.** `DATABASE_URL` is a Vercel-Sensitive write-only secret. Author migration SQL locally (file-only prisma commands work offline); APPLY only via the proven build-step channel: temporarily edit `package.json` `build`, `vercel --prod --yes`, confirm in the build log, then REVERT the build script in a **separate** commit.
- **Incremental migration, NOT a reset.** History exists since `0_init`. This is a normal `prisma migrate deploy`. NEVER `migrate reset` / `db push --force-reset` — that was the one-time Phase 3 bootstrap and would wipe production data. The build-log must show "Applying migration 20260706_add_robot_pricing_and_trial_index" and NOTHING resetting.
- **Partial unique index is NOT expressible in schema.prisma.** Add the `RobotPrice` model to the schema normally, but the `CREATE UNIQUE INDEX ... WHERE "tier" = 'FREE_TRIAL'` is hand-appended raw SQL in the migration file. Prisma's `migrate deploy` runs migration SQL verbatim, so this applies fine; a later `migrate diff` would not "see" it in the schema — document that it is intentional and must not be reverted.
- **Keep TIER_METADATA as the tier/duration SSoT.** Do NOT put duration or priceString into `RobotPrice`. Only `amount` + `active` are per-robot. `RobotPrice.tier` is the `PricingTier` enum (the join key), so the DB enforces tier validity for free.
- **Next 16 / Prisma 6.19:** per AGENTS.md, if unsure about any Prisma migration behavior read `node_modules/prisma` / `node_modules/next/dist/docs/` before writing. Copy the shape of the existing `20260705_add_source_version/migration.sql`.
</critical_environment_notes>

<tasks>

<task type="auto">
  <name>Task 1: Add RobotPrice model + author the migration SQL (table + partial trial index)</name>
  <files>prisma/schema.prisma, prisma/migrations/20260706_add_robot_pricing_and_trial_index/migration.sql</files>
  <action>
**1a. Add the `RobotPrice` model to `prisma/schema.prisma`** (place it after the `Robot` model). Keep it price-only — no duration, no priceString:
```prisma
model RobotPrice {
  id        String      @id @default(cuid())
  robotId   String
  robot     Robot       @relation(fields: [robotId], references: [id], onDelete: Cascade)
  tier      PricingTier
  amount    Float       // per-robot price in USD; 0 for FREE_TRIAL
  active    Boolean     @default(true) // hide a tier for one robot without deleting the row
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@unique([robotId, tier]) // one price row per (robot, tier) — gives Prisma the robotId_tier composite
  @@index([robotId, active])
}
```
Add the back-relation to the existing `Robot` model (a new line among its relations):
```prisma
  prices RobotPrice[]
```
Run `npx prisma format` then `npx prisma validate` to confirm the schema is well-formed (both are file-only, no DB).

**1b. Author the migration SQL by diffing the schema against the last migration** (file-only — no DB connection):
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
mkdir -p prisma/migrations/20260706_add_robot_pricing_and_trial_index
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260706_add_robot_pricing_and_trial_index/migration.sql
```
This generates the `CREATE TABLE "RobotPrice"`, its FK, the `@@unique` index, and the `@@index`. Read the generated file to confirm it contains ONLY the RobotPrice additions (a `CREATE TABLE "RobotPrice"`, a unique index on `("robotId","tier")`, and an index on `("robotId","active")`) and nothing that drops/alters existing tables. If `migrate diff` is unavailable offline, hand-write the SQL mirroring the `20260705_add_source_version` shape.

**1c. Hand-append the partial unique index** (NOT expressible in schema.prisma) to the END of that same `migration.sql`:
```sql
-- One free trial per robot, EVER (existence-ever, not active-ever): a partial
-- unique index. Not expressible in schema.prisma — applied as raw SQL here and
-- intentionally invisible to `migrate diff`. Do NOT let a later diff "correct" it.
CREATE UNIQUE INDEX "Subscription_one_free_trial_per_robot"
  ON "Subscription" ("userId", "robotId")
  WHERE "tier" = 'FREE_TRIAL';
```
Do NOT run `prisma migrate dev` (needs DB). The migration is applied via the build channel in Task 3.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q 'model RobotPrice' prisma/schema.prisma && echo MODEL_OK
grep -q 'prices RobotPrice\[\]' prisma/schema.prisma && echo RELATION_OK
grep -q '@@unique(\[robotId, tier\])' prisma/schema.prisma && echo COMPOSITE_OK
npx prisma validate && echo SCHEMA_VALID
grep -q 'CREATE TABLE "RobotPrice"' prisma/migrations/20260706_add_robot_pricing_and_trial_index/migration.sql && echo TABLE_SQL_OK
grep -q 'Subscription_one_free_trial_per_robot' prisma/migrations/20260706_add_robot_pricing_and_trial_index/migration.sql && echo TRIAL_INDEX_OK
grep -q "WHERE \"tier\" = 'FREE_TRIAL'" prisma/migrations/20260706_add_robot_pricing_and_trial_index/migration.sql && echo PARTIAL_OK
# must NOT drop/reset anything:
! grep -qiE 'DROP TABLE|--force-reset|DROP DATABASE' prisma/migrations/20260706_add_robot_pricing_and_trial_index/migration.sql && echo NO_DESTRUCTIVE
```
  </verify>
  <done>`RobotPrice` model added (composite unique, active flag, price-only) with `prices` relation on Robot; schema validates; migration.sql contains the CREATE TABLE plus the hand-appended partial unique trial index and nothing destructive.</done>
</task>

<task type="auto">
  <name>Task 2: resolveRobotPrice resolver + GoldBot seed script</name>
  <files>src/lib/robot-pricing.ts, scripts/seed-robot-prices.js</files>
  <action>
**2a. Create `src/lib/robot-pricing.ts`** — mirror the fail-closed style of `pricing-tiers.ts`. NEVER trust a client-supplied amount; always compute from the DB row:
```ts
import { prisma } from "@/lib/prisma";
import { mapTier } from "@/lib/pricing-tiers"; // throws UnknownTierError on bad tier

export class UnknownRobotError extends Error {
  constructor(slug: string) {
    super(`Unknown or inactive robot: ${slug}`);
    this.name = "UnknownRobotError";
  }
}

export class UnknownRobotPriceError extends Error {
  constructor(key: string) {
    super(`No active price for: ${key}`);
    this.name = "UnknownRobotPriceError";
  }
}

/**
 * Server-authoritative price resolution for (robot, tier). Fail-closed:
 * - unknown tier         -> UnknownTierError (from mapTier)
 * - missing/inactive robot -> UnknownRobotError
 * - missing/inactive price row -> UnknownRobotPriceError
 * NEVER returns a default; NEVER trusts a client-supplied amount.
 */
export async function resolveRobotPrice(robotSlug: string, tierRaw: string) {
  const tier = mapTier(tierRaw); // throws UnknownTierError
  const robot = await prisma.robot.findUnique({ where: { slug: robotSlug } });
  if (!robot || !robot.active) throw new UnknownRobotError(robotSlug);

  const price = await prisma.robotPrice.findUnique({
    where: { robotId_tier: { robotId: robot.id, tier } },
  });
  if (!price || !price.active) throw new UnknownRobotPriceError(`${robotSlug}/${tierRaw}`);

  return { robot, tier, amount: price.amount };
}
```

**2b. Create `scripts/seed-robot-prices.js`** — mirror `scripts/seed-goldbot.js` style (CommonJS `require`, idempotent upsert on the `robotId_tier` composite, `update: {}` so it never clobbers admin edits). Seed GoldBot's rows from the current `TIER_METADATA` amounts (hardcode the values — this is a JS build script and cannot import the TS SSoT; mirror the exact amounts from `src/lib/pricing-tiers.ts`, and comment that they must stay in sync with TIER_METADATA at seed time):
```js
/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Amounts mirror TIER_METADATA (src/lib/pricing-tiers.ts) at seed time. Admin
// edits (06-04) override these later; upsert update:{} makes re-runs non-clobbering.
const GOLDBOT_PRICES = [
  { tier: 'FREE_TRIAL',       amount: 0 },
  { tier: 'TEN_DAYS',         amount: 69 },
  { tier: 'ONE_MONTH',        amount: 199 },
  { tier: 'SIX_MONTHS',       amount: 999 },
  { tier: 'ONE_YEAR',         amount: 1799 },
  { tier: 'LIFETIME',         amount: 7999 },
  { tier: 'LIFETIME_SOURCE',  amount: 79999 },
  { tier: 'SECRET_TEST_TIER', amount: 10 },
];

async function seed() {
  const goldbot = await prisma.robot.findUniqueOrThrow({ where: { slug: 'goldbot' } });
  for (const { tier, amount } of GOLDBOT_PRICES) {
    await prisma.robotPrice.upsert({
      where: { robotId_tier: { robotId: goldbot.id, tier } },
      update: {}, // idempotent — never clobber admin edits on re-run
      create: { robotId: goldbot.id, tier, amount, active: true },
    });
  }
  console.log(`[seed-robot-prices] Seeded ${GOLDBOT_PRICES.length} RobotPrice rows for goldbot (id=${goldbot.id}).`);
}

seed()
  .catch((err) => { console.error('[seed-robot-prices] FAILED:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
```
Note: this script needs the migrated schema + generated client — it runs in the build step AFTER `migrate deploy` (Task 3).
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q 'export async function resolveRobotPrice' src/lib/robot-pricing.ts && echo RESOLVER_OK
grep -q 'class UnknownRobotError' src/lib/robot-pricing.ts && echo ROBOT_ERR_OK
grep -q 'class UnknownRobotPriceError' src/lib/robot-pricing.ts && echo PRICE_ERR_OK
grep -q 'robotPrice.findUnique' src/lib/robot-pricing.ts && echo LOOKUP_OK
grep -q 'mapTier(' src/lib/robot-pricing.ts && echo REUSE_MAPTIER_OK
grep -q 'robotId_tier' scripts/seed-robot-prices.js && echo SEED_COMPOSITE_OK
grep -q 'update: {}' scripts/seed-robot-prices.js && echo SEED_IDEMPOTENT_OK
# resolver typechecks (needs prisma client generated for RobotPrice — generate first):
npx prisma generate >/dev/null && npx tsc --noEmit && echo TSC_OK
npx eslint src/lib/robot-pricing.ts && echo ESLINT_OK
```
  </verify>
  <done>`resolveRobotPrice` fail-closed resolver exists (reuses `mapTier`, throws UnknownRobot/RobotPrice errors, reads the composite `robotId_tier` row, computes amount server-side); `seed-robot-prices.js` idempotently upserts all 8 GoldBot tiers from TIER_METADATA amounts; tsc + eslint clean after `prisma generate`.</done>
</task>

<task type="auto">
  <name>Task 3: Apply the migration + seed to production via the build-step channel (then revert)</name>
  <files>package.json</files>
  <action>
Apply the migration and seed to LIVE production via the proven build-step channel — this project has NO local DB access.

1. Temporarily edit the `package.json` `build` script to run the migration + seed before `next build`:
   ```
   "build": "prisma generate && prisma migrate deploy && node scripts/seed-robot-prices.js && next build"
   ```
   (Keep `prisma generate` first. `migrate deploy` applies ONLY the new `20260706_...` migration incrementally. `seed-robot-prices.js` runs after, so GoldBot gets its price rows in the same deploy — Pitfall 3 fix.)
2. Commit this temporary change: `chore(06-01): temp build-step to apply robot-pricing migration + seed`.
3. Deploy: `vercel --prod --yes` (from repo root). Watch the build log.
4. **Confirm in the build log** (Pitfall 2 guard):
   - It shows `Applying migration \`20260706_add_robot_pricing_and_trial_index\`` (or "1 migration applied") and NO reset / P3005 / DROP.
   - `[seed-robot-prices] Seeded 8 RobotPrice rows for goldbot` appears.
   - `next build` completes and the deploy succeeds.
   If the log shows a reset or P3005, STOP and diagnose — do not proceed.
5. **Revert** the build script in a SEPARATE commit (leave `build` as `prisma generate && next build`): `chore(06-01): revert temp build-step after robot-pricing migration applied`. Do NOT re-deploy is unnecessary — the migration is already applied; the revert just restores the normal build for the next deploy.
6. Verify production actually has the rows: since there is no local DB, prove it via a subsequent-deploy assertion OR a tiny temporary read (only if a read channel exists). At minimum, the build-log seed line + successful `migrate deploy` line are the acceptance evidence; capture both in the SUMMARY.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
# After the revert commit, the build script is back to normal:
grep -q '"build": "prisma generate && next build"' package.json && echo BUILD_REVERTED_OK
# Two commits exist (temp + revert):
git log --oneline -5 | grep -q 'revert temp build-step' && echo REVERT_COMMIT_OK
```
Plus the human-readable evidence captured from the Vercel build log: the "Applying migration 20260706..." line and the "[seed-robot-prices] Seeded 8 RobotPrice rows" line.
  </verify>
  <done>Production has the `RobotPrice` table, the partial trial index, and GoldBot's 8 seeded price rows — proven by the Vercel build log showing the incremental `migrate deploy` (no reset) and the seed output; the temporary build script was reverted in a separate commit.</done>
</task>

</tasks>

<verification>
- `RobotPrice` model in schema (composite unique `(robotId, tier)`, `amount`, `active`); `prices` relation on `Robot`; `prisma validate` clean.
- Migration file has `CREATE TABLE "RobotPrice"` + hand-appended `CREATE UNIQUE INDEX "Subscription_one_free_trial_per_robot" ... WHERE "tier" = 'FREE_TRIAL'`; nothing destructive.
- `resolveRobotPrice` throws `UnknownTierError` / `UnknownRobotError` / `UnknownRobotPriceError` and never defaults; amount comes from the DB row.
- `seed-robot-prices.js` idempotently seeds GoldBot's 8 tiers.
- Migration + seed applied to production via build-step channel (incremental `migrate deploy`, no reset); build script reverted separately.
- `npx tsc --noEmit` + `npx eslint` clean.
</verification>

<success_criteria>
- PRIC-01/PRIC-03: each active robot can carry independent per-tier price rows, enforceable server-side via `resolveRobotPrice`.
- TRIL-01 (DB guard): partial unique index makes one-free-trial-per-robot existence-ever enforced (the code-level throw handling lands in 06-03).
- GoldBot's current prices preserved as `RobotPrice` rows (no fail-closed-to-zero regression).
</success_criteria>

<output>
After completion, create `.planning/phases/06-public-catalog-per-robot-pricing-free-trials/06-01-SUMMARY.md` with frontmatter: `phase`, `plan`, `status: complete`, `requirements: [PRIC-01, PRIC-03, TRIL-01]`, `files_changed`, `commits`, `key_decisions` (RobotPrice is price-only, TIER_METADATA stays SSoT for tiers/durations; partial unique index applied as raw SQL, intentionally invisible to migrate diff — must not be reverted; resolveRobotPrice fail-closed with UnknownRobotError/UnknownRobotPriceError; incremental migrate deploy NOT reset; GoldBot seeded from TIER_METADATA amounts) and `provides` — note for downstream plans that `resolveRobotPrice(robotSlug, tierRaw)` is the single server-side price authority, the composite lookup key is `robotId_tier`, and the trial index throws P2002 on a second FREE_TRIAL insert for the same (userId, robotId).
</output>
