---
phase: 01-restore-compile-delivery
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - src/lib/compiler-config.ts
autonomous: true

must_haves:
  truths:
    - "Prisma schema declares WorkerHeartbeat singleton model with id, lastSeenAt, workerVersion"
    - "Compilation model has attemptCount (Int, default 0), attemptedAt (DateTime?), sha256 (String?), sizeBytes (Int?), errorMessage (String?)"
    - "src/lib/compiler-config.ts exports single-source-of-truth constants used by poll/complete/reaper/admin status"
    - "Remote Coolify Postgres has the new columns and table applied via prisma db push (no runtime SQL errors on next deploy)"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "WorkerHeartbeat model + Compilation attemptCount/attemptedAt/sha256/sizeBytes/errorMessage fields + indexes on [status, createdAt] and [status, attemptedAt]"
      contains: "model WorkerHeartbeat"
    - path: "src/lib/compiler-config.ts"
      provides: "HEARTBEAT_STALE_SECONDS, HEARTBEAT_DEAD_SECONDS, STUCK_JOB_MINUTES, MAX_ATTEMPTS, CLIENT_POLL_INITIAL_MS, CLIENT_POLL_MAX_MS, CLIENT_POLL_TIMEOUT_MS"
      exports: ["HEARTBEAT_STALE_SECONDS", "HEARTBEAT_DEAD_SECONDS", "STUCK_JOB_MINUTES", "MAX_ATTEMPTS", "CLIENT_POLL_INITIAL_MS", "CLIENT_POLL_MAX_MS", "CLIENT_POLL_TIMEOUT_MS"]
  key_links:
    - from: "prisma db push"
      to: "remote Coolify Postgres (DATABASE_URL)"
      via: "prisma CLI"
      pattern: "npx prisma db push"
    - from: "src/lib/compiler-config.ts"
      to: "future imports in poll/complete/reaper/admin-status/LicenseManager"
      via: "named exports"
      pattern: "export const .* = "
---

<objective>
Land the schema deltas and shared constants that everything else in Phase 1 depends on. Nothing here talks to Vercel Blob, daemon, or admin UI yet — this plan is pure infrastructure: one Prisma model, five new columns on Compilation, one config module, one `db push`.

Purpose: Every other plan in Phase 1 needs `WorkerHeartbeat`, `Compilation.attemptCount`, `Compilation.attemptedAt`, `Compilation.sha256`, `Compilation.sizeBytes`, `Compilation.errorMessage`, plus a single shared source of truth for reaper thresholds and client-poll timeouts. Split into its own wave so plans 02/03 can run in parallel afterward.

Output: Updated schema, applied to remote DB via `prisma db push`, plus `src/lib/compiler-config.ts` exporting constants.
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-restore-compile-delivery/1-RESEARCH.md
@prisma/schema.prisma
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add WorkerHeartbeat model + Compilation retry/upload fields to Prisma schema</name>
  <files>prisma/schema.prisma</files>
  <action>
Edit `prisma/schema.prisma`. Make these exact changes:

1. Extend the existing `Compilation` model (currently at lines 59-67). Add these fields immediately after `downloadUrl String?`:

```prisma
  // Retry + reaper state (Phase 1)
  attemptCount   Int           @default(0)
  attemptedAt    DateTime?
  errorMessage   String?

  // Upload metadata written by /complete route (Phase 1 direct-to-Blob path)
  sha256         String?
  sizeBytes      Int?
```

Keep `createdAt` and `updatedAt` in place. After the `updatedAt` field but before the closing brace, add two indexes:

```prisma
  @@index([status, createdAt])
  @@index([status, attemptedAt])
```

2. Add a brand-new model at the bottom of the file (after `enum CompileStatus`):

```prisma
model WorkerHeartbeat {
  id            String   @id                // singleton row keyed "compiler"
  lastSeenAt    DateTime
  workerVersion String?
  updatedAt     DateTime @updatedAt
}
```

