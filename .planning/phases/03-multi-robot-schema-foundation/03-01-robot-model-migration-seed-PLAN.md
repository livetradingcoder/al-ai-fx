---
phase: 03-multi-robot-schema-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - prisma/migrations/0_init/migration.sql
  - prisma/migrations/migration_lock.toml
  - scripts/seed-goldbot.js
  - package.json
autonomous: true

must_haves:
  truths:
    - "A Robot model exists in prisma/schema.prisma with id, slug (@unique), name, shortDescription, longDescription (@db.Text), active (default true), artworkUrl (nullable), sortOrder (default 0), createdAt, updatedAt"
    - "Subscription.robotId is a NON-NULL String FK to Robot (default onDelete: Restrict — no cascade)"
    - "Compilation.robotId is a NON-NULL String FK to Robot (default onDelete: Restrict — no cascade)"
    - "prisma/migrations/0_init/migration.sql exists, is committed, and contains CREATE TABLE \"Robot\" plus the robotId FK constraints for Subscription and Compilation"
    - "The remote Postgres has been reset and 0_init applied via migrate deploy through the Vercel build-step channel — _prisma_migrations table now tracks 0_init as applied (no P3005)"
    - "A single Robot row with slug 'goldbot', name 'GoldBot', active true exists in remote Postgres (seeded)"
    - "package.json build script is reverted to 'prisma generate && next build' in a follow-up commit (no migrate/force-reset left in build)"
    - "npx prisma validate passes and npx prisma generate produces a client exposing prisma.robot"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "Robot model + robotId FKs on Subscription/Compilation"
      contains: "model Robot"
    - path: "prisma/migrations/0_init/migration.sql"
      provides: "Full-schema first migration generated offline via migrate diff --from-empty"
      contains: "CREATE TABLE \"Robot\""
      min_lines: 40
    - path: "scripts/seed-goldbot.js"
      provides: "Idempotent GoldBot seed (upsert on slug) mirroring scripts/create-admin.js"
      contains: "robot.upsert"
      min_lines: 15
  key_links:
    - from: "prisma/schema.prisma Subscription.robotId"
      to: "Robot.id"
      via: "@relation(fields: [robotId], references: [id])"
      pattern: "robotId String"
    - from: "prisma/schema.prisma Compilation.robotId"
      to: "Robot.id"
      via: "@relation(fields: [robotId], references: [id])"
      pattern: "robotId String"
    - from: "scripts/seed-goldbot.js"
      to: "Robot table"
      via: "prisma.robot.upsert({ where: { slug: 'goldbot' } })"
      pattern: "slug: ['\"]goldbot['\"]"
---

<objective>
Establish the first formal Prisma migration boundary for this repo and land the `Robot` catalog model. Today the remote Postgres was built entirely by `prisma db push` across Phase 1/2 with NO migration history (no `prisma/migrations/` dir, no `_prisma_migrations` table). This plan wipes that DB (pre-approved — test data is disposable per PROJECT.md Key Decision) and adopts a clean, checked-in migration history from `0_init` forward.

Because the reset gives us an empty DB, the ENTIRE new schema — including the `Robot` model AND the NON-NULL `robotId` FKs on `Subscription`/`Compilation` — goes into a single `0_init` migration. This means Plan 03-02 (code wiring) needs NO further schema change or deploy; the columns already exist in the DB after this plan. Seed GoldBot as the first `Robot` row so the whole rest of the milestone has a real catalog entry to reference.

Purpose: Satisfy CTLG-01 (Robot model), CTLG-04 (robotId FKs — schema half), CTLG-05 (GoldBot seed), and Success Criteria 1–3. This is the schema ground Phases 4–7 build on.

Output:
- `prisma/schema.prisma` — new `Robot` model + `robotId` NON-NULL FKs on `Subscription` and `Compilation`
- `prisma/migrations/0_init/migration.sql` — full-schema first migration, generated offline, committed to repo
- `prisma/migrations/migration_lock.toml` — Prisma's provider lock file
- `scripts/seed-goldbot.js` — idempotent GoldBot upsert (mirrors `scripts/create-admin.js`)
- Remote Postgres reset + `0_init` applied + GoldBot seeded, via the proven Vercel build-step channel
- `package.json` build script reverted to normal in a follow-up commit
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
@.planning/phases/03-multi-robot-schema-foundation/3-RESEARCH.md
@prisma/schema.prisma
@prisma.config.ts
@package.json
@scripts/create-admin.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Robot model + robotId FKs to schema; generate 0_init migration offline</name>
  <files>prisma/schema.prisma, prisma/migrations/0_init/migration.sql, prisma/migrations/migration_lock.toml</files>
  <action>
