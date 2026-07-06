---
phase: 04-robot-aware-compile-pipeline
plan: 02
status: complete
requirements: [CTLG-06, CTLG-07, CTLG-08, SRCE-02]
files_changed:
  - src/app/api/compiler/poll/route.ts
  - src/app/api/compiler/complete/route.ts
  - src/app/api/compiler/download/route.ts
commits:
  - 0e261d0 feat(04-02): additively return sourceVersion + signed sourceUrl in poll
  - f95e454 fix(04-02): robot-scoped filename consistency in complete + download
key_decisions:
  - "Base URL is derived per-request from `new URL(req.url).origin` — correct on prod and every preview deployment without a new env var."
  - "Poll fields are strictly ADDITIVE: `sourceVersion` + `sourceUrl` join the existing id/mt5AccountNumber/expiresAt/attemptCount/robotSlug. No field renamed or removed — the old daemon keeps working, the new daemon (04-03) reads the new fields."
  - "`/complete` SOFT-validates the reported blob pathname against `getCompiledBlobPathname(jobId, { robotSlug })` — logs a warning on mismatch, NEVER rejects. A good compile is never bricked over a naming nit."
  - "`/download` is now robot-scoped: names the Content-Disposition file via `getCompiledFilename(jobId, { robotSlug: job.robot.slug })` instead of the hardcoded-`goldbot` default. Write path (/complete) and read path (/download) now derive the filename from the SAME helper + the SAME slug."
  - "`sourceUrl` carries a URL reference only — source bytes are NEVER embedded in the poll body (SRCE-02). The `token` (HMAC) and full `sourceUrl` are never logged."
  - "`/download` continues streaming the compiled `.ex5` as `application/octet-stream`; it never serves `.mq5` source (SRCE-03 preserved)."
requirements_closed:
  - "CTLG-06: each poll now carries the job's `sourceVersion` + a ready-to-fetch `sourceUrl` so the daemon knows which source version to compile."
  - "CTLG-07: `/complete` is robot-aware and validates the reported pathname against the robot-scoped helper."
  - "CTLG-08: `/download` filename is consistent with the `/complete` write path — same helper, same slug, no goldbot lock-in."
  - "SRCE-02 (poll half): source delivered by short-TTL signed URL reference, never embedded in the poll response."
---

# Phase 4 Plan 02: Poll Extension & Filename Consistency Summary

Extended `GET /api/compiler/poll` to additively return each job's `sourceVersion` and a short-TTL signed `sourceUrl` (URL reference, never source bytes), and fixed the real filename mismatch so `/complete` (write) and `/download` (read) both derive the compiled filename from `getCompiledFilename`/`getCompiledBlobPathname` with the SAME `robotSlug` — ending the silent `goldbot`-lock-in in `/download`.

Pure code change — no schema/migration/deploy (04-01 already applied `sourceVersion` to remote Postgres and shipped `/api/compiler/source` + `compiler-source-token.ts`).

## What Changed

### `src/app/api/compiler/poll/route.ts`
- Imports `signSourceToken` + `sourceTokenExpiry` from `@/lib/compiler-source-token` (04-01).
- Carries `sourceVersion` through the atomic `FOR UPDATE SKIP LOCKED` dequeue transaction (`ClaimedJob` type + `claimed` inline type + returned object all extended).
- Builds a short-TTL signed `sourceUrl` from the request origin: `${origin}/api/compiler/source?robotSlug=<slug>&version=<n>&exp=<ms>&token=<hmac>`. `robotSlug` is `encodeURIComponent`-escaped.
- `token` / `sourceUrl` are never logged; no source bytes embedded.

### `src/app/api/compiler/complete/route.ts`
- Job lookup now `include: { robot: { select: { slug: true } } }`.
- On the COMPLETED path: soft consistency check — warns (never rejects) if the daemon-supplied `blobUrl` doesn't contain `getCompiledBlobPathname(jobId, { robotSlug: job.robot.slug })`. Still stores the daemon's `blobUrl` as `downloadUrl`.
- FAILED path (bounded retry via `attemptCount` vs `MAX_ATTEMPTS`) unchanged.

### `src/app/api/compiler/download/route.ts`
- Job lookup now `include: { subscription: true, robot: { select: { slug: true } } }`.
- Content-Disposition filename via `getCompiledFilename(jobId, { robotSlug: job.robot.slug })`.
- Still streams the `.ex5` as `application/octet-stream` (never `.mq5`).

## Provides — EXACT poll response shape for Plan 04-03 (VM daemon)

**CRITICAL for 04-03.** `GET /api/compiler/poll` requires `Authorization: Bearer COMPILER_SECRET`. On a claimed job it returns HTTP 200 with:

```json
{
  "job": {
    "id": "<compilation cuid>",
    "mt5AccountNumber": "12345678",
    "expiresAt": "2026-08-05T00:00:00.000Z",
    "attemptCount": 0,
    "robotSlug": "goldbot",
    "sourceVersion": 1,
    "sourceUrl": "https://<deployment-origin>/api/compiler/source?robotSlug=goldbot&version=1&exp=<ms-epoch>&token=<hex-hmac>"
  }
}
```

When the queue is empty it returns HTTP 200 `{ "job": null }`.

Field-by-field for the daemon parser:
- `job.id` — string (cuid). The jobId; used in the compiled filename and reported back to `/complete`.
- `job.mt5AccountNumber` — string | null. The account to license-lock the EA to.
- `job.expiresAt` — ISO-8601 string | null. License expiry.
- `job.attemptCount` — number. Read defensively as `job.attemptCount ?? 0` (bounded-retry counter; server owns requeue logic in `/complete`).
- `job.robotSlug` — string. The robot's canonical lowercase slug (e.g. `goldbot`). Used for the robot-scoped Blob upload pathname `compiled/AL-ai-FX_<slug>_<jobId>.ex5` (`getCompiledBlobPathname`) — the daemon MUST upload to exactly this pathname so `/download` names the file correctly.
- `job.sourceVersion` — number. The source version to compile.
- `job.sourceUrl` — string. **Ready-to-fetch URL** for the encrypted-then-decrypted `.mq5` source. The daemon fetches it with `Authorization: Bearer COMPILER_SECRET`; `/api/compiler/source` (04-01) verifies the Bearer secret AND the HMAC `token` (bound to `robotSlug`+`version`+`exp`, 5-minute TTL) then streams plaintext `.mq5`. **The token is short-TTL (5 min from mint) — the daemon must fetch promptly after polling; do not cache the URL across attempts.** Never log this URL/token.

Report back to `POST /api/compiler/complete` (Bearer COMPILER_SECRET) with `{ jobId, status: 'COMPLETED', blobUrl, sha256?, sizeBytes? }` where `blobUrl` is the uploaded object at the robot-scoped pathname above (or `{ jobId, status: 'FAILED', errorMessage? }`).

## Deviations from Plan

None — plan executed exactly as written. No architectural changes; no auth gates.

## Verification

- `npx tsc --noEmit` — clean across all three routes.
- `npx eslint` on `poll/route.ts`, `complete/route.ts`, `download/route.ts` — clean.
- All plan `<verify>` grep guards passed (SIGN_OK, URL_OK, VER_OK, ADDITIVE_OK, NO_LOG_OK, DL_INCLUDE_OK, DL_NAME_OK, CMP_PATH_OK, BINARY_OK, ESLINT_OK).

## Self-Check: PASSED

All three route files + SUMMARY.md exist on disk; both task commits (0e261d0, f95e454) present in git history.
</content>
</invoke>
