---
phase: 03-multi-robot-schema-foundation
plan: 02
type: execute
wave: 2
depends_on: [03-01]
files_modified:
  - src/lib/subscriptions.ts
  - src/app/api/checkout/free-trial/route.ts
  - src/app/api/webhooks/paygate/route.ts
  - src/app/api/licenses/update-mt5/route.ts
  - src/app/api/compiler/poll/route.ts
  - src/lib/compiler-filename.ts
autonomous: true

must_haves:
  truths:
    - "provisionSubscription resolves the GoldBot Robot (by slug 'goldbot') and writes robotId on every Subscription it creates — no subscription is created without a robotId"
    - "update-mt5 route sets Compilation.robotId from the parent subscription's robotId at creation time (denormalized, not derived at read)"
    - "The GoldBot slug flows from the DB Robot row (or a single canonical constant) — compiler-filename.ts no longer hardcodes a capital-G 'GoldBot' default that disagrees with the DB slug 'goldbot'"
    - "poll route response is additive-only — optionally includes robot slug, never removes existing fields (daemon compatibility preserved)"
    - "npx tsc --noEmit passes — every prisma.subscription.create / prisma.compilation.create call type-checks with the now-required robotId"
    - "npx eslint on all touched files passes"
  artifacts:
    - path: "src/lib/subscriptions.ts"
      provides: "provisionSubscription resolves goldbot Robot and writes robotId"
      contains: "robotId"
    - path: "src/app/api/licenses/update-mt5/route.ts"
      provides: "Compilation created with robotId from subscription.robotId"
      contains: "robotId"
    - path: "src/lib/compiler-filename.ts"
      provides: "Canonical slug reconciled with DB (lowercase goldbot)"
      contains: "goldbot"
  key_links:
    - from: "src/lib/subscriptions.ts provisionSubscription"
      to: "Robot table (slug goldbot)"
      via: "prisma.robot.findUniqueOrThrow({ where: { slug } }) then subscription.create({ data: { robotId } })"
      pattern: "robotId"
    - from: "src/app/api/licenses/update-mt5/route.ts"
      to: "Compilation.robotId"
      via: "subscription.robotId propagated into compilation.create data"
      pattern: "robotId: subscription.robotId"
---

<objective>
Complete CTLG-04's code half: thread `robotId` through every write path that creates a `Subscription` or `Compilation`, so Success Criterion 2 ("every new subscription and compile job is scoped to exactly one robot") holds at runtime, not just in the schema. Plan 03-01 already added the NON-NULL `robotId` columns to the DB — this plan makes the application populate them. Without it, `prisma.subscription.create` / `prisma.compilation.create` will fail at runtime (and `tsc` will error) because `robotId` is now required.

For Phase 3 there is exactly one robot (GoldBot), so every write path resolves the single `goldbot` Robot row. Multi-robot selection (passing a robot slug from checkout/catalog) is Phase 4+/Phase 6 UX work — NOT in scope here. This plan also reconciles the pre-existing slug-casing drift: `compiler-filename.ts` defaults to capital `"GoldBot"` while the DB slug is lowercase `"goldbot"` (Pitfall 6 in research).

Purpose: Close CTLG-04 (code half) / Success Criterion 2.

Output:
- `src/lib/subscriptions.ts` — `provisionSubscription` resolves the `goldbot` Robot and writes `robotId` on the subscription
- `src/app/api/licenses/update-mt5/route.ts` — includes `robotId` (from `subscription.robotId`) when creating the compilation
- `src/app/api/compiler/poll/route.ts` — additive: optionally include robot slug in the poll response (daemon ignores it until Phase 4)
- `src/lib/compiler-filename.ts` — canonical lowercase `goldbot` default, reconciled with DB
- `free-trial` + `paygate` webhook routes — unchanged in behavior (they call `provisionSubscription`, which now resolves GoldBot internally); no signature change needed for single-robot Phase 3
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-multi-robot-schema-foundation/3-RESEARCH.md
@.planning/phases/03-multi-robot-schema-foundation/03-01-robot-model-migration-seed-PLAN.md
@src/lib/subscriptions.ts
@src/app/api/licenses/update-mt5/route.ts
@src/app/api/compiler/poll/route.ts
@src/lib/compiler-filename.ts
@src/app/api/checkout/free-trial/route.ts
@src/app/api/webhooks/paygate/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Resolve GoldBot Robot in provisionSubscription and write robotId on every Subscription</name>
  <files>src/lib/subscriptions.ts</files>
  <action>
