# Phase 4: Robot-Aware Compile Pipeline - Research

**Researched:** 2026-07-05
**Domain:** Vercel Blob private-store delivery, Next.js 16 route handlers (binary streaming), MQL5 compile-daemon integration, secret hygiene
**Confidence:** HIGH

> No CONTEXT.md exists for this phase (user said "don't ask, just implement"). Full Claude discretion on implementation choices. No `## User Constraints` section — nothing was locked.

## Summary

Phase 4 threads robot identity through the compile pipeline and hardens source secrecy. Most of the plumbing already exists from Phases 1/3: the poll route additively returns `robotSlug`, `compiler-filename.ts` is already the single source of truth for the write+read filename, encrypted sources live at `sources/<slug>/v<N>.mq5.enc` in a **private** Vercel Blob store, and the direct-to-Blob upload pattern for `.ex5` artifacts is established. The remaining work is (a) telling the daemon *which source version* to fetch, (b) giving the daemon an authenticated way to *retrieve and decrypt* that private source at job time, (c) fixing a real filename mismatch that still exists in `/download`, and (d) a source-secrecy audit.

**The single most important finding (SRCE-02):** There is **no signed/expiring public URL** for reading from a *private* Vercel Blob store. Verified against the official Vercel private-storage docs (last_updated 2026-05-19) and the installed `@vercel/blob@2.3.3` type defs. `getDownloadUrl()` only appends `?download=1` — it does **not** sign or add expiry. The `downloadUrl` field on a private blob still points at `*.private.blob.vercel-storage.com` and requires the `BLOB_READ_WRITE_TOKEN` (or OIDC token) in an `Authorization: Bearer` header. The blessed pattern, stated verbatim in Vercel's docs, is: *"To serve private blobs to your users, create a route that authenticates the request, fetches the blob using `get()`, and streams the response."* Therefore the "short-lived signed URL endpoint" in the roadmap must be **reinterpreted as a Next.js proxy endpoint** that authenticates the daemon (COMPILER_SECRET bearer, matching `/poll` and `/complete`), reads the private blob server-side via `get(pathname, {access:'private'})`, **decrypts it server-side**, and streams the plaintext `.mq5` back. Short-TTL "signing" is achieved with an app-level HMAC token embedded in the URL — not a Blob-platform feature.

**Primary recommendation:** Build `GET /api/compiler/source` (COMPILER_SECRET-authed, returns decrypted `.mq5` bytes via `get()` + `decryptSource()`); add a `sourceVersion` integer to the `Robot` model (default 1) and denormalize it onto `Compilation` at job creation; extend the poll response with `sourceVersion` (and either a ready-to-call source URL or just slug+version for the daemon to construct); fix `getCompiledFilename` to be called **with `robotSlug`** in both `/complete` (write) and `/download` (read); deploy updated `daemon.js` to the VM that fetches+decrypts+compiles from the endpoint instead of the local `base_ea_source.mq5`.

## Current State (verified this session by reading the actual files)