Edit `prisma/schema.prisma` to add the `Robot` model and thread NON-NULL `robotId` FKs through `Subscription` and `Compilation`.

**1a. Add the `Robot` model** (place it after the `Order` model, before `Compilation`, or at end of models — anywhere valid). Use exactly these fields (mandated by Success Criterion 1 / CTLG-01):

```prisma
model Robot {
  id               String   @id @default(cuid())
  slug             String   @unique          // "goldbot" — join key for Blob path (sources/<slug>/) + compiled filename
  name             String                     // "GoldBot" — display name
  shortDescription String                     // catalog card copy
  longDescription  String   @db.Text          // detail-page copy — Postgres text, avoids varchar cap
  active           Boolean  @default(true)     // catalog visibility flag
  artworkUrl       String?                     // nullable until artwork asset exists
  sortOrder        Int      @default(0)        // catalog ordering
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  subscriptions Subscription[]
  compilations  Compilation[]

  @@index([active, sortOrder])                 // catalog list query: where active order by sortOrder
}
```

**1b. Add `robotId` to `Subscription`** (currently lines 31-44). Add these two lines inside the model (keep all existing fields):

```prisma
  robotId          String
  robot            Robot       @relation(fields: [robotId], references: [id])
```

Do NOT add `onDelete: Cascade` — the default `onDelete: Restrict` is correct and intended: a Robot referenced by any subscription cannot be deleted (retire via `active=false` instead), so a paying user's license is never orphaned by a catalog edit.

**1c. Add `robotId` to `Compilation`** (currently lines 59-80). Add these two lines inside the model (keep all existing fields incl. the two `@@index` lines):

```prisma
  robotId        String
  robot          Robot         @relation(fields: [robotId], references: [id])
```

Same rule: default `Restrict`, no cascade. Denormalizing `robotId` onto `Compilation` (rather than deriving via `Compilation → Subscription`) is intentional — the compile worker's filename generation needs the slug directly and a compilation's robot is immutable once created.

NON-NULL is safe here ONLY because the DB is being wiped in Task 2 (no existing rows to backfill).

**1d. Validate + generate the client locally** (offline, no DB needed). All node/prisma commands MUST use Node v20 — prepend the bin dir:

```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"
npx prisma validate       # must print "The schema ... is valid"
npx prisma generate       # regenerates client with prisma.robot
```

**1e. Generate the `0_init` migration SQL offline** via `migrate diff` (verified available: `--from-empty`, `--to-schema-datamodel`, `--script` all exist in the installed prisma 6.19.3 CLI). This does NOT need a DB connection — it diffs an empty datamodel against the schema file:

```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"
mkdir -p prisma/migrations/0_init
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
```

Then create `prisma/migrations/migration_lock.toml` (Prisma requires this file for a migrations dir; provider must match the datasource):

```toml
# Please do not edit this file manually
# It should be added in your version-control system (i.e. Git)
provider = "postgresql"
```

Inspect the generated SQL to confirm it captured everything: `grep -c 'CREATE TABLE' prisma/migrations/0_init/migration.sql` should be ≥6 (User, Subscription, Order, Robot, Compilation, WorkerHeartbeat, WebhookDelivery) and `grep 'Robot' prisma/migrations/0_init/migration.sql` must show the Robot table + the two `robotId` FK constraints.

Do NOT hand-edit the generated SQL — it is dialect-correct as produced.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"
```
1. `grep -n "model Robot" prisma/schema.prisma` — Robot model present.
2. `grep -n "robotId String" prisma/schema.prisma` — appears twice (Subscription + Compilation).
3. `grep -n "@db.Text" prisma/schema.prisma` — longDescription is text.
4. `npx prisma validate` — prints valid.
5. `npx prisma generate` — completes; then `node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); console.log(typeof p.robot.upsert)"` prints `function`.
6. `test -f prisma/migrations/0_init/migration.sql && grep -q 'CREATE TABLE "Robot"' prisma/migrations/0_init/migration.sql && echo OK` — prints OK.
7. `grep -q 'CONSTRAINT' prisma/migrations/0_init/migration.sql && grep -qi 'robotId' prisma/migrations/0_init/migration.sql && echo FK-OK` — prints FK-OK.
8. `test -f prisma/migrations/migration_lock.toml` — lock file exists.
  </verify>
  <done>
`prisma/schema.prisma` has the `Robot` model (all 10 CTLG-01 fields) and NON-NULL `robotId` FKs (default Restrict) on both `Subscription` and `Compilation`. `prisma/migrations/0_init/migration.sql` exists with `CREATE TABLE "Robot"` and the robotId FK constraints. `migration_lock.toml` exists. `prisma validate` + `prisma generate` succeed; the generated client exposes `prisma.robot`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Write idempotent GoldBot seed script</name>
  <files>scripts/seed-goldbot.js</files>
  <action>
