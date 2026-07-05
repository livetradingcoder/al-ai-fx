---
phase: 04-robot-aware-compile-pipeline
plan: 02
type: execute
wave: 2
depends_on: [04-01]
files_modified:
  - src/app/api/compiler/poll/route.ts
  - src/app/api/compiler/complete/route.ts
  - src/app/api/compiler/download/route.ts
autonomous: true

must_haves:
  truths:
    - "GET /api/compiler/poll additively returns sourceVersion and sourceUrl on each job, alongside the existing id, mt5AccountNumber, expiresAt, attemptCount, robotSlug"
    - "The poll sourceUrl points at THIS deployment's /api/compiler/source with query params robotSlug, version, exp, token — built with signSourceToken + sourceTokenExpiry from Plan 04-01, using the request origin as base"
    - "Source bytes are NEVER embedded in the poll response — only slug + version + a short-TTL URL"
    - "/api/compiler/complete looks up the job's robot.slug and stores the canonical downloadUrl; the stored value round-trips with what /download serves"
    - "/api/compiler/download includes robot: { select: { slug: true } } and calls getCompiledFilename(jobId, { robotSlug: job.robot.slug }) so the Content-Disposition filename is robot-scoped (no silent goldbot lock-in)"
    - "For any robot, the /complete write path and /download read path derive the filename from getCompiledFilename with the SAME robotSlug — no mismatch"
    - "npx tsc --noEmit and npx eslint pass on all three routes"
  artifacts:
    - path: "src/app/api/compiler/poll/route.ts"
      provides: "Additive sourceVersion + signed sourceUrl in poll response"
      contains: "sourceUrl"
    - path: "src/app/api/compiler/download/route.ts"
      provides: "Robot-scoped Content-Disposition filename"
      contains: "job.robot.slug"
    - path: "src/app/api/compiler/complete/route.ts"
      provides: "Robot-aware completion write path"
      contains: "robot"
  key_links:
    - from: "src/app/api/compiler/poll/route.ts"
      to: "src/lib/compiler-source-token.ts signSourceToken"
      via: "builds short-TTL source URL"
      pattern: "signSourceToken"
    - from: "src/app/api/compiler/download/route.ts"
      to: "src/lib/compiler-filename.ts getCompiledFilename"
      via: "passes robotSlug from job.robot.slug"
      pattern: "getCompiledFilename\\(jobId, \\{ robotSlug"
    - from: "src/app/api/compiler/poll/route.ts"
      to: "Compilation.sourceVersion"
      via: "reads denormalized version for the job"
      pattern: "sourceVersion"
---

<objective>
Complete the Next.js side of the robot-aware pipeline: (a) extend the poll response so the daemon learns each job's `sourceVersion` and a short-TTL `sourceUrl` to fetch (SRCE-02, CTLG-06), and (b) fix the real filename mismatch (CTLG-07/08) so `/complete` (write) and `/download` (read) derive the compiled filename from the SAME `getCompiledFilename(jobId, { robotSlug })` call with the same slug — instead of `/download` silently always naming files `AL-ai-FX_goldbot_...` regardless of robot.

Depends on Plan 04-01 for the `Compilation.sourceVersion` column, the `signSourceToken`/`sourceTokenExpiry` token module, and the `/api/compiler/source` endpoint the built URL points at.

Purpose: Satisfy CTLG-06 (poll returns slug + source-version), CTLG-07 (complete writes robot-scoped), CTLG-08 (download consistent with complete), and the poll half of SRCE-02 (URL not bytes).

Output:
- `src/app/api/compiler/poll/route.ts` — additive `sourceVersion` + signed `sourceUrl`
- `src/app/api/compiler/complete/route.ts` — robot-aware canonical write path
- `src/app/api/compiler/download/route.ts` — robot-scoped disposition filename
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-robot-aware-compile-pipeline/4-RESEARCH.md
@.planning/phases/04-robot-aware-compile-pipeline/04-01-SUMMARY.md
@src/app/api/compiler/poll/route.ts
@src/app/api/compiler/complete/route.ts
@src/app/api/compiler/download/route.ts
@src/lib/compiler-filename.ts
@src/lib/compiler-source-token.ts
@AGENTS.md
</context>

<critical_environment_notes>
- **Node:** prepend `export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"` for every node/npx/tsc/eslint call (default `node` is broken v11).
- **Additive-only poll contract** (locked in Phase 1/3): the existing daemon reads `job.id`, `job.mt5AccountNumber`, `job.expiresAt`, `job.attemptCount ?? 0`, and now `job.robotSlug`. New fields must be strictly additive — do NOT rename or remove any existing field. The new daemon (Plan 04-03) reads `sourceVersion` + `sourceUrl`; ship them additively.
- **Base URL:** derive the deployment origin from the incoming request — `new URL(req.url).origin` — so the URL is correct on prod and preview without a new env var.
- **Next.js 16** route handlers: no `pages/api`, no `export const config`, no `res.setHeader`.
</critical_environment_notes>