Naming rationale (locked in this phase, do not deviate):
- `attemptCount` (not `attempts`) — clearer, matches the "counter" mental model used by the reaper.
- `attemptedAt` (not `startedAt`) — describes "the moment we last handed this off to a worker", makes reaper logic ("attemptedAt older than STUCK_JOB_MINUTES") read naturally, and avoids collision with any future `startedAt` on a related booking/schedule concept.
- `WorkerHeartbeat.id` is a plain `String @id` (no `@default`) — singleton row `id = "compiler"` upserted by the poll route.

Do NOT touch: User, Subscription, Order, PricingTier, SubStatus, OrderStatus, CompileStatus, UserRole. Do NOT add `Robot` or `robotId` here — that is Phase 3.
  </action>
  <verify>
Run `npx prisma format` — must succeed with no diff other than whitespace.
Then run `npx prisma validate` — must exit 0.
`grep -c "model WorkerHeartbeat" prisma/schema.prisma` should return 1.
`grep -c "attemptCount" prisma/schema.prisma` should return 1.
`grep -c "attemptedAt" prisma/schema.prisma` should return 1.
`grep -c "@@index(\[status" prisma/schema.prisma` should return 2.
  </verify>
  <done>Schema file compiles under `prisma validate`, contains WorkerHeartbeat model + five new Compilation fields + two indexes; unrelated models are untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Push schema to remote Coolify Postgres + regenerate Prisma client</name>
  <files>
  (no files created — this task applies the schema from Task 1 to the DB)
  </files>
  <action>
Apply the schema to the remote Coolify Postgres and regenerate the client so the rest of Phase 1 can import the new types.

1. Confirm `DATABASE_URL` is set locally (it points to the remote Coolify Postgres — see .planning/PROJECT.md notes). Run: `test -n "$DATABASE_URL" && echo OK || echo "MISSING DATABASE_URL"`. If missing, source it from `.env` / `.env.local` before proceeding.

2. Run `npx prisma db push --accept-data-loss=false`. The `--accept-data-loss=false` flag is defensive — no destructive change is expected (all new fields are nullable or have defaults, and WorkerHeartbeat is a new table). If Prisma reports a data-loss warning, STOP and investigate — do not force.

3. Run `npx prisma generate` to refresh the Prisma client types so downstream plans can import `prisma.workerHeartbeat` and see `attemptCount`/`attemptedAt`/`sha256`/`sizeBytes`/`errorMessage` on `Compilation`.

4. Seed the singleton row so the poll route can `.upsert(...)` and the admin status endpoint can `.findUnique(...)` immediately without a `null` window:

```bash
npx prisma db execute --stdin <<'SQL'
INSERT INTO "WorkerHeartbeat" ("id", "lastSeenAt", "updatedAt")
VALUES ('compiler', NOW() - INTERVAL '1 hour', NOW())
ON CONFLICT ("id") DO NOTHING;
SQL
```

The 1-hour-old `lastSeenAt` means admin dashboard reports "red" until the worker first polls — accurate representation of current state (VM inspection confirms daemon has been offline since 2026-04-19).

5. Sanity-check with raw SQL: `npx prisma db execute --stdin <<< 'SELECT column_name FROM information_schema.columns WHERE table_name = '\''Compilation'\'';'` — output must include `attemptCount`, `attemptedAt`, `sha256`, `sizeBytes`, `errorMessage`.

NOTE on migrations directory: `prisma/migrations/` is intentionally NOT populated here. Per STATE.md and RESEARCH pitfall #11, `db push` is the stopgap for Phase 1; Phase 3 will formalize migrations via `prisma migrate diff` from a baseline. Do NOT run `prisma migrate dev` — that would create a migration file the codebase is not yet ready for.
  </action>
  <verify>
`npx prisma db execute --stdin <<< "SELECT id, \"lastSeenAt\" FROM \"WorkerHeartbeat\";"` returns exactly one row with id = 'compiler'.
`npx prisma db execute --stdin <<< "SELECT column_name FROM information_schema.columns WHERE table_name = 'Compilation' AND column_name IN ('attemptCount', 'attemptedAt', 'sha256', 'sizeBytes', 'errorMessage');"` returns 5 rows.
`node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.workerHeartbeat.findUnique({where: {id: 'compiler'}}).then(r => { console.log(r); return p.\$disconnect(); });"` prints the seeded row (no TS error, model exists on the client).
  </verify>
  <done>Remote Postgres has the new WorkerHeartbeat table + five new Compilation columns + both indexes; Prisma client regenerated; singleton heartbeat row seeded; no destructive changes reported by prisma db push.</done>