Create `scripts/seed-goldbot.js` following the exact convention of `scripts/create-admin.js` (plain CommonJS `node` script, `require('@prisma/client')`, top `eslint-disable`, `upsert` for idempotency). This is invoked in Task 3's build step after `migrate deploy` and is safe to re-run.

Use canonical LOWERCASE slug `goldbot` (the join key for Blob paths `sources/goldbot/` and the compiled filename slug — Plan 03-02 reconciles `compiler-filename.ts`'s current capital-`GoldBot` default to this). Keep `name: "GoldBot"` for display.

```js
/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedGoldbot() {
  const robot = await prisma.robot.upsert({
    where: { slug: 'goldbot' },
    update: {}, // idempotent — do not clobber edits on re-run
    create: {
      slug: 'goldbot',
      name: 'GoldBot',
      shortDescription: 'Automated XAUUSD (gold) expert advisor for MetaTrader 5.',
      longDescription:
        'GoldBot is AL-ai-FX\'s flagship automated trading robot for the XAUUSD (gold) market on MetaTrader 5. Each license is locked to a single MT5 account number and delivered as a compiled .ex5 within minutes of checkout.',
      active: true,
      sortOrder: 0,
    },
  });
  console.log(`[seed-goldbot] Robot ready: id=${robot.id} slug=${robot.slug} active=${robot.active}`);
}

seedGoldbot()
  .catch((err) => {
    console.error('[seed-goldbot] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

`upsert` on the unique `slug` makes it race-free and rerunnable — same pattern as `create-admin.js`. Do NOT use `findFirst`-then-`create`.
  </action>
  <verify>
1. `test -f scripts/seed-goldbot.js` — exists.
2. `grep -n "robot.upsert" scripts/seed-goldbot.js` — uses upsert.
3. `grep -n "slug: 'goldbot'" scripts/seed-goldbot.js` — canonical lowercase slug.
4. `export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH" && npx eslint scripts/seed-goldbot.js` — no lint errors.
5. `node -c scripts/seed-goldbot.js` — parses without syntax error.
  </verify>
  <done>
`scripts/seed-goldbot.js` upserts a GoldBot Robot row keyed on `slug: 'goldbot'`, idempotent on re-run, matching `create-admin.js` conventions. Lints and parses clean. (It is NOT executed locally in this task — the live DB is only reachable via the build channel in Task 3.)
  </done>
</task>

<task type="auto">
  <name>Task 3: Reset remote DB + apply 0_init + seed GoldBot via Vercel build-step channel, then revert build script</name>
  <files>package.json</files>
  <action>
Apply the migration to the remote Postgres. `DATABASE_URL` is Vercel-Sensitive (write-only) so nothing needing a live connection runs locally — use the PROVEN build-step channel (used successfully in Phase 2 plans 02-01 and 02-03). `vercel` CLI is authenticated; if bare `vercel` doesn't resolve, use `/Users/klev/.nvm/versions/node/v22.22.2/bin/vercel`.

**3a. Temporarily edit the `package.json` `build` script.** Current value is `"prisma generate && next build"`. Change it to (verified flags: `--force-reset` and `--accept-data-loss` both exist in prisma 6.19.3 `db push --help`):

```json
"build": "prisma generate && prisma db push --force-reset --accept-data-loss && prisma migrate deploy && node scripts/seed-goldbot.js && next build"
```

Rationale for this exact sequence:
- `prisma db push --force-reset --accept-data-loss` — WIPES the drifted remote DB to empty (non-interactive; `migrate reset` can prompt in a non-TTY build, `db push --force-reset` does not). This drops the tables built by the old `db push` cycles.
- `prisma migrate deploy` — on the now-empty DB, creates `_prisma_migrations` and applies `0_init` cleanly. Empty DB ⇒ NO P3005.
- `node scripts/seed-goldbot.js` — inserts the GoldBot Robot row after the schema exists.

**3b. Commit the build-script edit** (single commit), then deploy:

```bash
vercel --prod --yes
```

**3c. Confirm success in the build logs.** Capture the deployment URL from the `vercel --prod` output, then:

```bash
vercel inspect <deployment-url> --logs 2>&1 | grep -iE 'migrat|in sync|0_init|seed-goldbot|Robot ready|force-reset'
```

Success looks like: the reset ran, `migrate deploy` reports applying `0_init` (or "No pending migrations to apply" is WRONG here — it must APPLY 0_init on first run), and `[seed-goldbot] Robot ready: ... slug=goldbot active=true` appears. If you see `P3005`, the reset step did not run before deploy — investigate the build script ordering. If the deploy build fails, read the full log (`vercel inspect <url> --logs`) and fix before proceeding; do NOT revert the build script until the migration is confirmed applied (otherwise the fix is lost).

**3d. Revert the build script in a SEPARATE follow-up commit.** Set `build` back to exactly:

```json
"build": "prisma generate && next build"
```

This is MANDATORY — leaving `--force-reset` in the build script would wipe prod on EVERY future deploy (catastrophic). Same apply-then-revert discipline as 02-01/02-03. Commit this revert immediately after log confirmation.
  </action>
  <verify>
1. After 3a, before commit: `grep '"build"' package.json` shows the temporary `db push --force-reset ... migrate deploy ... seed-goldbot` chain.
2. `vercel --prod --yes` — deployment completes (build succeeds).
3. `vercel inspect <deployment-url> --logs 2>&1 | grep -iE 'Robot ready|0_init|migrat'` — shows `0_init` applied AND `[seed-goldbot] Robot ready: ... slug=goldbot`. No `P3005` anywhere in the log.
4. After 3d: `grep '"build"' package.json` shows EXACTLY `"prisma generate && next build"` — no `migrate`, no `force-reset`, no `seed-goldbot` remain.
5. `git log --oneline -3` — shows two distinct commits: one adding the migrate build step, one reverting it.
  </verify>
  <done>
Remote Postgres has been reset; `_prisma_migrations` now tracks `0_init` as applied (no P3005); the `Robot` table exists with a seeded `goldbot` row (active, sortOrder 0); `Subscription` and `Compilation` tables have the `robotId` FK column. `package.json` `build` is reverted to `"prisma generate && next build"` in a separate commit — no destructive commands linger in the build.
  </done>
</task>

</tasks>

<verification>
Overall Plan 03-01 verification (proves the schema foundation is live):

1. **Schema is correct:** `grep -c "robotId String" prisma/schema.prisma` returns 2; `grep -q "model Robot" prisma/schema.prisma`.
2. **Migration is checked in:** `prisma/migrations/0_init/migration.sql` exists in git with `CREATE TABLE "Robot"` and robotId FK constraints; `prisma/migrations/migration_lock.toml` exists.
3. **Client generates:** `npx prisma generate` clean; `prisma.robot` is a delegate.
4. **DB applied + seeded:** Build logs from the `vercel --prod` deploy show `0_init` applied and `[seed-goldbot] Robot ready: ... slug=goldbot active=true`, with no `P3005`.
5. **Build reverted:** `package.json` `build` is `"prisma generate && next build"` — no residual `migrate`/`--force-reset`/`seed-goldbot`.
6. **Two-commit discipline:** git history shows apply commit followed by revert commit.
</verification>

<success_criteria>
CTLG-01, CTLG-05, and the schema half of CTLG-04 closed; Success Criteria 1–3 satisfied:
- [x] A `Robot` row exists in Postgres with id, slug, name, short/long description, active, artworkUrl, sortOrder, timestamps — introspectable, referenceable (Criterion 1).
- [x] `Subscription.robotId` and `Compilation.robotId` are NON-NULL FKs at the schema/DB level (Criterion 2 — code wiring completes in 03-02).
- [x] Test DB wiped; seed script recreates GoldBot cleanly as the first catalog entry (Criterion 3).
- [x] First checked-in Prisma migration (`0_init`) applied to remote Postgres via the proven build-step channel; migration history now exists (ends the `db push` era per STATE.md decision).
</success_criteria>

<output>
After completion, create `.planning/phases/03-multi-robot-schema-foundation/03-01-robot-model-migration-seed-SUMMARY.md` following `/Users/klev/.claude/get-shit-done/templates/summary.md`. Include in frontmatter:
- `requirements_closed: [CTLG-01, CTLG-05]` (CTLG-04 schema half done here; code half in 03-02 — note it as partial)
- `subsystem: multi-robot-schema`
- `key_files: [prisma/schema.prisma, prisma/migrations/0_init/migration.sql, scripts/seed-goldbot.js, package.json]`
- `decisions:` bullet list capturing (a) reset-and-clean-baseline chosen over baselining (data wipeable — no P3005/resolve risk), (b) full schema incl. robotId FKs in single `0_init` so 03-02 needs no further deploy, (c) NON-NULL robotId with default Restrict onDelete (no cascade — protects paid licenses), (d) canonical lowercase slug `goldbot` (display name `GoldBot`), (e) standalone `scripts/seed-goldbot.js` over Prisma-native seed config (matches create-admin.js, avoids 6.19 config-key uncertainty), (f) `db push --force-reset` for non-interactive wipe then `migrate deploy`.
</output>