<tasks>

<task type="auto">
  <name>Task 1: Extend /api/compiler/poll with sourceVersion + short-TTL signed sourceUrl</name>
  <files>src/app/api/compiler/poll/route.ts</files>
  <action>
The poll route already atomically dequeues a job and includes `robot: { slug: true }`. Extend it additively.

**1a.** Import the token helpers at the top:
```ts
import { signSourceToken, sourceTokenExpiry } from '@/lib/compiler-source-token';
```

**1b.** Extend the `ClaimedJob` type and the transaction's `findUnique` + returned object to carry `sourceVersion`. In the `include`/select nothing changes for the relation, but the top-level `Compilation` now has `sourceVersion`. Add `sourceVersion: true`-equivalent by selecting it — the transaction currently does `tx.compilation.findUnique({ where, include: {...} })` which returns all scalar columns including the new `sourceVersion`, so just thread it into the returned shape:
  - Add `sourceVersion: number;` to the `ClaimedJob` type.
  - In the returned object inside the transaction, add `sourceVersion: job.sourceVersion,`.
  - Add `sourceVersion: number;` to the `claimed` local's inline type annotation.

**1c.** Build the response. Replace the final `return NextResponse.json({ job: {...} })` block with one that additively adds `sourceVersion` and a signed `sourceUrl`. Derive the origin from the request:
```ts
  const origin = new URL(req.url).origin;
  const exp = sourceTokenExpiry();
  const token = signSourceToken(claimed.robot.slug, claimed.sourceVersion, exp);
  const sourceUrl =
    `${origin}/api/compiler/source` +
    `?robotSlug=${encodeURIComponent(claimed.robot.slug)}` +
    `&version=${claimed.sourceVersion}` +
    `&exp=${exp}` +
    `&token=${token}`;

  return NextResponse.json({
    job: {
      id: claimed.id,
      mt5AccountNumber: claimed.subscription.mt5AccountNumber,
      expiresAt: claimed.subscription.expiresAt,
      attemptCount: claimed.attemptCount,
      robotSlug: claimed.robot.slug,   // additive (Phase 3)
      sourceVersion: claimed.sourceVersion, // additive (Phase 4)
      sourceUrl,                        // additive (Phase 4) — URL, never source bytes
    },
  });
```
Do NOT log `sourceUrl` or `token` (it embeds the HMAC). Do NOT embed source bytes.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q "signSourceToken" src/app/api/compiler/poll/route.ts && echo SIGN_OK
grep -q "sourceUrl" src/app/api/compiler/poll/route.ts && echo URL_OK
grep -q "sourceVersion: claimed.sourceVersion" src/app/api/compiler/poll/route.ts && echo VER_OK
# Ensure existing fields untouched (additive):
grep -q "mt5AccountNumber: claimed.subscription.mt5AccountNumber" src/app/api/compiler/poll/route.ts && echo ADDITIVE_OK
# No source bytes / no token logging:
! grep -nE "console\.[a-z]+\(.*(sourceUrl|token)" src/app/api/compiler/poll/route.ts && echo NO_LOG_OK
npx tsc --noEmit
```
  </verify>
  <done>Poll response additively carries sourceVersion + a signed short-TTL sourceUrl derived from request origin; existing fields unchanged; no bytes/token logged; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 2: Robot-scoped filename consistency in /complete and /download (CTLG-07/08)</name>
  <files>src/app/api/compiler/complete/route.ts, src/app/api/compiler/download/route.ts</files>
  <action>
Fix the mismatch: `/download` currently calls `getCompiledFilename(jobId)` with NO robotSlug (always yields `goldbot`), and `/complete` never touches the helper. Thread the job's `robot.slug` through both so the user-visible download name is robot-correct and consistent with the write path.

**2a. `src/app/api/compiler/download/route.ts`.**
  - Change the job lookup include from `{ subscription: true }` to `{ subscription: true, robot: { select: { slug: true } } }`.
  - Guard: after the existing `if (!job || job.subscription.userId !== session.user.id)` check, the `job.robot` relation is NON-NULL (schema FK), but keep TypeScript happy — it's included, so `job.robot.slug` is available.
  - Change `const fileName = getCompiledFilename(jobId);` to:
    ```ts
    const fileName = getCompiledFilename(jobId, { robotSlug: job.robot.slug });
    ```
Everything else (auth, blob fetch with BLOB_READ_WRITE_TOKEN, octet-stream streaming) stays. NOTE: `/download` MUST keep streaming the compiled `.ex5` binary as `application/octet-stream` — it must never serve `.mq5` source (SRCE-03).

**2b. `src/app/api/compiler/complete/route.ts`.**
  The daemon (Plan 04-03) will upload the `.ex5` to the robot-scoped Blob pathname `getCompiledBlobPathname(jobId, { robotSlug })` and report that `blobUrl`. `/complete` should stay robust (never brick a good compile over a naming nit) but become robot-aware:
  - Change the job lookup from `prisma.compilation.findUnique({ where: { id: jobId } })` to include the robot slug:
    ```ts
    const job = await prisma.compilation.findUnique({
      where: { id: jobId },
      include: { robot: { select: { slug: true } } },
    });
    ```
  - On the COMPLETED path, keep storing the daemon-supplied `blobUrl` as `downloadUrl` (it is the actual object). ADD a soft consistency check: if `blobUrl` does not contain the expected robot-scoped pathname, log a warning (do NOT reject):
    ```ts
    const expectedPath = getCompiledBlobPathname(jobId, { robotSlug: job.robot.slug });
    if (!blobUrl.includes(expectedPath)) {
      console.warn(`[complete] blobUrl pathname mismatch for job ${jobId}: expected .../${expectedPath}`);
    }
    ```
    Import `getCompiledBlobPathname` from `@/lib/compiler-filename`.
  - The FAILED path (bounded retry) is unchanged. `job.attemptCount` is still read the same way.
  This makes the write path (daemon → robot-scoped pathname, validated) and the read path (`/download` → same slug) both derive from `getCompiledFilename`/`getCompiledBlobPathname` with the SAME `robotSlug`.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q "robot: { select: { slug: true } }" src/app/api/compiler/download/route.ts && echo DL_INCLUDE_OK
grep -q "getCompiledFilename(jobId, { robotSlug: job.robot.slug })" src/app/api/compiler/download/route.ts && echo DL_NAME_OK
grep -q "getCompiledBlobPathname" src/app/api/compiler/complete/route.ts && echo CMP_PATH_OK
grep -q "application/octet-stream" src/app/api/compiler/download/route.ts && echo BINARY_OK
npx tsc --noEmit && npx eslint src/app/api/compiler/complete/route.ts src/app/api/compiler/download/route.ts
```
  </verify>
  <done>/download names files with the job's real robot slug; /complete is robot-aware and soft-validates the blob pathname against the same slug; /download still streams .ex5 octet-stream; tsc + eslint clean.</done>