`provisionSubscription` (src/lib/subscriptions.ts:58-142) currently creates a `Subscription` without `robotId` (line 96-103). Now that `robotId` is a required column, resolve the single GoldBot Robot and include its id.

Add a canonical slug constant near the top of the file (below the imports), so the slug string lives in one place:

```ts
// Phase 3: single-robot. Every subscription/compilation is scoped to GoldBot.
// Multi-robot selection (slug passed from checkout/catalog) is Phase 4+/6 work.
const GOLDBOT_SLUG = "goldbot";
```

Inside `provisionSubscription`, before the `prisma.subscription.create` call (currently line 96), resolve the Robot row:

```ts
  const robot = await prisma.robot.findUniqueOrThrow({
    where: { slug: GOLDBOT_SLUG },
  });
```

Use `findUniqueOrThrow` (not `findUnique`) — if the seed is missing the whole flow SHOULD fail loudly (fail-closed, matching project norm), not create a dangling subscription. Prisma throws `P2025` here; the existing route-level try/catch in the callers will surface it as a 500, which is correct (a missing seed is an operational error, not a user error).

Then add `robotId: robot.id` to the subscription create data (line 96-103):

```ts
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      robotId: robot.id,
      tier,
      expiresAt: expiresAt,
      status: "ACTIVE",
    },
  });
```

Also update the "existing active subscription of same tier" guard (currently line 77-83) to be robot-scoped — an active subscription is unique per (user, robot, tier), not just (user, tier). Add `robotId: robot.id` to that `findFirst` where clause so a future second robot with the same tier isn't wrongly treated as a duplicate:

```ts
  const existingSub = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      robotId: robot.id,
      tier,
      status: "ACTIVE",
    },
  });
```

Move the `robot` lookup ABOVE this `findFirst` so `robot.id` is in scope for both. Leave the rest of `provisionSubscription` (order creation, email, return shape) unchanged. Do NOT change the function signature — callers (`free-trial`, `paygate` webhook) stay as-is for single-robot Phase 3.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"
```
1. `grep -n "GOLDBOT_SLUG" src/lib/subscriptions.ts` — constant defined and used.
2. `grep -n "findUniqueOrThrow" src/lib/subscriptions.ts` — robot resolved fail-closed.
3. `grep -n "robotId: robot.id" src/lib/subscriptions.ts` — appears in subscription.create data AND in the findFirst where clause (2 occurrences).
4. `npx tsc --noEmit` — passes (proves the create call now satisfies the required robotId).
5. `npx eslint src/lib/subscriptions.ts` — clean.
  </verify>
  <done>
`provisionSubscription` resolves the `goldbot` Robot via `findUniqueOrThrow` and writes `robotId: robot.id` on every `Subscription` it creates; the duplicate-guard `findFirst` is robot-scoped. No subscription can be created without a robotId. `tsc` + eslint pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Set Compilation.robotId from subscription in update-mt5; reconcile compiler-filename slug</name>
  <files>src/app/api/licenses/update-mt5/route.ts, src/lib/compiler-filename.ts</files>
  <action>
**2a. `src/app/api/licenses/update-mt5/route.ts`** — the compilation create (line 47-52) now needs `robotId`. The route already loads the subscription via `findUnique` (line 31-34) with `include: { user: true }`. Add `robotId` to the select/return so it's available, then propagate it.

The `findUnique` currently uses `include: { user: true }` which returns all scalar fields (including the new `robotId`) plus the user relation — so `subscription.robotId` is already present on the returned object. Just use it in the compilation create (line 47-52):

```ts
    const job = await prisma.compilation.create({
      data: {
        subscriptionId: subscription.id,
        robotId: subscription.robotId,
        status: 'PENDING'
      }
    });
