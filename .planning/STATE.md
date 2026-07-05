# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** A paying user receives their chosen, compiled, MT5-account-locked robot within minutes of checkout — automatically, every time.
**Current focus:** Phase 3 — Multi-Robot Schema Foundation (Phase 2 complete)

## Current Position

Phase: 2 of 7 (Payment + Pricing Launch Blockers) — **COMPLETE (3/3 plans)**
Plan: 3 of 3 in current phase — done
Status: **Phase 2 COMPLETE.** All four launch-blocker requirements closed: PRIC-02 (tier drift, 02-01), SECR-01 (fail-open webhook, 02-02), SECR-02 (replay rejection, 02-03), SECR-03 (webhook idempotency, 02-03). `WebhookDelivery` table live on remote Postgres. Next: Phase 3 — Multi-Robot Schema Foundation.
Last activity: 2026-07-05 — Completed 02-03: added `WebhookDelivery` model (signature @unique), pushed to remote Postgres via Vercel build step (confirmed in sync, reverted), inserted P2002 replay short-circuit into webhook GET, 4/4 pattern unit tests green.

Progress: [███████░░░░░░░░░░░░░░░░░░░] 27% (7/26 plans across all phases; 4/4 Phase 1, 3/3 Phase 2)

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

### Pending Todos

None.

### Blockers/Concerns

- **Windows compile server pipeline** — RESOLVED by Wave 2. `al-ai-fx-daemon` (from 01-02) uploads directly to Blob with fail-fast env checks + triple-check MetaEditor success detection + bounded-retry via `/complete`; `al-ai-fx-reaper` (from 01-03) auto-heals stuck rows every 60s. End-to-end retry loop validated live during 01-02.
- **RESOLVED 2026-07-05 (via SSH `alfx`): VM MetaTrader stdlib include path.** Root cause: LocalSystem's MetaQuotes terminal profile (`C:\Windows\system32\config\systemprofile\AppData\Roaming\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075\`) had no `MQL5` folder at all — Administrator's profile (same terminal ID) had the real install. Fix: copied Administrator's `MQL5` dir (Include, Experts, Libraries, etc.) into LocalSystem's terminal profile. Verified via one-shot `schtasks /RU SYSTEM` MetaEditor compile of `base_ea_source.mq5`: `Result: 0 errors, 1 warnings`, `.ex5` produced, `Trade.mqh` resolved. Test task + artifacts cleaned up after verification. No code change needed — filesystem-only fix on the VM.
- **`prisma/migrations/` directory is not in the repo** — Phase 3 must decide migration strategy before schema changes land.
- **RESOLVED 2026-07-05 (02-01): extended `PricingTier` enum pushed to remote Postgres.** `vercel env pull` can't read `DATABASE_URL` locally (Vercel-Sensitive, write-only), so ran the push via the Vercel build step instead: temporarily changed `package.json` build script to `prisma generate && prisma db push --accept-data-loss && next build`, deployed (`vercel --prod --yes`), confirmed via build log `🚀 Your database is now in sync with your Prisma schema. Done in 406ms` against `db.prisma.io:5432`, then reverted the build script in a follow-up commit. All 8 `PricingTier` enum values now live server-side. Reusable pattern for any future `db push` needing the real prod `DATABASE_URL`.
- **External Windows worker parser strictness (Phase 4)** — Plan 01-03 confirmed the additive-only response contract works: `attemptCount` was added to `/poll` response with the daemon still parsing correctly (reads via `?? 0` fallback). Future extensions to `/poll` should stay strictly additive or version the endpoint.
- **Vercel Hobby plan** — external NSSM reaper is the compensating pattern. If/when upgrading to Pro, add `vercel.json` crons entry and `nssm stop al-ai-fx-reaper` (no code change).
- **RESOLVED 2026-07-05 (02-02): `PAYGATE_WEBHOOK_SECRET` provisioned in Vercel** — was absent (this was the reason 02-02 Task 1 was a checkpoint). Generated via `openssl rand -hex 32` and added to all three scopes (production/preview/development) via `echo "$SECRET" | vercel env add PAYGATE_WEBHOOK_SECRET <scope>` (piped stdin accepted by the interactive prompt). Verified present via `vercel env ls`. Rollout order satisfied — the secret is in Vercel BEFORE the 02-02 code merge, so `create-session` (signs) and the webhook GET (fail-closed) will not 500 on deploy. No local `.env` created.
- **`MAILTRAP_TOKEN` + `ADMIN_ALERT_EMAIL` not set in Vercel (surfaced by 01-04)** — verified via `vercel env ls`. Admin alert emails (retry-exhausted FAILED + stale-heartbeat) log a warning and no-op until the token lands. Non-blocking for Phase 1 completion; provisioning tracked as orchestrator Task #13. Add via `vercel env add MAILTRAP_TOKEN production` (paste API token from Mailtrap dashboard) + `vercel env add ADMIN_ALERT_EMAIL production`, then redeploy. No code change needed.

## Session Continuity

Last session: 2026-07-05
Stopped at: Completed 02-03-webhook-replay-idempotency-PLAN.md — **Phase 2 COMPLETE (3/3)**. SECR-02 + SECR-03 closed. 5 commits (94ec16c WebhookDelivery model, 2a7c540 + 910cc80 temporary db-push build step apply/revert, d39fb53 P2002 replay short-circuit in webhook GET, f1bea1a 4 pattern unit tests). `WebhookDelivery` table live on remote Postgres (build log `database is now in sync`, deployment dpl_3vHDV1hR94maxQY23pm4rDdYMqTB). tsc + eslint clean; 4/4 tests green. No outstanding db-push blockers — remote schema fully current.
Resume file: Phase 3 kickoff — plan `.planning/phases/03-multi-robot-schema-foundation/` (Multi-Robot Schema Foundation: `Robot` entity + checked-in migration strategy + wire `robotId` through Subscription/Compilation + encrypted source Blob storage). NOTE for Phase 3: `prisma/migrations/` is still absent — Phase 3 must decide the formal migration strategy before its schema changes land (the build-step `db push` workaround has been the Phase 1/2 stopgap).