</task>

<task type="auto">
  <name>Task 3: Add src/lib/compiler-config.ts with shared threshold constants</name>
  <files>src/lib/compiler-config.ts</files>
  <action>
Create a new file at `src/lib/compiler-config.ts`. Contents:

```typescript
/**
 * Single source of truth for compiler pipeline timing constants.
 *
 * Values were tuned against real MQL5 compile times (10-30s typical) and
 * the daemon's 10s poll interval. Adjust here; do not inline elsewhere.
 *
 * @see .planning/phases/01-restore-compile-delivery/1-RESEARCH.md
 */

// Heartbeat freshness — used by /api/admin/compiler-status + reaper's alert path.
// Daemon posts a heartbeat on every /poll (roughly every 10s).
export const HEARTBEAT_STALE_SECONDS = 90;   // > 3 missed polls => "stale" (yellow)
export const HEARTBEAT_DEAD_SECONDS = 300;   // > 5 min => "red" + admin email alert

// Reaper — a Compilation stuck in PROCESSING past this many minutes with no
// terminal state (COMPLETED/FAILED) is re-queued or failed.
export const STUCK_JOB_MINUTES = 10;

// Bounded retry — how many total attempts before the reaper (or /complete's
// FAILED path) transitions the row to permanent FAILED. Counter is `attemptCount`
// on the Compilation row; incremented on each requeue.
export const MAX_ATTEMPTS = 3;

// Client-side polling budget — LicenseManager.tsx uses these to cap its
// setTimeout loop and transition to a TIMED_OUT UI state on the frontend.
// Together they must exceed STUCK_JOB_MINUTES * MAX_ATTEMPTS with margin so
// the client never gives up before the reaper has finished its retries, but
// don't loop forever if something upstream is stuck.
export const CLIENT_POLL_INITIAL_MS = 5_000;
export const CLIENT_POLL_MAX_MS = 30_000;
export const CLIENT_POLL_TIMEOUT_MS = 5 * 60_000; // 5 minutes wall clock
```

Notes:
- Use `_` separator in numeric literals (5_000, not 5000) for readability — TS supports this.
- Do not export via `default` — everything is a named `export const` so downstream code reads `import { STUCK_JOB_MINUTES } from '@/lib/compiler-config'`.
- Do not add any behavior here — this file is constants-only. No side effects, no `console`, no functions.
  </action>
  <verify>
`test -f src/lib/compiler-config.ts && echo OK`.
`npx tsc --noEmit src/lib/compiler-config.ts` succeeds (no type errors).
`grep -c "^export const" src/lib/compiler-config.ts` returns 7 (all named exports).
  </verify>
  <done>File exists, exports the 7 named constants, passes `tsc --noEmit`, imports cleanly from anywhere in the src tree (verified in later plans).</done>
</task>

</tasks>

<verification>
End-of-plan checks:
- `npx prisma validate` succeeds.
- Remote Postgres has WorkerHeartbeat table (SELECT succeeds).
- Compilation has attemptCount, attemptedAt, sha256, sizeBytes, errorMessage columns.
- src/lib/compiler-config.ts exports all 7 named constants.
- No unrelated files touched.
- `git diff --stat` shows exactly two changed files (schema.prisma, compiler-config.ts).
</verification>

<success_criteria>
1. Schema deltas applied to remote DB, verifiable by SQL introspection.
2. Prisma client can `.workerHeartbeat.findUnique(...)` and reference all five new Compilation fields with no TS error.
3. Every downstream Phase 1 plan can `import { X } from '@/lib/compiler-config'` and receive a real value (not undefined).
4. Singleton `WorkerHeartbeat { id: "compiler" }` row exists so `.upsert(...)` in Plan 03 works from the first poll.
</success_criteria>

<output>
After completion, create `.planning/phases/01-restore-compile-delivery/01-01-SUMMARY.md`.
</output>