```

Denormalizing `robotId` onto the compilation (rather than joining through the subscription at read time) is intentional (research §robotId FK Threading): the compile worker's filename generation needs the slug directly, and a compilation's robot is immutable once the job is created even if the subscription is later re-pointed.

**2b. `src/lib/compiler-filename.ts`** — reconcile the slug casing drift (Pitfall 6). The current default is capital `"GoldBot"` (line 9) which disagrees with the DB slug `"goldbot"`. Change the default to lowercase `"goldbot"` so Blob source paths (`sources/goldbot/`) and compiled filenames stay consistent with the DB `Robot.slug`:

```ts
export function getCompiledFilename(jobId: string, opts?: { robotSlug?: string }): string {
  const slug = opts?.robotSlug ?? "goldbot";
  return `AL-ai-FX_${slug}_${jobId}.ex5`;
}
```

NOTE — this changes the produced filename from `AL-ai-FX_GoldBot_<jobId>.ex5` to `AL-ai-FX_goldbot_<jobId>.ex5`. That is acceptable and intended in Phase 3: the DB was wiped in 03-01 so there are NO existing compiled artifacts keyed on the old capitalized pathname to break. Both the write path (`/complete`) and read path (`/download`) use this single helper, so they stay in sync (per the 01-02 single-source-of-truth decision). Update the docstring comment (lines 1-7) to note the slug is now the canonical lowercase DB slug, and that Phase 4 will thread the real per-robot slug through `opts.robotSlug`.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"
```
1. `grep -n "robotId: subscription.robotId" src/app/api/licenses/update-mt5/route.ts` — compilation gets robotId from subscription.
2. `grep -n '?? "goldbot"' src/lib/compiler-filename.ts` — default slug is lowercase.
3. `grep -c "GoldBot" src/lib/compiler-filename.ts` — returns 0 (no capital-G default left; docstring mentions only lowercase or generic text).
4. `npx tsc --noEmit` — passes (compilation.create satisfies required robotId).
5. `npx eslint src/app/api/licenses/update-mt5/route.ts src/lib/compiler-filename.ts` — clean.
  </verify>
  <done>
`update-mt5` creates the `Compilation` with `robotId: subscription.robotId` (denormalized at creation). `compiler-filename.ts` default slug is canonical lowercase `goldbot`, reconciled with the DB `Robot.slug`; write and read paths share the one helper. `tsc` + eslint pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Additively expose robot slug in the poll response</name>
  <files>src/app/api/compiler/poll/route.ts</files>
  <action>
The poll route (src/app/api/compiler/poll/route.ts) returns a job object to the Windows daemon. The response contract is ADDITIVE-ONLY per the 01-03 decision — the daemon reads `job.id`, `job.mt5AccountNumber`, `job.expiresAt`, `job.attemptCount`; adding a field it ignores is safe. Expose the robot slug so Phase 4 can wire the worker's source-fetch + filename without another poll-shape change.

The claimed job now carries `robotId` (denormalized in Task 2). Include the robot slug by joining the robot relation in the `findUnique` inside the transaction (currently line 59-64):

```ts
      const job = await tx.compilation.findUnique({
        where: { id: jobId },
        include: {
          subscription: { select: { mt5AccountNumber: true, expiresAt: true } },
          robot: { select: { slug: true } },
        },
      });
```

Update the `ClaimedJob`/`claimed` type (line 32-36) so the returned shape includes the robot slug, e.g. add `robot: { slug: string }` to the intersection type, and include it in the object returned from the transaction (line 66-71):

```ts
      return {
        id: job.id,
        subscriptionId: job.subscriptionId,
        attemptCount: job.attemptCount,
        subscription: job.subscription,
        robot: job.robot,
      };
```

Then add `robotSlug` to the final JSON response (line 85-92) — additive, daemon-ignored until Phase 4:

```ts
  return NextResponse.json({
    job: {
      id: claimed.id,
      mt5AccountNumber: claimed.subscription.mt5AccountNumber,
      expiresAt: claimed.subscription.expiresAt,
      attemptCount: claimed.attemptCount,
      robotSlug: claimed.robot.slug,
    },
  });
```

Guard for the `!job.robot` case in the existing null-check (line 65: `if (!job || !job.subscription) return null;`) — extend it to `if (!job || !job.subscription || !job.robot) return null;` so a job missing its robot relation (should be impossible with NON-NULL FK, but defensive) is not claimed with a partial shape.

Do NOT remove or rename any existing response field — daemon compatibility is load-bearing.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"
```
1. `grep -n "robot: { select: { slug: true } }" src/app/api/compiler/poll/route.ts` — robot slug joined.
2. `grep -n "robotSlug: claimed.robot.slug" src/app/api/compiler/poll/route.ts` — additive field in response.
3. `grep -n "mt5AccountNumber: claimed.subscription.mt5AccountNumber" src/app/api/compiler/poll/route.ts` — existing fields still present (no removal).
4. `npx tsc --noEmit` — passes (claimed type includes robot).
5. `npx eslint src/app/api/compiler/poll/route.ts` — clean.
  </verify>
  <done>
The poll response additively includes `robotSlug` (from the joined Robot relation); all pre-existing fields (`id`, `mt5AccountNumber`, `expiresAt`, `attemptCount`) are unchanged. Null-check extended for the robot relation. `tsc` + eslint pass. Daemon contract preserved.
  </done>
</task>

</tasks>

<verification>
Overall Plan 03-02 verification (proves CTLG-04 code half / Criterion 2):

1. **Subscriptions scoped:** `grep -q "robotId: robot.id" src/lib/subscriptions.ts` — every subscription create writes robotId.
2. **Compilations scoped:** `grep -q "robotId: subscription.robotId" src/app/api/licenses/update-mt5/route.ts`.
3. **Slug reconciled:** `grep -c "GoldBot" src/lib/compiler-filename.ts` returns 0; default is `goldbot`.
4. **Poll additive:** poll response still returns id/mt5AccountNumber/expiresAt/attemptCount, plus new robotSlug.
5. **Type-safe end-to-end:** `npx tsc --noEmit` clean — no create call is missing the required robotId.
6. **Lint clean:** `npx eslint` on all six touched files passes.
</verification>

<success_criteria>
CTLG-04 closed (schema half from 03-01 + code half here); Success Criterion 2 satisfied:
- [x] Every new `Subscription` created by `provisionSubscription` carries a NON-NULL `robotId` (GoldBot).
- [x] Every new `Compilation` created by `update-mt5` carries a NON-NULL `robotId`, denormalized from its subscription.
- [x] Slug casing reconciled (`goldbot`) across DB, filename helper, and (future) Blob source path.
- [x] Poll response additively carries the robot slug for Phase 4, with zero daemon-breaking changes.
</success_criteria>

<output>
After completion, create `.planning/phases/03-multi-robot-schema-foundation/03-02-robotid-fk-wiring-SUMMARY.md` following `/Users/klev/.claude/get-shit-done/templates/summary.md`. Include in frontmatter:
- `requirements_closed: [CTLG-04]`
- `subsystem: multi-robot-schema`
- `key_files: [src/lib/subscriptions.ts, src/app/api/licenses/update-mt5/route.ts, src/app/api/compiler/poll/route.ts, src/lib/compiler-filename.ts]`
- `decisions:` bullet list capturing (a) single-robot GoldBot resolution via `findUniqueOrThrow` (fail-closed on missing seed), (b) `provisionSubscription` signature unchanged for Phase 3 (robot resolved internally), (c) duplicate-guard now robot-scoped (user+robot+tier), (d) Compilation.robotId denormalized from subscription at creation (immutable), (e) compiler-filename default reconciled to lowercase `goldbot` (filename now `AL-ai-FX_goldbot_<jobId>.ex5`; safe because DB wiped), (f) poll response additively carries `robotSlug` for Phase 4.
</output>
