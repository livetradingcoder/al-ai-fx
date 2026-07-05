---
phase: 04-robot-aware-compile-pipeline
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - prisma/migrations/20260705_add_source_version/migration.sql
  - src/lib/source-storage.ts
  - src/lib/compiler-source-token.ts
  - src/app/api/compiler/source/route.ts
  - src/app/api/licenses/update-mt5/route.ts
  - package.json
autonomous: true

must_haves:
  truths:
    - "Robot has a sourceVersion Int @default(1) column and Compilation has a sourceVersion Int @default(1) column, both live in remote Postgres via a checked-in incremental migration applied through the Vercel build-step channel (migrate deploy, NOT reset)"
    - "update-mt5 denormalizes robot.sourceVersion onto the new Compilation row at creation time, alongside the existing robotId denormalization"
    - "GET /api/compiler/source authenticates with Bearer COMPILER_SECRET, verifies a short-TTL HMAC token+exp, reads the PRIVATE source blob via get(pathname,{access:'private'}), decrypts server-side with decryptSource(), and streams plaintext .mq5 with Cache-Control: private, no-store"
    - "The SOURCE_ENCRYPTION_KEY never leaves the server — the /source endpoint returns DECRYPTED plaintext; the daemon never receives the key or ciphertext"
    - "compiler-source-token.ts signs/verifies {robotSlug, version, exp} with HMAC-SHA256 keyed by COMPILER_SECRET using timingSafeEqual, mirroring webhook-signature.ts"
    - "source-storage.ts exports fetchDecryptedSource(robotSlug, version) that get()s the private blob and returns decryptSource(ciphertext)"
    - "The /source endpoint never console.logs plaintext or ciphertext; decrypt failure logs only a generic '[source] decrypt failed' string"
    - "npx tsc --noEmit and npx eslint pass on all touched files"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "sourceVersion on Robot and Compilation"
      contains: "sourceVersion Int"
    - path: "prisma/migrations/20260705_add_source_version/migration.sql"
      provides: "Incremental migration adding both sourceVersion columns"
      contains: "ADD COLUMN"
      min_lines: 2
    - path: "src/lib/compiler-source-token.ts"
      provides: "HMAC sign/verify for short-TTL source URL"
      contains: "timingSafeEqual"
      min_lines: 15
    - path: "src/app/api/compiler/source/route.ts"
      provides: "Authenticated private-blob decrypt-and-stream proxy endpoint"
      contains: "decryptSource"
      min_lines: 30
    - path: "src/lib/source-storage.ts"
      provides: "fetchDecryptedSource private-blob read helper"
      contains: "fetchDecryptedSource"
  key_links:
    - from: "src/app/api/compiler/source/route.ts"
      to: "src/lib/source-storage.ts fetchDecryptedSource"
      via: "server-side read + decrypt"
      pattern: "fetchDecryptedSource"
    - from: "src/app/api/compiler/source/route.ts"
      to: "src/lib/compiler-source-token.ts verifySourceToken"
      via: "short-TTL token verification"
      pattern: "verifySourceToken"
    - from: "src/app/api/licenses/update-mt5/route.ts"
      to: "Compilation.sourceVersion"
      via: "denormalized from robot at job creation"
      pattern: "sourceVersion"
---

<objective>
Lay the robot-source foundation for Phase 4: a `sourceVersion` DB field (so a job knows WHICH `v<N>.mq5.enc` to fetch) and the authenticated proxy endpoint the Windows daemon will call to retrieve+decrypt that source at job time. This is the SRCE-02 core.

The key research finding: **private Vercel Blob stores have NO signed/expiring read URL** (`getDownloadUrl()` only appends `?download=1`). The "short-lived signed URL" in the roadmap is therefore reinterpreted as a Next.js proxy endpoint (`GET /api/compiler/source`) that authenticates the daemon (Bearer `COMPILER_SECRET` + app-level HMAC token with expiry), reads the private blob server-side via `get(pathname,{access:'private'})`, **decrypts server-side** (key never leaves Vercel), and streams the plaintext `.mq5` back.

Purpose: Satisfy SRCE-02 (daemon fetches source via short-lived authed URL, source not in poll payload) and half of SRCE-03 (server-side decrypt, no key on VM, no plaintext logging). Also lands the schema field Plan 04-02's poll extension depends on.

