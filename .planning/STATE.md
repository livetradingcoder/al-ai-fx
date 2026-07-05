# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** A paying user receives their chosen, compiled, MT5-account-locked robot within minutes of checkout — automatically, every time.
**Current focus:** Phase 4 — Robot-Aware Compile Pipeline (Phase 3 complete)

## Current Position

Phase: 3 of 7 (Multi-Robot Schema Foundation) — **COMPLETE (3/3 plans)**
Status: **Phase 3 COMPLETE.** CTLG-01/CTLG-04/CTLG-05/SRCE-01 all closed. Robot model + NON-NULL robotId FKs live; first checked-in Prisma migration (0_init) applied via the build-step channel after a full remote reset (test DB — pre-approved); robotId threaded through provisionSubscription (fail-closed findUniqueOrThrow) and update-mt5 (denormalized onto Compilation); poll response additively carries robotSlug; compiler-filename.ts reconciled to lowercase `goldbot`. AES-256-GCM encrypted source storage live (`SOURCE_ENCRYPTION_KEY` in all 3 Vercel scopes; Blob store turned out to be private-access, not public — adjusted); GoldBot's real source uploaded as `sources/goldbot/v1.mq5.enc`. Next: Phase 4 — Robot-Aware Compile Pipeline.
Last activity: 2026-07-05 — Closed Phase 3 (03-01, 03-02, 03-03 all landed; 03-02 and 03-03 ran in parallel with zero file overlap, no conflicts).

Progress: [██████████░░░░░░░░░░░░░░░░] 38% (10/26 plans across all phases; 4/4 Phase 1, 3/3 Phase 2, 3/3 Phase 3)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 6m 15s
- Total execution time: 24m 57s

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Restore Compile Delivery | 4/4 | 24m 57s | 6m 15s |