| Area | State | File |
|------|-------|------|
| Poll returns `robotSlug` | ✅ already additive | `src/app/api/compiler/poll/route.ts:95` |
| Poll returns `sourceVersion` | ❌ not yet | — |
| Poll issues source URL | ❌ not yet | — |
| Filename SSoT helper | ✅ exists, defaults to `"goldbot"` | `src/lib/compiler-filename.ts` |
| `/complete` write path filename | ⚠️ **does NOT call the helper at all** — stores whatever `blobUrl` the daemon sends verbatim in `downloadUrl` | `src/app/api/compiler/complete/route.ts:46-48` |
| `/download` read filename | ⚠️ calls `getCompiledFilename(jobId)` **without `robotSlug`** → always `goldbot` | `src/app/api/compiler/download/route.ts:48` |
| Encrypted source storage | ✅ AES-256-GCM, private Blob, `sources/<slug>/v<N>.mq5.enc` | `src/lib/source-storage.ts`, `src/lib/source-encryption.ts` |
| `sourceVersion` field anywhere | ❌ does not exist in schema or code | `prisma/schema.prisma` |
| Admin UI rendering source | ✅ none exists (no `src/app/dashboard/admin` source view) | — |
| Local daemon.js | ❌ not in repo (lives only on VM) | VM `C:\Users\Administrator\Documents\autocompiler-daemon\` |

### The real CTLG-07/08 mismatch (confirmed, NOT stale)

The roadmap's original problem statement (`AL-ai-FX_GoldBot_...` vs `GoldBot_v2.0_...`) is partly stale after Phase 1/3, but a **genuine mismatch still exists**:

- `/download` (`download/route.ts:48`) sets `Content-Disposition` filename via `getCompiledFilename(jobId)` — **no `robotSlug` passed**, so it ALWAYS yields `AL-ai-FX_goldbot_<jobId>.ex5` regardless of the actual robot.
- `/complete` (`complete/route.ts:42-48`) never calls the helper. It writes `downloadUrl: blobUrl` — the raw Blob URL the daemon uploaded to. The Blob *pathname* is whatever the daemon chose (Phase 1 daemon uses `getCompiledBlobPathname`-style naming, hardcoded to goldbot on the VM). So the stored object's pathname and the served `Content-Disposition` name are independently derived and only coincidentally agree for GoldBot.

**Fix:** Thread `robotSlug` into BOTH sides so they derive from the same helper call with the same input. `/complete` should look up the job's `robot.slug` and either (a) validate the daemon-supplied blob pathname matches `getCompiledBlobPathname(jobId, {robotSlug})`, or (b) store the canonical filename and have `/download` regenerate the disposition name with the same slug. Simplest: `/download` includes `robot: true` and calls `getCompiledFilename(jobId, {robotSlug: job.robot.slug})`. For multi-robot correctness the daemon must also write to the robot-scoped Blob pathname (it currently hardcodes goldbot).

## Standard Stack

### Core (already installed — no new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vercel/blob` | 2.3.3 (installed) | `get()` for private-blob read, `put()` for compiled upload | Only Vercel-native Blob SDK; `get()` is THE documented private-read path |
| `next` | 16.2.3 (installed) | Route handlers returning `new Response(stream, …)` | Project framework |
| `crypto` (Node builtin) | — | HMAC token for short-TTL URL signing; `decryptSource` already uses it | No dep; already used in `source-encryption.ts` |
| `@prisma/client` | installed | `sourceVersion` field, `robot.slug` includes | Project ORM |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node `stream` / Web streams | builtin | Stream `get()` result to Response | If avoiding full buffering of source (sources are tiny — buffering is fine) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Proxy endpoint that decrypts + streams | Blob signed URL | **Not possible** — private stores have no signed-read URL (verified). Rejected. |
| Proxy returns *decrypted* plaintext | Proxy returns *ciphertext*, daemon decrypts | Would require shipping `SOURCE_ENCRYPTION_KEY` to the VM daemon. **Avoid** — keep the key server-only. Decrypt in the endpoint. |
| App-level HMAC short-TTL token in URL | Plain COMPILER_SECRET bearer only | Bearer alone is fine for SRCE-02 (daemon is a trusted server). HMAC-with-expiry token adds "short-lived signed URL" semantics if the URL is embedded in the poll response and might be logged. Recommended: embed a signed, expiring token in the poll-response source URL. |

**Installation:** none — all dependencies present.

## Architecture Patterns

### Recommended change set

```
prisma/schema.prisma
  Robot.sourceVersion Int @default(1)          # which v<N>.mq5.enc is current
  Compilation.sourceVersion Int                # denormalized at job creation (immutable per job)

src/lib/compiler-filename.ts                    # (unchanged API) — just CALL it correctly everywhere
src/lib/source-storage.ts
  + getEncryptedSource(robotSlug, version)      # get() private blob → Buffer (ciphertext)
  + fetchDecryptedSource(robotSlug, version)    # get() + decryptSource() → plaintext Buffer

src/lib/compiler-source-token.ts   (NEW)        # HMAC sign/verify {jobId, exp} for short-TTL URL

src/app/api/compiler/source/route.ts   (NEW)    # GET: authed → decrypt → stream .mq5 to daemon
src/app/api/compiler/poll/route.ts              # + sourceVersion, + sourceUrl (signed, short TTL)
src/app/api/compiler/complete/route.ts          # robot-scoped write validation / canonical name
src/app/api/compiler/download/route.ts          # pass robotSlug into getCompiledFilename
src/app/api/licenses/update-mt5/route.ts        # copy robot.sourceVersion onto new Compilation

# On the VM (real code change, deployed separately):
daemon.js                                        # fetch source from endpoint, decrypt server-side
                                                 #   (endpoint returns plaintext), compile, upload
```