Output:
- `prisma/schema.prisma` — `Robot.sourceVersion Int @default(1)` + `Compilation.sourceVersion Int @default(1)`
- `prisma/migrations/20260705_add_source_version/migration.sql` — incremental migration (NOT a reset)
- `src/lib/compiler-source-token.ts` — HMAC sign/verify for the short-TTL source URL
- `src/lib/source-storage.ts` — `+ fetchDecryptedSource(robotSlug, version)`
- `src/app/api/compiler/source/route.ts` — the authed decrypt-and-stream proxy endpoint
- `src/app/api/licenses/update-mt5/route.ts` — denormalize `robot.sourceVersion` onto new `Compilation`
- Remote Postgres migrated via the Vercel build-step channel; build script reverted in a follow-up commit
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
@prisma/schema.prisma
@prisma/migrations/0_init/migration.sql
@src/lib/source-storage.ts
@src/lib/source-encryption.ts
@src/lib/webhook-signature.ts
@src/app/api/licenses/update-mt5/route.ts
@src/app/api/compiler/poll/route.ts
@package.json
@AGENTS.md
</context>

<critical_environment_notes>
- **Node:** default `node` on PATH is v11 (broken). Prepend the working bin to PATH for EVERY node/npx/prisma/tsc/eslint call:
  `export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"`
- **Next.js 16 is NOT the Next in training data** (per AGENTS.md). Streaming binary/text from a route handler is `new Response(body, { headers })` — confirmed valid. Do NOT use `pages/api`, `export const config`, or `res.setHeader`. If adding any route-segment config, read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/` first.
- **Remote DB:** `vercel env pull` cannot read `DATABASE_URL` (Vercel-Sensitive). Schema changes go through the proven **Vercel build-step channel**: temporarily set the `package.json` build script to run `prisma migrate deploy`, `vercel --prod --yes`, confirm in build log, then REVERT the build script in a follow-up commit. This is a NORMAL incremental `migrate deploy` this time (0_init already established history) — **NOT a reset**. Do not use `migrate reset` / `db push --force-reset`.
</critical_environment_notes>

<tasks>

<task type="auto">
  <name>Task 1: Add sourceVersion to schema, generate incremental migration offline, wire denormalization</name>
  <files>prisma/schema.prisma, prisma/migrations/20260705_add_source_version/migration.sql, prisma/migrations/migration_lock.toml, src/app/api/licenses/update-mt5/route.ts</files>
  <action>
**1a. Edit `prisma/schema.prisma`.** Add `sourceVersion` to `Robot` (after `sortOrder`, before `createdAt`):
```prisma
  sourceVersion    Int      @default(1)   // which sources/<slug>/v<N>.mq5.enc is current
```
Add `sourceVersion` to `Compilation` (after `robot` relation line, before `status`):
```prisma
  sourceVersion  Int           @default(1) // denormalized from robot at creation; immutable per job
```
`@default(1)` on both handles legacy rows (GoldBot's only source is v1 today).

**1b. Generate the incremental migration OFFLINE** (no DB connection needed — diffs the migrations dir as the "from" state):
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"
cd /Users/klev/Code/al-ai-fx
mkdir -p prisma/migrations/20260705_add_source_version
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260705_add_source_version/migration.sql
```
If `--from-migrations` is not a recognized flag on this Prisma version, run `npx prisma migrate diff --help` and use the correct offline "from applied migrations" flag (candidates: `--from-migrations`, or `--from-schema-datamodel` against a snapshot). The resulting `migration.sql` MUST contain exactly two `ALTER TABLE ... ADD COLUMN "sourceVersion" INTEGER NOT NULL DEFAULT 1;` statements (Robot + Compilation) and nothing else destructive. Inspect it (`cat`) and confirm before proceeding. `migration_lock.toml` already exists from 0_init — leave it.