</task>

</tasks>

<verification>
- `/api/compiler/poll` additively returns `sourceVersion` + a short-TTL `sourceUrl` (URL, not bytes); all existing fields unchanged.
- The `sourceUrl` is built from the request origin with the exact query shape (`robotSlug`, `version`, `exp`, `token`) that `/api/compiler/source` (Plan 04-01) verifies.
- `/download` derives the Content-Disposition filename from `getCompiledFilename(jobId, { robotSlug: job.robot.slug })`.
- `/complete` is robot-aware and soft-validates the reported blob pathname against `getCompiledBlobPathname(jobId, { robotSlug })`.
- `/download` still serves `application/octet-stream` (compiled `.ex5`), never `.mq5`.
- `npx tsc --noEmit` and `npx eslint` clean.
</verification>

<success_criteria>
- CTLG-06: the daemon can read the correct source version + a fetch URL from each poll.
- CTLG-07/08: write and read filename paths both derive from the same helper + slug — no `goldbot`-lock-in mismatch.
- SRCE-02 (poll half): source is delivered by URL reference, never embedded in the poll body.
</success_criteria>

<output>
After completion, create `.planning/phases/04-robot-aware-compile-pipeline/04-02-SUMMARY.md` with frontmatter fields: `phase`, `plan`, `status: complete`, `requirements: [CTLG-06, CTLG-07, CTLG-08, SRCE-02]`, `files_changed`, `commits`, `key_decisions` (origin-derived base URL; additive poll fields; complete soft-validates not rejects; download now robot-scoped), and `provides` — CRITICALLY document the EXACT poll response JSON shape the daemon must parse (`job.id`, `job.mt5AccountNumber`, `job.expiresAt`, `job.attemptCount`, `job.robotSlug`, `job.sourceVersion`, `job.sourceUrl`) and note that `sourceUrl` is ready-to-fetch with `Authorization: Bearer COMPILER_SECRET`. Plan 04-03 (daemon) depends on this documented shape.
</output>