### Pattern 1: Private-blob proxy endpoint (the SRCE-02 core)
**What:** A route that authenticates the caller, reads the private blob with the store token, decrypts, and streams plaintext.
**When to use:** Any read of a private Vercel Blob object by a non-Vercel client.
**Example (verbatim shape from Vercel docs, adapted):**
```typescript
// Source: https://vercel.com/docs/vercel-blob/private-storage  ("Delivering private blobs")
// src/app/api/compiler/source/route.ts
import { get } from '@vercel/blob';
import { decryptSource } from '@/lib/source-encryption';
import { sourceBlobPathname } from '@/lib/source-storage';

export async function GET(req: Request) {
  // 1. Auth — bearer COMPILER_SECRET (same pattern as /poll, /complete)
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.COMPILER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // (optional) verify short-TTL HMAC token from query if URL was handed out via /poll

  const { searchParams } = new URL(req.url);
  const robotSlug = searchParams.get('robotSlug');
  const version = Number(searchParams.get('version'));
  if (!robotSlug || !Number.isInteger(version)) {
    return new Response('Bad request', { status: 400 });
  }

  // 2. Read the PRIVATE blob (get() needs the store token / OIDC — server-only)
  const result = await get(sourceBlobPathname(robotSlug, version), { access: 'private' });
  if (!result || result.statusCode !== 200) {
    return new Response('Not found', { status: 404 });
  }

  // 3. Decrypt SERVER-SIDE (key never leaves the server), stream plaintext
  const ciphertext = Buffer.from(await new Response(result.stream).arrayBuffer());
  const plaintext = decryptSource(ciphertext);   // throws on tamper (fail-closed)

  return new Response(plaintext, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',   // sensitive — never cache
    },
  });
}
```
> NOTE: `get()` returns `{ stream, blob, statusCode }` per `@vercel/blob@2.3.3` type defs. Sources are tiny (a few KB) so buffering the whole stream to decrypt is correct and simplest — GCM decrypt needs the full ciphertext + tag anyway.

### Pattern 2: Short-TTL signed URL via app-level HMAC (optional hardening for SRCE-02)
**What:** Since Blob can't sign, sign it yourself. `/poll` embeds `?token=<hmac>&exp=<ts>` in the source URL; `/source` verifies HMAC + `exp > now`.
**When to use:** If the source URL is placed in the poll-response body (which may be logged) and you want the "short-lived" guarantee beyond the static COMPILER_SECRET.
```typescript
// src/lib/compiler-source-token.ts
import { createHmac, timingSafeEqual } from 'crypto';
const TTL_MS = 5 * 60_000; // 5 min
export function signSourceToken(jobId: string, exp: number): string {
  return createHmac('sha256', process.env.COMPILER_SECRET!).update(`${jobId}.${exp}`).digest('hex');
}
export function verifySourceToken(jobId: string, exp: number, token: string): boolean {
  if (Date.now() > exp) return false;
  const expected = signSourceToken(jobId, exp);
  const a = Buffer.from(expected), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
```
> Reuses `COMPILER_SECRET` as the HMAC key — no new env var. `webhook-signature.ts` already establishes this HMAC-with-timing-safe-compare pattern in the codebase; mirror it.

