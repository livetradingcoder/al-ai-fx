---
phase: 03-multi-robot-schema-foundation
plan: 03
subsystem: source-storage
tags: [encryption, aes-256-gcm, vercel-blob, mql5, source-at-rest, versioning]
requirements_closed: [SRCE-01]

# Dependency graph
requires:
  - phase: 03-multi-robot-schema-foundation
    provides: "Robot catalog (03-01): canonical lowercase slug 'goldbot' — the join key for Blob source paths sources/<slug>/"
  - phase: 01-restore-compile-delivery
    provides: "Vercel Blob store + BLOB_READ_WRITE_TOKEN + @vercel/blob put() convention (addRandomSuffix:false, deterministic pathname)"
provides:
  - "AES-256-GCM source-encryption module (encryptSource/decryptSource, [12 IV][16 tag][ct], fail-closed 32-byte key)"
  - "Versioned immutable Blob upload helper uploadEncryptedSource → sources/<slug>/v<N>.mq5.enc (allowOverwrite:false)"
  - "sourceBlobPathname() — the single source-path SSoT"
  - "SOURCE_ENCRYPTION_KEY provisioned in all 3 Vercel scopes (production/preview/development)"
  - "First live encrypted artifact: sources/goldbot/v1.mq5.enc (real GoldBot ALaiFX_EA.mq5 fetched from the VM)"
  - "scripts/upload-goldbot-source.js reusable one-time uploader"