**Recent Trend:**
- Last 5 plans: 01-01 (2m 21s), 01-02 (8m 30s), 01-03 (8m 33s), 01-04 (5m 33s)
- Trend: → (velocity steady; 01-04 was 3 tasks vs Wave 2's real infra work)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Compile-server recovery ships before multi-robot work (the offline server is the #1 launch blocker; nothing else matters if delivery doesn't work).
- Roadmap: Pricing tier drift + webhook fail-open ship in Phase 2 (before real revenue), not deferred.
- Roadmap: Multi-robot schema (Phase 3) lands before any catalog UX or pipeline threading — one dependency source of truth for Phases 4–7.
- Project: Test users may be wiped on schema changes; no data migration burden.
- 01-01: `attemptCount`/`attemptedAt` naming locked (not `attempts`/`startedAt`) for the whole Phase 1 compiler pipeline.
- 01-01: `WorkerHeartbeat.id` is a plain String @id (no default) — singleton row keyed `"compiler"` for the entire compile daemon fleet (one worker for now).
- 01-01: `db push` (not `migrate dev`) is the Phase 1 stopgap; formal migrations arrive in Phase 3.
- 01-01: Timing thresholds live in `src/lib/compiler-config.ts` as named `export const`s — never inline in poll/complete/reaper/LicenseManager code.
- 01-02: Blob access mode is `'public'` for Phase 1 — hardening to `'private'` (signed URLs) scoped for Phase 4 source-hardening.
- 01-02: Daemon uploads with `addRandomSuffix:false` + `allowOverwrite:true` → deterministic Blob pathname `compiled/AL-ai-FX_GoldBot_${jobId}.ex5` derivable from jobId alone.
- 01-02: Bounded-retry decision lives in `/api/compiler/complete`'s FAILED path, not the daemon. Daemon reports FAILED; server decides requeue vs terminal via `attemptCount + 1 < MAX_ATTEMPTS`.
- 01-02: Daemon cleanup runs only on `uploadedOk==true` — failed artifacts (.mq5, .ex5 if any, .log) retained for post-mortem.
- 01-02: `getCompiledFilename(jobId, {robotSlug?})` in `src/lib/compiler-filename.ts` is the single source of truth for `/complete` write path (Blob pathname) and `/download` read path (Content-Disposition) — never drift again.
- 01-02: Windows daemon fails fast (`process.exit(1)`) on missing `API_URL`, `COMPILER_SECRET`, or `BLOB_READ_WRITE_TOKEN` — no hardcoded fallbacks anywhere.
- 01-02: MetaEditor success = (exit==0) AND (.ex5 size > 0) AND (no `\berror\b|\bError\b` marker in UTF-16 log). Never trust exit code alone.
- 01-03: Atomic dequeue via Postgres `FOR UPDATE SKIP LOCKED` inside `prisma.$transaction` using `$queryRaw` (Prisma issue #5983 — no native SKIP LOCKED support). Standard pattern for any future queue in this DB.
- 01-03: Hobby-plan-safe cron: second NSSM service `al-ai-fx-reaper` on the same VM as `al-ai-fx-daemon`, independent lifetime; Pro-upgrade path is a one-line `vercel.json` crons entry + `nssm stop`.
- 01-03: Reaper `attemptedAt = null` on requeue-to-PENDING so the cutoff scan does not immediately re-match the row on the next tick.
- 01-03: Heartbeat upsert is best-effort (try/catch, non-fatal) — job dequeue matters more than observability.
- 01-04: Alert cooldown lives at module scope in `/api/compiler/reap` (per-warm-instance `lastAlertAt` map, 15 min) — not persisted. Cold starts may cause one duplicate email per event; acceptable vs adding a schema table for Phase 1.
- 01-04: `sendAdminCompilerAlertEmail` is silent-no-op on missing `MAILTRAP_TOKEN`/`SMTP_PASS` or missing `ADMIN_ALERT_EMAIL`/`SMTP_FROM_EMAIL` — never throws; alert path must never fail the request.
- 01-04: `TIMED_OUT` is a client-only React state (LicenseManager), NOT a Prisma `CompileStatus` enum value — avoids schema migration for pure UX transition. Server still emits PENDING/PROCESSING/COMPLETED/FAILED only.
- 01-04: Admin JSON endpoint gate uses `session?.user?.role !== 'ADMIN'` → 403 (distinct from page-level `redirect('/dashboard')`). Anonymous callers also get 403.
- 02-01: `PricingTier` enum extended 5 → 8 (`TEN_DAYS`, `ONE_YEAR`, `LIFETIME_SOURCE`); additive-only, `LIFETIME`/`SECRET_TEST_TIER` untouched.
- 02-01: `src/lib/pricing-tiers.ts` is the single source of truth — `TIER_METADATA: Record<TierId, TierMetadata>` compile-time-aligns `src/config/pricing.ts` slugs with the DB enum. All callers import `mapTier`/`computeExpirationDate`/`UnknownTierError` from here (re-exported by `subscriptions.ts` for now).
- 02-01: `mapTier` is a TOTAL function — throws `UnknownTierError` on unknown/aliased input (canonical-slug-only; old aliases `monthly`/`one_month`/`biannual`/`free_trial`/`secret_test` now throw). Every caller MUST translate to HTTP 400; never fall back to a default.
- 02-01: `computeExpirationDate` exhaustiveness enforced at COMPILE time via `assertNever(x: never)` — a future enum value without a case fails `tsc --noEmit`. Chosen over runtime coverage checks.
- 02-02: `verifyPaygateSignature` (`src/lib/webhook-signature.ts`) is the single fail-closed HMAC entry point — routes never hand-roll signature comparison. Missing secret => refuse; constant-time `timingSafeEqual` guarded by a length pre-check.
- 02-02: Dev bypass requires TWO keys (`NODE_ENV!=production` AND `PAYGATE_ALLOW_INSECURE_WEBHOOK=1`) — either alone fails closed. No fail-open-with-warning path exists anymore (SECR-01 closed).
- 02-02: Paygate webhook is GET-only; the POST handler was DELETED (Paygate.to's WordPress + WHMCS plugin source confirms GET-only callbacks; POST was dead code + a Vercel 4.5MB body-limit hazard).
- 02-02: `create-session` signs the registered callback URL with HMAC over `${orderRef}${email}${tier}${amount}` and fail-closes 500 (before the wallet API call) if `PAYGATE_WEBHOOK_SECRET` is missing. Payload order is load-bearing — must match the webhook GET's reconstruction exactly.
- 02-02: Tier validity in `create-session` now checks `tier in TIER_METADATA` (Plan 02-01 SSoT), replacing the ad-hoc `hasOwnProperty(PRICING_TIERS)` check.
- 02-03: Webhook idempotency uses `WebhookDelivery.signature @unique` + `create`-then-catch-`P2002` (never `findFirst`-then-create) — the Postgres UNIQUE INDEX is the entire mechanism and is race-safe across concurrent Paygate retries. Standard pattern for any future at-most-once webhook/delivery in this DB.
- 02-03: Duplicate webhook deliveries return HTTP 200 `duplicated:true` (not 4xx) so retriers stop; only P2002 short-circuits, all other errors (non-P2002 Prisma, non-Prisma) propagate — never swallow real DB failures.
- 02-03: `WebhookDelivery.orderRef` is NOT unique (a retried create-session yields a new signature for the same orderRef) and has no `orderId` FK (a replay has no legitimate Order); `receivedAt` indexed for a future cleanup cron (deferred).
- 03-01: `Robot` catalog model is the SSoT for tradable EAs (slug @unique, name, short/long desc, active, artworkUrl, sortOrder, timestamps). `Subscription.robotId` and `Compilation.robotId` are NON-NULL FKs with default `onDelete: Restrict` (NO cascade) — a referenced Robot cannot be deleted; retire via `active=false` so paid licenses are never orphaned.
- 03-01: Ended the `db push` era — first checked-in Prisma migration `prisma/migrations/0_init` now exists (generated offline via `migrate diff --from-empty --to-schema-datamodel --script`). All future schema changes follow: generate SQL offline → commit → apply via build channel with `migrate deploy` → revert build in a separate commit. No more `db push` now that a baseline exists.
- 03-01: Chose reset-and-clean-baseline over baselining the drifted DB (test data wipeable per PROJECT.md) — avoids P3005/migrate-resolve risk. The non-interactive wipe+apply is `prisma migrate reset --force --skip-generate --skip-seed` (single atomic drop+replay), NOT `db push --force-reset` (which re-populates the schema and caused P3005).
- 03-01: Full schema incl. `robotId` FKs went into the single `0_init` so Plan 03-02 needs NO further schema change or deploy — the columns already exist server-side.
- 03-01: Canonical LOWERCASE slug `goldbot` (display name `GoldBot`) is the join key for Blob paths `sources/<slug>/` + compiled filename. 03-02 must reconcile `compiler-filename.ts`'s capital-`GoldBot` default to this.
- 03-01: `scripts/seed-goldbot.js` (idempotent upsert on slug) chosen over Prisma-native seed config — mirrors `create-admin.js`, invocable directly in the build chain, avoids Prisma 6.19 seed-config-key uncertainty.
- 03-01: Provisional default-robot wiring landed (Rule 3 fix for the required column): `Compilation.create` denormalizes `robotId` from the subscription; `provisionSubscription` resolves default slug `goldbot` via `resolveDefaultRobotId()`. 03-02 owns real per-robot selection (checkout carries a robot slug).
- 03-02: `GOLDBOT_SLUG` constant in `subscriptions.ts` is the single Phase-3 write-path robot key. `provisionSubscription` resolves the Robot via `prisma.robot.findUniqueOrThrow({ where: { slug } })` — FAIL-CLOSED: a missing seed throws P2025 → surfaced as 500 by the caller's try/catch, never a dangling subscription. Replaced 03-01's provisional `findUnique`+manual-null-check helper.
- 03-02: `provisionSubscription` signature unchanged for Phase 3 — robot resolved internally; `free-trial` + `paygate` webhook callers untouched. Real per-robot slug threading from checkout is Phase 4+/6 work (NOT here).
- 03-02: Active-subscription duplicate guard is now scoped per (user, robot, tier) — `findFirst` includes `robotId: robot.id`. An active subscription is unique per robot, not just per tier.
- 03-02: `Compilation.robotId` is denormalized from the parent subscription AT CREATION and treated immutable — the compile worker needs the slug directly and a compilation's robot must not change even if the subscription is later re-pointed. (Do not derive robot via join at read time.)
- 03-02: `compiler-filename.ts` default slug reconciled from capital `GoldBot` → lowercase `goldbot` (matches DB `Robot.slug`). Compiled filename is now `AL-ai-FX_goldbot_<jobId>.ex5`; safe because the DB was wiped in 03-01 (no artifacts keyed on the old capitalized pathname). Supersedes the 01-02 note about `AL-ai-FX_GoldBot_...`.
- 03-02: `/api/compiler/poll` response now additively carries `robotSlug` (joined Robot relation) for the Phase 4 worker; all pre-existing daemon fields (`id`, `mt5AccountNumber`, `expiresAt`, `attemptCount`) unchanged. Null-check extended to guard a missing robot relation. Daemon contract preserved (reads it only in Phase 4).
- 03-03: MQL5 source-at-rest is AES-256-GCM (Node built-in `crypto`, zero new deps) keyed by a single env var `SOURCE_ENCRYPTION_KEY` (no KMS). `src/lib/source-encryption.ts` owns both directions + the `[12-byte IV][16-byte authTag][ciphertext]` blob layout; `getKey()` validates 32 bytes and FAILS CLOSED (throws) on missing/wrong-length. Never hand-roll CBC+HMAC.
- 03-03: Encrypted sources live in Vercel Blob at versioned immutable paths `sources/<slug>/v<N>.mq5.enc` via `uploadEncryptedSource` (`src/lib/source-storage.ts`) with `allowOverwrite:false` — a new version = a new `vN` file; `put` rejects on collision. `sourceBlobPathname()` is the path SSoT. Never in the repo, never in Postgres (no source bytes/URLs stored).
- 03-03: Blob store is PRIVATE-access (deviation from plan's `access:'public'`, which the store now rejects). `access:'private'` + AES ciphertext = defence-in-depth. Consequence for Phase 4/SRCE-02: the daemon read-path needs an authenticated/signed retrieval (bare anonymous `fetch` of the download URL returns "Access denied") — that signed-URL read-path is exactly SRCE-02's scope, still deferred.
- 03-03: `SOURCE_ENCRYPTION_KEY` generated via `openssl rand -hex 32`, same canonical value added to all 3 Vercel scopes via `echo "$KEY" | vercel env add SOURCE_ENCRYPTION_KEY <scope>` (piped stdin — automated, not a checkpoint; same pattern as `PAYGATE_WEBHOOK_SECRET` 02-02). Also written to gitignored `.env.local` for the local upload script.
- 03-03: Real GoldBot source (`ALaiFX_EA.mq5`, 14002 bytes) fetched live from the VM (`ssh alfx "Get-Content ...base_ea_source.mq5 -Raw"`) and uploaded as `sources/goldbot/v1.mq5.enc` (14030B enc) — the first live encrypted artifact, NOT a placeholder. `scripts/upload-goldbot-source.js` is the reusable one-time uploader (inlines the CJS crypto matching the TS module's layout). Worker source-fetch rewiring stays deferred to Phase 4/SRCE-02 (daemon still reads its local `base_ea_source.mq5` on the VM).

### Pending Todos

None.

### Blockers/Concerns

- **Windows compile server pipeline** — RESOLVED by Wave 2. `al-ai-fx-daemon` (from 01-02) uploads directly to Blob with fail-fast env checks + triple-check MetaEditor success detection + bounded-retry via `/complete`; `al-ai-fx-reaper` (from 01-03) auto-heals stuck rows every 60s. End-to-end retry loop validated live during 01-02.
- **RESOLVED 2026-07-05 (via SSH `alfx`): VM MetaTrader stdlib include path.** Root cause: LocalSystem's MetaQuotes terminal profile (`C:\Windows\system32\config\systemprofile\AppData\Roaming\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075\`) had no `MQL5` folder at all — Administrator's profile (same terminal ID) had the real install. Fix: copied Administrator's `MQL5` dir (Include, Experts, Libraries, etc.) into LocalSystem's terminal profile. Verified via one-shot `schtasks /RU SYSTEM` MetaEditor compile of `base_ea_source.mq5`: `Result: 0 errors, 1 warnings`, `.ex5` produced, `Trade.mqh` resolved. Test task + artifacts cleaned up after verification. No code change needed — filesystem-only fix on the VM.
- **RESOLVED 2026-07-05 (03-01): `prisma/migrations/` now exists in the repo.** First migration `0_init` generated offline and applied to remote Postgres via the build channel (`migrate reset --force`); `_prisma_migrations` tracks it (no P3005). Migration strategy decided: generate SQL offline via `migrate diff --from-empty` for the baseline, then `migrate deploy` for future changes — the `db push` stopgap is retired.
- **RESOLVED 2026-07-05 (02-01): extended `PricingTier` enum pushed to remote Postgres.** `vercel env pull` can't read `DATABASE_URL` locally (Vercel-Sensitive, write-only), so ran the push via the Vercel build step instead: temporarily changed `package.json` build script to `prisma generate && prisma db push --accept-data-loss && next build`, deployed (`vercel --prod --yes`), confirmed via build log `🚀 Your database is now in sync with your Prisma schema. Done in 406ms` against `db.prisma.io:5432`, then reverted the build script in a follow-up commit. All 8 `PricingTier` enum values now live server-side. Reusable pattern for any future `db push` needing the real prod `DATABASE_URL`.
- **External Windows worker parser strictness (Phase 4)** — Plan 01-03 confirmed the additive-only response contract works: `attemptCount` was added to `/poll` response with the daemon still parsing correctly (reads via `?? 0` fallback). Future extensions to `/poll` should stay strictly additive or version the endpoint.
- **Vercel Hobby plan** — external NSSM reaper is the compensating pattern. If/when upgrading to Pro, add `vercel.json` crons entry and `nssm stop al-ai-fx-reaper` (no code change).
- **RESOLVED 2026-07-05 (02-02): `PAYGATE_WEBHOOK_SECRET` provisioned in Vercel** — was absent (this was the reason 02-02 Task 1 was a checkpoint). Generated via `openssl rand -hex 32` and added to all three scopes (production/preview/development) via `echo "$SECRET" | vercel env add PAYGATE_WEBHOOK_SECRET <scope>` (piped stdin accepted by the interactive prompt). Verified present via `vercel env ls`. Rollout order satisfied — the secret is in Vercel BEFORE the 02-02 code merge, so `create-session` (signs) and the webhook GET (fail-closed) will not 500 on deploy. No local `.env` created.
- **`MAILTRAP_TOKEN` + `ADMIN_ALERT_EMAIL` not set in Vercel (surfaced by 01-04)** — verified via `vercel env ls`. Admin alert emails (retry-exhausted FAILED + stale-heartbeat) log a warning and no-op until the token lands. Non-blocking for Phase 1 completion; provisioning tracked as orchestrator Task #13. Add via `vercel env add MAILTRAP_TOKEN production` (paste API token from Mailtrap dashboard) + `vercel env add ADMIN_ALERT_EMAIL production`, then redeploy. No code change needed.

## Session Continuity

Last session: 2026-07-05
Stopped at: Completed 03-02-robotid-fk-wiring-PLAN.md — **Phase 3 IN PROGRESS (2/3; 03-03 may be running in parallel)**. CTLG-04 fully closed (schema + code halves). 3 feat commits (77d4a7f resolve GoldBot + robotId on subscription, 2e59c4a Compilation.robotId + lowercase filename slug, 19c9508 additive robotSlug in poll). tsc + eslint clean across all six touched files; no migration/deploy needed (columns already server-side from 03-01). SUMMARY at `.planning/phases/03-multi-robot-schema-foundation/03-02-robotid-fk-wiring-SUMMARY.md`. NEXT: await 03-03 completion, then orchestrator marks Phase 3 done.
Prior session stopped at: Completed 03-01-robot-model-migration-seed-PLAN.md — **Phase 3 IN PROGRESS (1/3)**. CTLG-01 + CTLG-05 closed, CTLG-04 schema half done. 5 commits (ba4e3e2 Robot model + robotId FKs + 0_init migration, a9579e4 seed-goldbot.js, 59e84a7 temporary migrate-reset build step [apply], 6dec0dc robotId wiring fix at 2 create sites, faa58d5 build script revert). Remote Postgres wiped + `0_init` applied (build log dpl `al-ai-cytnec37e`: `Applying migration 0_init` → `Database reset successful`, no P3005) + GoldBot seeded (`slug=goldbot active=true`). Clean green production deploy `al-ai-j1ojrzxbr` with reverted build. tsc + eslint clean. `prisma/migrations/` now exists — `db push` era over.
Resume file: Phase 3 Wave 2 — **03-02** (`.planning/phases/03-multi-robot-schema-foundation/03-02-robotid-fk-wiring-PLAN.md`) and **03-03** (`...03-03-encrypted-source-storage-PLAN.md`). Both depend only on 03-01 (done) and can run in parallel. 03-02: thread `robotId` through `provisionSubscription`/`update-mt5` (provisional default-`goldbot` wiring already in place from 03-01 — extend to real per-robot selection) + additive poll-response slug + reconcile `compiler-filename.ts` to lowercase `goldbot`. 03-03: AES-256-GCM `source-encryption.ts` + versioned Blob `uploadEncryptedSource` + provision `SOURCE_ENCRYPTION_KEY` + upload real GoldBot v1 from VM. NOTE: schema/DB columns already exist server-side — neither Wave 2 plan needs a further migration/deploy for `robotId`.
