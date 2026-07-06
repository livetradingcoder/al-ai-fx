---
phase: 04-robot-aware-compile-pipeline
plan: 01
status: complete
requirements: [SRCE-02, SRCE-03]
subsystem: multi-robot-compile-pipeline
files_changed:
  - prisma/schema.prisma
  - prisma/migrations/20260705_add_source_version/migration.sql
  - src/lib/compiler-source-token.ts
  - src/lib/source-storage.ts
  - src/app/api/compiler/source/route.ts
  - src/app/api/licenses/update-mt5/route.ts
  - package.json
commits:
  - fb1dc32 feat(04-01): add sourceVersion to Robot + Compilation, denormalize on job creation
  - ae550e5 feat(04-01): add HMAC source token + fetchDecryptedSource + /api/compiler/source proxy
  - 18b715d chore(04-01): temporary migrate deploy in build step
  - 6cb3b8d chore(04-01): revert build step after migrate deploy
key_decisions:
  - "Private Vercel Blob stores have no signed/expiring read URL — the 'short-lived signed URL' is reinterpreted as a Next.js proxy endpoint (GET /api/compiler/source), not a Blob-issued link."
  - "compiler-source-token.ts binds an HMAC token to {robotSlug, version, exp} keyed by COMPILER_SECRET (no new env var), mirroring webhook-signature.ts's HMAC + timingSafeEqual pattern. 5-minute TTL."
  - "Decryption happens server-side inside /api/compiler/source — SOURCE_ENCRYPTION_KEY never leaves Vercel; the daemon receives plaintext .mq5 over TLS + Bearer + token auth, never the key or ciphertext."
  - "Robot.sourceVersion Int @default(1) + Compilation.sourceVersion Int @default(1) (denormalized at job creation, same pattern as robotId) — applied via a normal incremental `migrate deploy` (NOT a reset), since prisma/migrations/0_init already established history in Phase 3."
  - "Migration generated offline via `prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` — no DB connection needed to author it; applied via the proven temporary-build-script + vercel --prod --yes + revert channel."
provides:
  - "GET /api/compiler/source?robotSlug=<slug>&version=<N>&exp=<msEpoch>&token=<hmac> — Bearer COMPILER_SECRET + HMAC token required; returns decrypted plaintext .mq5, Cache-Control: private, no-store. Consumed by Plan 04-03's daemon rewrite."
  - "signSourceToken(robotSlug, version, exp) and sourceTokenExpiry() exported from src/lib/compiler-source-token.ts — Plan 04-02's poll route calls these to build the sourceUrl it hands to the daemon."
  - "fetchDecryptedSource(robotSlug, version) exported from src/lib/source-storage.ts — the server-side private-blob-read + decrypt helper the /source route uses."
  - "Compilation.sourceVersion now populated on every new job (update-mt5), ready for Plan 04-02's poll response to expose."
---

# Phase 4 Plan 01: Source-Version Schema + Source Proxy Endpoint Summary

**Added `sourceVersion` tracking (Robot + Compilation) via a normal incremental migration, and built the authenticated decrypt-and-stream proxy endpoint (`/api/compiler/source`) that lets the Windows daemon retrieve a robot's plaintext MQL5 source at job time — without ever exposing the encryption key or a Blob-issued URL, since private Vercel Blob stores have no signed-read capability.**

## Performance
- **Tasks:** 3 completed (spanned two sessions due to a session-limit interruption mid-Task-2; resumed cleanly from committed Task 1 state)
- **Files changed:** 7

## Accomplishments
- `Robot.sourceVersion` / `Compilation.sourceVersion` (`Int @default(1)`) added and denormalized at Compilation creation (`update-mt5/route.ts`), mirroring the existing `robotId` denormalization pattern.
- Incremental migration `20260705_add_source_version` generated offline (no DB connection) and applied to remote Postgres via `prisma migrate deploy` through the proven Vercel build-step channel — confirmed in build logs (`Applying migration 20260705_add_source_version` → `All migrations have been successfully applied`), no P3005, no reset.
- `src/lib/compiler-source-token.ts` — HMAC-SHA256 short-TTL (5 min) token binding `{robotSlug, version, exp}`, keyed by the existing `COMPILER_SECRET` (no new env var), constant-time verify via `timingSafeEqual`.
- `src/lib/source-storage.ts` gained `fetchDecryptedSource(robotSlug, version)` — reads the private Blob object via `get()`, decrypts server-side.
- `src/app/api/compiler/source/route.ts` — new authenticated proxy: Bearer `COMPILER_SECRET` + HMAC token required, streams decrypted plaintext with `Cache-Control: private, no-store`, never logs plaintext/ciphertext.

## Task Commits
1. **Task 1: sourceVersion schema + migration + denormalization** — `fb1dc32` (feat)
2. **Task 2: HMAC token + fetchDecryptedSource + /source endpoint** — `ae550e5` (feat)
3. **Task 3: apply migration via build channel + revert** — `18b715d` (chore, apply) + `6cb3b8d` (chore, revert)

## Files Created/Modified
- `prisma/schema.prisma` — `sourceVersion` on Robot + Compilation
- `prisma/migrations/20260705_add_source_version/migration.sql` — two `ADD COLUMN` statements
- `src/lib/compiler-source-token.ts` — new HMAC token module
- `src/lib/source-storage.ts` — `+ fetchDecryptedSource`
- `src/app/api/compiler/source/route.ts` — new proxy endpoint
- `src/app/api/licenses/update-mt5/route.ts` — denormalize `sourceVersion`
- `package.json` — build script temporarily carried `migrate deploy`, then reverted

## Decisions Made
See `key_decisions` in frontmatter.

## Deviations from Plan
None — plan executed exactly as written (across the session-limit interruption; resumed by verifying already-committed/uncommitted state matched the plan spec exactly before continuing).

## Issues Encountered
- The executor agent hit a session-length limit mid-Task-2 (files written, uncommitted). Resumed in a fresh context: verified the uncommitted `compiler-source-token.ts`/`source/route.ts`/`source-storage.ts` diff matched the plan's exact target shape, ran verification, committed, then completed Task 3. No rework needed.

## User Setup Required
None — no new external service configuration required (reuses existing `COMPILER_SECRET`).

## Next Phase Readiness
- Plan 04-02 (poll extension + filename consistency) can now consume `signSourceToken`/`sourceTokenExpiry` to build the `sourceUrl` in the poll response, and read `claimed.sourceVersion` (now populated on every Compilation).
- Plan 04-03 (VM daemon rewrite) will call `GET /api/compiler/source` with the exact query-param contract: `robotSlug`, `version`, `exp`, `token`.
- Remote Postgres now has `sourceVersion` on both `Robot` and `Compilation`; GoldBot's only version is `1` (matches its only uploaded source, `sources/goldbot/v1.mq5.enc`).

## Self-Check: PASSED
- Files verified present: `src/lib/compiler-source-token.ts`, `src/app/api/compiler/source/route.ts`, `prisma/migrations/20260705_add_source_version/migration.sql`.
- Commits verified: `fb1dc32`, `ae550e5`, `18b715d`, `6cb3b8d` all present in `git log`.
- Remote DB: migration confirmed applied via build log inspection (`vercel inspect ... --logs`); final deploy green with build script reverted.

---
*Phase: 04-robot-aware-compile-pipeline*
*Completed: 2026-07-06*