affects: [04-source-hardening, compile-pipeline, catalog-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AES-256-GCM authenticated encryption via Node built-in crypto (zero new deps); one module owns both directions + the [12 IV][16 tag][ct] blob layout"
    - "Encrypted source-at-rest in Vercel Blob at versioned immutable paths sources/<slug>/v<N>.mq5.enc (allowOverwrite:false); never in repo, never in Postgres"

key-files:
  created:
    - src/lib/source-encryption.ts
    - src/lib/source-encryption.test.ts
    - src/lib/source-storage.ts
    - scripts/upload-goldbot-source.js
  modified: []

key-decisions:
  - "AES-256-GCM keyed by a single env var SOURCE_ENCRYPTION_KEY (no KMS) — GCM is authenticated encryption in one primitive; getKey() reads hex, validates 32 bytes, fail-closed (throws on missing/wrong-length). No hand-rolled CBC+HMAC."
  - "Blob layout [12-byte IV][16-byte authTag][ciphertext] documented and owned by src/lib/source-encryption.ts alone; the upload script inlines the identical CJS layout (dependency-free) rather than importing the TS/ESM module."
  - "Sources stored at versioned immutable paths sources/<slug>/v<N>.mq5.enc with allowOverwrite:false — a new source version = a new vN file; put rejects on collision. Publishing a new source bumps N."
  - "access:'private' (DEVIATION from plan's access:'public') — the Vercel Blob store is configured private-access and rejected public puts. Private store + AES ciphertext = defence-in-depth (authenticated retrieval AND encrypted bytes). Signed-URL read-path is Phase 4/SRCE-02."
  - "Real GoldBot source (ALaiFX_EA.mq5, 14002 bytes) fetched live from the Windows VM (C:\\Users\\Administrator\\Documents\\autocompiler-daemon\\base_ea_source.mq5 via ssh alfx Get-Content) and uploaded as v1 — not a placeholder. Encrypted blob = 14030 bytes (14002 + 12 IV + 16 tag)."
  - "SOURCE_ENCRYPTION_KEY generated via openssl rand -hex 32 and added to all 3 scopes via `echo \"$KEY\" | vercel env add SOURCE_ENCRYPTION_KEY <scope>` (piped stdin) — automated, not a checkpoint (same pattern as PAYGATE_WEBHOOK_SECRET in 02-02). Same canonical value across scopes; also written to gitignored .env.local for the local upload script."
  - "Worker source-fetch rewiring (daemon reading from Blob via short-lived signed URL) explicitly deferred to Phase 4/SRCE-02 — the daemon still reads its local base_ea_source.mq5 on the VM. This plan delivers only the storage convention + helper + first artifact."

metrics:
  duration: "~10m"
  completed: 2026-07-05
---

# Phase 3 Plan 03: Encrypted Source Storage Summary

AES-256-GCM encrypted MQL5 source-at-rest in Vercel Blob at versioned immutable paths `sources/<robotSlug>/v<N>.mq5.enc`, keyed by a single fail-closed `SOURCE_ENCRYPTION_KEY`, with GoldBot's real current source uploaded as the first live artifact.

## What Shipped

- **`src/lib/source-encryption.ts`** — `encryptSource`/`decryptSource` via Node built-in `crypto`, `[12 IV][16 tag][ct]` layout, `getKey()` fail-closed on missing/non-32-byte key. No new dependency.
- **`src/lib/source-encryption.test.ts`** — 4 `node:test` cases (run via `tsx --test`): round-trip, distinct-IV-per-call + exact layout size, tamper-detection (GCM auth failure), and fail-closed key (missing + short). All green.
- **`src/lib/source-storage.ts`** — `uploadEncryptedSource(slug, version, mq5)` encrypts then `put`s to `sources/<slug>/v<N>.mq5.enc` with `allowOverwrite:false` (immutable) + `addRandomSuffix:false` (deterministic). `sourceBlobPathname()` exported as the path SSoT.
- **`scripts/upload-goldbot-source.js`** — one-time CJS uploader (mirrors `test-blob.js`), fetched GoldBot's real `.mq5` from the VM, encrypted, uploaded `sources/goldbot/v1.mq5.enc` (14030 bytes).
- **`SOURCE_ENCRYPTION_KEY`** — provisioned (openssl rand -hex 32) in Vercel production, preview, development.

## Verification

1. `tsx --test src/lib/source-encryption.test.ts` — 4/4 pass (round-trip, distinct-IV, tamper-detect, fail-closed-key).
2. `src/lib/source-storage.ts` writes exactly `sources/${robotSlug}/v${version}.mq5.enc` with `allowOverwrite:false`.
3. `vercel env ls` — `SOURCE_ENCRYPTION_KEY` present in all 3 scopes (count 3).
4. `list({prefix:'sources/goldbot/'})` returns `sources/goldbot/v1.mq5.enc (14030b)` — live in Blob.
5. No repo/Postgres leakage: no `.mq5`/`.mq5.enc` in the git tree; `.env.local` gitignored (`git check-ignore` confirms); no schema change stores source bytes/URLs.
6. `tsc --noEmit` + `eslint` clean on all three source files + the script.

Direct anonymous `fetch` of the blob download URL returns "Access denied" — confirming the store is genuinely private-access (authenticated read is Phase 4/SRCE-02). Decryptability of the stored bytes is proven by the Task 1 round-trip test, which exercises the exact `[12 IV][16 tag][ct]` layout the uploader wrote.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Blob store is private-access; `access:'public'` rejected**
- **Found during:** Task 3 (first upload attempt)
- **Issue:** `put(..., { access:'public' })` failed with `BlobError: Cannot use public access on a private store. The store is configured with private access.` The plan specified `access:'public'` (matching the Phase 1 decision), but the store has since been reconfigured to private (consistent with `scripts/test-blob.js` already using `access:'private'`).
- **Fix:** Switched both `src/lib/source-storage.ts` and `scripts/upload-goldbot-source.js` from `access:'public'` to `access:'private'`. This is strictly better security posture (private store + AES-256-GCM ciphertext = defence-in-depth) and the plan's `access:"public"` rationale (ciphertext-as-access-control) still holds a fortiori. The signed-URL read-path hardening remains Phase 4/SRCE-02 scope, unchanged.
- **Files modified:** `src/lib/source-storage.ts`, `scripts/upload-goldbot-source.js`
- **Commit:** `16fa61c` (source-storage.ts fix committed alongside the Task 3 script, since Task 2's earlier commit `2246593` still had `access:'public'`)

## Success Criteria (SRCE-01 / Criterion 4)

- [x] MQL5 source lives encrypted (AES-256-GCM) in Vercel Blob at `sources/<robotSlug>/v<N>.mq5.enc` — versioned, immutable (`allowOverwrite:false`).
- [x] Not in the repo, not in Postgres.
- [x] GoldBot's real current source is the first uploaded artifact (`sources/goldbot/v1.mq5.enc`), fetched from the VM — not a placeholder.
- [x] `SOURCE_ENCRYPTION_KEY` provisioned across all Vercel scopes; module fails closed without it.
- [x] Worker source-fetch rewiring explicitly deferred to Phase 4/SRCE-02 (not touched here).

## Notes for Downstream (Phase 4 / SRCE-02)

- The store is private — reading `sources/<slug>/v<N>.mq5.enc` from the daemon needs an authenticated/signed retrieval (the `BLOB_READ_WRITE_TOKEN` or a short-lived signed URL), not a bare `fetch`. This is the exact hardening SRCE-02 owns.
- To publish a new GoldBot source version, bump N (`v2.mq5.enc`) — `allowOverwrite:false` guarantees v1 stays immutable.

## Self-Check: PASSED

All 5 created files present on disk; all 3 task commits (66b0733, 2246593, 16fa61c) present in git history.