### Pattern 3: Robot-scoped filename consistency (CTLG-07/08)
**What:** Both `/complete` (write) and `/download` (read) must derive the filename from `getCompiledFilename(jobId, {robotSlug})` with the SAME slug (the job's `robot.slug`).
```typescript
// /download: include robot, pass slug
const job = await prisma.compilation.findUnique({
  where: { id: jobId },
  include: { subscription: true, robot: { select: { slug: true } } },
});
const fileName = getCompiledFilename(jobId, { robotSlug: job.robot.slug });
```
For the write path, the **daemon** must upload to the robot-scoped Blob pathname (`getCompiledBlobPathname(jobId, {robotSlug})`); `/complete` can validate the reported `blobUrl` ends with that pathname, or ignore the daemon's URL and reconstruct it. Simplest robust approach: `/complete` stores the daemon's `blobUrl` (it's the actual object), and `/download` regenerates only the *disposition* filename from the slug — the object pathname and the disposition name are then independently correct as long as both use `robotSlug`.

### Anti-Patterns to Avoid
- **Shipping `SOURCE_ENCRYPTION_KEY` to the VM.** Decrypt on the server in the `/source` endpoint; hand the daemon plaintext over an authed channel. Keeps the key in exactly one place (Vercel env).
- **Embedding source bytes in the poll response.** SRCE-02 explicitly forbids this. Poll returns slug + version + (optional signed) URL only.
- **Logging the source URL query token or the plaintext.** See source-secrecy audit below.
- **Assuming `getDownloadUrl()` produces an authenticated/expiring link.** It only appends `?download=1`. Verified.
- **Caching the `/source` response** (CDN or browser). Use `Cache-Control: private, no-store`. Vercel docs explicitly warn against CDN-caching private blobs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Private-blob read | Custom S3-style signed URL | `get(pathname, {access:'private'})` | Vercel private stores have no signed URL; `get()` is the only documented path |
| Source decryption | New crypto | `decryptSource()` in `source-encryption.ts` | Already AES-256-GCM, fail-closed, tested |
| Source blob path | New path convention | `sourceBlobPathname(slug, version)` | Already the SSoT; GoldBot v1 lives at that path |
| Compiled filename | Inline string building | `getCompiledFilename` / `getCompiledBlobPathname` | Already SSoT; just call it with `robotSlug` |
| HMAC token | New signing scheme | Mirror `src/lib/webhook-signature.ts` (HMAC-SHA256 + `timingSafeEqual`) | Established, tested pattern in this repo |

**Key insight:** Almost every primitive this phase needs already exists. Phase 4 is mostly *wiring correctly-existing pieces together with the right arguments* plus one new proxy endpoint and one new schema field — not building new subsystems.

## Common Pitfalls

### Pitfall 1: Expecting a Blob signed URL (the roadmap's literal wording)
**What goes wrong:** Planning a "signed source URL" endpoint that returns a Blob-issued expiring link. No such API exists for private stores.
**Why it happens:** Public Blob stores return world-readable URLs; the roadmap was written before Phase 3 discovered the store is private.
**How to avoid:** The "signed URL" is your OWN proxy endpoint URL, optionally with an app-level HMAC token. The daemon calls your Next.js API, not `*.blob.vercel-storage.com`.
**Warning signs:** Any plan task that calls `getDownloadUrl()` on a source blob or returns a `*.private.blob.vercel-storage.com` URL to the daemon.

### Pitfall 2: `sourceVersion` doesn't exist yet — schema migration required
**What goes wrong:** Poll/daemon reference a version that isn't tracked, so the daemon can't know which `v<N>.mq5.enc` to fetch. Right now only `v1` exists and it's implicit.
**Why it happens:** Phase 3 stored `sources/<slug>/v<N>` but never added a DB field pointing at the *current* N.
**How to avoid:** Add `Robot.sourceVersion Int @default(1)` and denormalize `Compilation.sourceVersion` at creation (like `robotId` is denormalized in `update-mt5/route.ts`). This is a schema change → requires the **remote-DB migration channel** (temporary build-script edit + `vercel --prod` + revert, or a checked-in migration + `migrate deploy` via the build step) used successfully in Phases 2/3. Mirror `0_init` migration approach from 03-01.
**Warning signs:** A plan that reads `sourceVersion` without a migration task.

### Pitfall 3: `/download` currently ignores the robot (silent goldbot lock-in)
**What goes wrong:** Every robot's download is named `AL-ai-FX_goldbot_...`. For a second robot this is wrong AND may 404 if the object was written under a different pathname.
**Why it happens:** `getCompiledFilename(jobId)` called without opts; `/download` doesn't `include: { robot }`.
**How to avoid:** Add `robot: { select: { slug: true } }` to the include and pass `{ robotSlug: job.robot.slug }`. See Pattern 3.
**Warning signs:** Download route with no `robot` include.

### Pitfall 4: Next.js 16 is NOT the Next.js in training data (per AGENTS.md)
**What goes wrong:** Using stale route-handler config (`export const config`, old `runtime` syntax) or wrong streaming Response shapes.
**Why it happens:** `AGENTS.md` warns this Next version has breaking changes; read `node_modules/next/dist/docs/` before writing.
**How to avoid:** Streaming binary is `new Response(webStream, { headers })` — confirmed valid in Next 16 route-handler docs. Route-segment config (`maxDuration`, `runtime`) lives in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/`. Read before adding any segment config.
**Warning signs:** Any `pages/api` pattern, `export const config`, or `res.setHeader` in an app-router route.

### Pitfall 5: Daemon code change is unavoidable and separate from Next deploy
**What goes wrong:** Assuming "additive poll" means no daemon change. The daemon MUST switch from reading local `base_ea_source.mq5` to fetching + compiling the returned source. That's a real `daemon.js` edit deployed to the VM (SSH `alfx` / `65.21.66.43`).
**Why it happens:** "Additive" applies to the Next.js response contract, not the daemon.
**How to avoid:** Plan a distinct task for the VM daemon: (1) add `sourceVersion`/`sourceUrl` parsing from poll, (2) `fetch(sourceUrl, {headers:{Authorization: Bearer COMPILER_SECRET}})` → write to a temp `.mq5`, (3) compile that temp file, (4) upload `.ex5` to robot-scoped pathname, (5) never log source contents. Deploy over SSH.
**Warning signs:** A plan with zero VM/daemon tasks.

### Pitfall 6: Source secrecy leaks (SRCE-03)
**What goes wrong:** Plaintext source ends up in `console.log`, an error message, an admin page, or the `/download` route.
**Why it happens:** Debug logging during development; generic error passthrough.
**How to avoid (audit checklist):**
- `/source` endpoint: never `console.log` the plaintext or the ciphertext; on decrypt failure log only `'[source] decrypt failed'`, not the buffer.
- No admin UI renders source today (verified none exists) — assert this stays true; if Phase 5 admin upload is prototyped early, ensure it write-only.
- `/download` streams `.ex5` (compiled binary), never `.mq5` — already true, keep a negative test.
- Daemon: write source to a temp file, compile, delete; do not echo to daemon logs.
- Add a negative test: `GET /api/compiler/download` for a valid job returns `application/octet-stream` and the body is NOT MQL5 text (no `#property`, `OnTick`, etc.).

## Code Examples

### Read a private blob → Buffer (helper for source-storage.ts)
```typescript
// Source: https://vercel.com/docs/vercel-blob/private-storage + @vercel/blob@2.3.3 get() typedef
import { get } from '@vercel/blob';
import { decryptSource } from './source-encryption';
export async function fetchDecryptedSource(robotSlug: string, version: number): Promise<Buffer> {
  const result = await get(sourceBlobPathname(robotSlug, version), { access: 'private' });
  if (!result || result.statusCode !== 200) throw new Error('source not found');
  const ciphertext = Buffer.from(await new Response(result.stream).arrayBuffer());
  return decryptSource(ciphertext); // fail-closed: throws on tamper/wrong key
}
```

### Poll response extension (additive)
```typescript
// poll/route.ts — build on existing robotSlug, add sourceVersion + signed source URL
const exp = Date.now() + 5 * 60_000;
const token = signSourceToken(claimed.id, exp);
return NextResponse.json({
  job: {
    id: claimed.id,
    mt5AccountNumber: claimed.subscription.mt5AccountNumber,
    expiresAt: claimed.subscription.expiresAt,
    attemptCount: claimed.attemptCount,
    robotSlug: claimed.robot.slug,          // already present
    sourceVersion: claimed.sourceVersion,   // NEW (denormalized on Compilation)
    sourceUrl: `${base}/api/compiler/source?robotSlug=${claimed.robot.slug}`
             + `&version=${claimed.sourceVersion}&exp=${exp}&token=${token}`, // NEW
  },
});
```
> `base` = deployment origin. The daemon still sends `Authorization: Bearer COMPILER_SECRET` on the fetch; the token+exp add short-TTL semantics on top.

### Daemon fetch step (VM daemon.js — Node)
```javascript
// pseudo — replaces reading local base_ea_source.mq5
const res = await fetch(job.sourceUrl, {
  headers: { Authorization: `Bearer ${COMPILER_SECRET}` },
});
if (!res.ok) throw new Error(`source fetch ${res.status}`);
const mq5 = Buffer.from(await res.arrayBuffer());
fs.writeFileSync(tmpSourcePath, mq5);   // compile this; delete after; never log contents
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Daemon reads local `base_ea_source.mq5` | Daemon fetches per-job source from authed endpoint | This phase | Multi-robot; source not on VM disk permanently |
| "GoldBot by convention" | `robotSlug` + `sourceVersion` on each job | Phase 3 (slug) + Phase 4 (version) | Correct robot selection |
| Public Blob assumption | Private store, server-proxied reads | Phase 3 discovery | No signed URLs; proxy required |
| `getCompiledFilename(jobId)` (implicit goldbot) | `getCompiledFilename(jobId, {robotSlug})` everywhere | This phase | Filename matches robot |

**Deprecated/outdated:**
- Roadmap's "signed source URL from Blob": **not achievable** — reinterpret as app proxy endpoint. (This is the biggest correction to the rough plan sketch.)
- `getDownloadUrl()`: does not sign — do not use for the source URL.

## Open Questions

1. **Return decrypted plaintext vs. ciphertext from `/source`?**
   - What we know: Decrypting server-side keeps `SOURCE_ENCRYPTION_KEY` off the VM. Sources are tiny; TLS protects transit.
   - What's unclear: Whether the team prefers defense-in-depth (ship ciphertext + key to VM) over key centralization.
   - Recommendation: **Return decrypted plaintext.** Key stays server-only; the channel is TLS + COMPILER_SECRET + short-TTL token. This is the simpler, more secure key-management choice.

2. **Where does `Compilation.sourceVersion` get set, and is it nullable during migration?**
   - What we know: `update-mt5/route.ts` already denormalizes `robotId` from the subscription at job creation — copy `robot.sourceVersion` the same way.
   - What's unclear: Existing in-flight rows have no `sourceVersion`. 
   - Recommendation: Add `Robot.sourceVersion Int @default(1)`; add `Compilation.sourceVersion Int @default(1)` (default handles legacy rows), backfill implicitly. GoldBot's only source is v1, so default 1 is correct today.

3. **Does the poll response need versioning (strict daemon parser)?**
   - What we know: 01-03 decision = additive-only; daemon reads unknown fields tolerantly (`job.attemptCount ?? 0`). But this phase deploys new daemon code anyway.
   - Recommendation: Keep additive (no `/v2` route). The new daemon reads the new fields; ship both together. No endpoint versioning needed.

4. **`/complete` write-path canonicalization — validate or reconstruct?**
   - What we know: `/complete` currently stores the daemon's `blobUrl` verbatim; daemon controls the pathname.
   - Recommendation: Have the daemon upload to `getCompiledBlobPathname(jobId, {robotSlug})` and have `/complete` optionally assert the reported URL ends with that pathname (log a warning, don't hard-fail, to avoid bricking a compile over a naming nit). `/download` regenerates the disposition name from `robot.slug`. Low risk either way since `/download` controls the user-visible name.

## Sources

### Primary (HIGH confidence)
- https://vercel.com/docs/vercel-blob/private-storage (last_updated 2026-05-19) — "Delivering private blobs" section: proxy-through-function pattern, `get(pathname,{access:'private'})`, no signed URL, `Cache-Control: private, no-store`, CDN-cache warning.
- https://vercel.com/docs/vercel-blob/using-blob-sdk (last_updated 2026-05-19) — `get()` semantics ("For private blobs, this is how you deliver files through your functions"), private URL domain `*.private.blob.vercel-storage.com`, `downloadUrl` = url + `?download=1`.
- `node_modules/@vercel/blob@2.3.3` type defs — `get()` signature/return `{stream, blob, statusCode}`; `getDownloadUrl(blobUrl)` impl (`chunk-WLMB4XQD.js`) confirmed to only set `download=1`; no signed/expiring read primitive in exports.
- `node_modules/next/dist/docs/01-app/...` — route-handler streaming (`new Response(stream, …)`) + route-segment-config location (per AGENTS.md "read before writing").
- Repo files read this session: `poll/route.ts`, `complete/route.ts`, `download/route.ts`, `compiler-filename.ts`, `source-storage.ts`, `source-encryption.ts`, `compiler-config.ts`, `update-mt5/route.ts`, `prisma/schema.prisma` (Robot + Compilation models).

### Secondary (MEDIUM confidence)
- `src/lib/webhook-signature.ts` (existing) — HMAC-SHA256 + timing-safe compare pattern to mirror for the source token (not re-read in full this session; referenced by convention).

### Tertiary (LOW confidence)
- VM daemon internals (`daemon.js`) — not in repo; behavior described from phase context, not directly read this session. Daemon task specifics should be confirmed by reading the file on the VM during planning/execution.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps installed; private-blob read path verified against official docs + installed type defs.
- Architecture (proxy endpoint, no signed URL): HIGH — explicitly stated in Vercel docs, cross-verified in SDK source.
- Filename mismatch diagnosis: HIGH — read the actual route files.
- Schema `sourceVersion` gap: HIGH — grepped, confirmed absent.
- Daemon specifics: LOW-MEDIUM — file not in repo; read on VM during execution.

**Research date:** 2026-07-05
**Valid until:** 2026-08-04 (Vercel Blob is fast-moving; re-verify `get()`/private-read if `@vercel/blob` majors bump. Repo findings valid until the files change.)