**1c. Wire denormalization in `src/app/api/licenses/update-mt5/route.ts`.** The `prisma.compilation.create` currently sets `subscriptionId`, `robotId`, `status`. Add `sourceVersion` copied from the robot. The subscription include does not currently load the robot's sourceVersion, so fetch it. Change the subscription lookup include to also pull the robot's sourceVersion:
```ts
const subscription = await prisma.subscription.findUnique({
  where: { id: subscriptionId },
  include: { user: true, robot: { select: { sourceVersion: true } } }
});
```
Then in the `compilation.create` data block add:
```ts
        sourceVersion: subscription.robot.sourceVersion,
```
Keep everything else (validation, ownership check, response) unchanged.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
npx prisma validate
grep -c "sourceVersion Int" prisma/schema.prisma          # expect 2
grep -c "ADD COLUMN" prisma/migrations/20260705_add_source_version/migration.sql   # expect 2
grep "sourceVersion: subscription.robot.sourceVersion" src/app/api/licenses/update-mt5/route.ts
npx tsc --noEmit
```
  </verify>
  <done>`prisma validate` passes; schema has both sourceVersion columns; migration.sql has exactly the two ADD COLUMN statements; update-mt5 denormalizes sourceVersion; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 2: HMAC source token + fetchDecryptedSource helper + /api/compiler/source endpoint</name>
  <files>src/lib/compiler-source-token.ts, src/lib/source-storage.ts, src/app/api/compiler/source/route.ts</files>
  <action>
**2a. Create `src/lib/compiler-source-token.ts`** — mirror `webhook-signature.ts`'s HMAC + `timingSafeEqual` pattern. Reuse `COMPILER_SECRET` as the HMAC key (no new env var). Bind the token to `robotSlug`, `version`, and `exp`:
```ts
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 5 * 60_000; // 5 minutes

export function sourceTokenExpiry(): number {
  return Date.now() + TTL_MS;
}

function sign(robotSlug: string, version: number, exp: number): string {
  const secret = process.env.COMPILER_SECRET;
  if (!secret) throw new Error("COMPILER_SECRET missing"); // fail-closed
  return createHmac("sha256", secret)
    .update(`${robotSlug}.${version}.${exp}`)
    .digest("hex");
}

export function signSourceToken(robotSlug: string, version: number, exp: number): string {
  return sign(robotSlug, version, exp);
}

export function verifySourceToken(
  robotSlug: string,
  version: number,
  exp: number,
  token: string,
): boolean {
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  let expected: string;
  try {
    expected = sign(robotSlug, version, exp);
  } catch {
    return false; // missing secret => fail-closed
  }
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

**2b. Add `fetchDecryptedSource` to `src/lib/source-storage.ts`.** Import `get` from `@vercel/blob` and `decryptSource` from `./source-encryption`. `get()` returns a discriminated union on `statusCode` (`200` → `{ stream }`, `304` → `{ stream: null }`, or `null` if not found). Append:
```ts
import { get } from "@vercel/blob";
import { decryptSource } from "./source-encryption";

/**
 * Read a robot's PRIVATE encrypted source blob and return DECRYPTED plaintext.
 * Server-only: get() needs the store token and decryptSource() needs
 * SOURCE_ENCRYPTION_KEY — neither ever leaves the server. Sources are a few KB,
 * so buffering the whole stream is correct (GCM decrypt needs the full blob anyway).
 */
export async function fetchDecryptedSource(robotSlug: string, version: number): Promise<Buffer> {
  const result = await get(sourceBlobPathname(robotSlug, version), { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("source not found");
  }
  const ciphertext = Buffer.from(await new Response(result.stream).arrayBuffer());
  return decryptSource(ciphertext); // fail-closed: throws on tamper/wrong key
}
```
(Keep the existing `put` import — merge the `@vercel/blob` imports into one line: `import { put, get } from "@vercel/blob";`.)

**2c. Create `src/app/api/compiler/source/route.ts`** — the authed decrypt-and-stream proxy. Auth = Bearer COMPILER_SECRET (matching /poll, /complete) AND a valid non-expired HMAC token. Decrypt server-side, stream plaintext, never cache, never log secrets:
```ts
import { fetchDecryptedSource } from "@/lib/source-storage";
import { verifySourceToken } from "@/lib/compiler-source-token";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.COMPILER_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const robotSlug = searchParams.get("robotSlug");
  const version = Number(searchParams.get("version"));
  const exp = Number(searchParams.get("exp"));
  const token = searchParams.get("token");

  if (!robotSlug || !Number.isInteger(version) || !token || !Number.isFinite(exp)) {
    return new Response("Bad request", { status: 400 });
  }
  if (!verifySourceToken(robotSlug, version, exp, token)) {
    return new Response("Forbidden", { status: 403 });
  }

  let plaintext: Buffer;
  try {
    plaintext = await fetchDecryptedSource(robotSlug, version);
  } catch (err) {
    // NEVER log the ciphertext or plaintext — generic message only.
    console.error("[source] fetch/decrypt failed:", err instanceof Error ? err.message : "unknown");
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(plaintext), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store", // sensitive — never CDN/browser cache
    },
  });
}
```
Do NOT add `console.log` of the source anywhere. The catch logs only `err.message` (which for a decrypt failure is a crypto library string, never the buffer).
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q "timingSafeEqual" src/lib/compiler-source-token.ts && echo TOKEN_OK
grep -q "fetchDecryptedSource" src/lib/source-storage.ts && echo HELPER_OK
grep -q "verifySourceToken" src/app/api/compiler/source/route.ts && echo ROUTE_OK
grep -q "private, no-store" src/app/api/compiler/source/route.ts && echo NOCACHE_OK
# Assert no plaintext/ciphertext logging in the endpoint:
! grep -nE "console\.(log|error|warn)\((plaintext|ciphertext|mq5)" src/app/api/compiler/source/route.ts && echo NO_SECRET_LOG_OK
npx tsc --noEmit && npx eslint src/lib/compiler-source-token.ts src/lib/source-storage.ts src/app/api/compiler/source/route.ts
```
  </verify>
  <done>Token module, fetchDecryptedSource helper, and /source route all present with correct wiring; no secret logging; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 3: Apply the sourceVersion migration to remote Postgres via the Vercel build-step channel</name>
  <files>package.json</files>
  <action>
Apply the incremental migration to remote Postgres. This is a NORMAL `migrate deploy` (0_init is already applied and tracked in `_prisma_migrations`) — **NOT a reset**.

**3a.** Temporarily edit `package.json` build script from:
```json
"build": "prisma generate && next build",
```
to:
```json
"build": "prisma generate && prisma migrate deploy && next build",
```
Commit this (e.g. `chore(04): temporary migrate deploy in build step`).

**3b.** Deploy:
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
vercel --prod --yes
```
Watch the build log. Confirm it shows the new migration applied — e.g. `Applying migration 20260705_add_source_version` and `1 migration ... applied` (or "No pending migrations" only if a prior deploy already applied it). Confirm NO P3005 and NO reset. Confirm the deploy goes green.

**3c.** REVERT the build script back to `"prisma generate && next build"` in a SEPARATE follow-up commit (`chore(04): revert build step after migrate deploy`) and deploy once more (`vercel --prod --yes`) so production runs the normal build. The columns already exist server-side after 3b; this revert just removes the migrate step from future builds.
  </action>
  <verify>
- Build log from step 3b shows the migration applied against `db.prisma.io` (or equivalent) with no P3005 / no reset.
- `git log --oneline -3` shows the temporary-build commit AND the revert commit.
- `grep '"build"' package.json` shows `"prisma generate && next build"` (reverted).
- Final `vercel --prod --yes` deploy is green.
  </verify>
  <done>Both sourceVersion columns exist in remote Postgres via migrate deploy (no reset, no P3005); build script reverted to normal; production green.</done>
</task>

</tasks>

<verification>
- `npx prisma validate` passes; schema has `sourceVersion Int @default(1)` on both Robot and Compilation.
- The incremental migration is committed and was applied to remote Postgres via `migrate deploy` (not reset).
- `GET /api/compiler/source` requires Bearer COMPILER_SECRET + a valid non-expired HMAC token, decrypts server-side, and streams plaintext with `Cache-Control: private, no-store`.
- No plaintext/ciphertext is logged anywhere in the endpoint.
- update-mt5 denormalizes `robot.sourceVersion` onto new Compilation rows.
- `npx tsc --noEmit` and `npx eslint` clean on all touched files.
</verification>

<success_criteria>
- SRCE-02 (server side): a proxy endpoint exists that lets an authenticated daemon retrieve a robot's decrypted source at job time; the encryption key never leaves the server.
- SRCE-03 (partial): decrypt happens server-side, plaintext is never logged, no key on the VM.
- Schema foundation for the poll extension (Plan 04-02) is live: `sourceVersion` tracked per robot and denormalized per job.
</success_criteria>

<output>
After completion, create `.planning/phases/04-robot-aware-compile-pipeline/04-01-SUMMARY.md` with frontmatter fields: `phase`, `plan`, `status: complete`, `requirements: [SRCE-02, SRCE-03]`, `files_changed`, `commits`, `key_decisions` (e.g. token binds robotSlug+version+exp; 5-min TTL; server-side decrypt keeps key off VM; migration applied via build channel not reset), and `provides` (the `/api/compiler/source` endpoint contract + `signSourceToken`/`sourceTokenExpiry` exports that Plan 04-02's poll route consumes). Note the exact source URL query-param shape (`robotSlug`, `version`, `exp`, `token`) so Plan 04-02 and 04-03 build the URL identically.
</output>
