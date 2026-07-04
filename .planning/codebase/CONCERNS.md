# Codebase Concerns

**Analysis Date:** 2026-07-04

## Tech Debt

**Hardcoded single-robot assumption (blocks multi-product roadmap):**
- Issue: The compile pipeline is hardwired for one product ("GoldBot"). Filenames, download names, tier semantics, and UI copy all assume a single EA. There is no `Robot`/`Product`/`Build` entity in the schema.
- Files:
  - `src/app/api/compiler/complete/route.ts:56` — `const fileName = \`AL-ai-FX_GoldBot_${jobId}.ex5\`` hardcoded.
  - `src/app/api/compiler/download/route.ts:47` — `const fileName = \`GoldBot_v2.0_${jobId}.ex5\`` (also a mismatch — the completion writer used `AL-ai-FX_GoldBot_...` but the downloader renames to `GoldBot_v2.0_...`).
  - `src/components/dashboard/LicenseManager.tsx:84` — literal `GoldBot_v2.0_{subscription.tier}` in title.
  - `prisma/schema.prisma:59-67` — `Compilation` model has no product/robot reference; only `subscriptionId` + `downloadUrl`.
- Impact: Cannot ship a second robot (cTrader/TradingView "Coming Soon" tiles already exist in landing copy) without schema migration, pipeline redesign, and external Windows compiler rework.
- Fix approach: Add `Product` model (id, slug, targetPlatform, outputExtension, filenameTemplate) plus `Subscription.productId` and `Compilation.productId`. Pass product metadata to the external compiler via `/api/compiler/poll` response. Normalize download filename between complete/download routes.

**Compile pipeline coupling — external compiler assumed omniscient:**
- Issue: `GET /api/compiler/poll` returns only `{ id, mt5AccountNumber, expiresAt }` — no robot type, no template, no product identifier. The external Windows compile server must "just know" it's building GoldBot for MT5.
- Files: `src/app/api/compiler/poll/route.ts:28-34`
- Impact: Even after adding a product entity, the poll contract is a hard blocker. The external compiler cannot dispatch to different templates without a code + external-service change deployed atomically.
- Fix approach: Extend the poll response with `productSlug`, `targetPlatform`, `templateVersion`. Version the compiler API (e.g. `/api/compiler/v2/poll`) so external server can migrate incrementally.

**Multiple `PrismaClient` instances in route files (connection leak risk):**
- Issue: Two API routes bypass the shared client in `src/lib/prisma.ts` and instantiate their own `PrismaClient`. Each cold-start of these serverless routes creates a fresh pool; on Vercel/serverless this exhausts Postgres connections quickly.
- Files:
  - `src/app/api/compiler/complete/route.ts:6` — `const prisma = new PrismaClient();`
  - `src/app/api/compiler/poll/route.ts:4` — `const prisma = new PrismaClient();`
- Impact: Connection storms against the remote Postgres, especially since `/api/compiler/poll` is polled by the external compiler on a loop.
- Fix approach: Replace with `import { prisma } from "@/lib/prisma";` — the shared singleton already caches via `globalForPrisma`.

**Prisma `log: ["query"]` enabled in production:**
- Issue: The shared client logs every query at all times, not just in development.
- Files: `src/lib/prisma.ts:7-9`
- Impact: Massive log volume and PII leakage (emails, MT5 numbers, JWT-adjacent lookups) in production stdout / Vercel logs.
- Fix approach: Gate on `NODE_ENV`: `log: process.env.NODE_ENV === "production" ? ["error", "warn"] : ["query", "error", "warn"]`.

**Unused `PrismaClient` import:**
- Issue: `src/app/[locale]/dashboard/billing/page.tsx:4` imports `PrismaClient` but only uses `PricingTier` from `@prisma/client`. Dead import.
- Files: `src/app/[locale]/dashboard/billing/page.tsx:4`
- Impact: Minor bundle noise, would trip stricter lint rules.
- Fix approach: `import { PricingTier } from "@prisma/client";`

**Pricing tier drift between UI and DB enum:**
- Issue: `src/config/pricing.ts` advertises 8 tiers (`10-days`, `1-month`, `6-months`, `1-year`, `lifetime`, `lifetime-source`, `secret-test`, `free-trial`), but the Prisma `PricingTier` enum only has 5 (`FREE_TRIAL`, `ONE_MONTH`, `SIX_MONTHS`, `LIFETIME`, `SECRET_TEST_TIER`). `mapTier()` silently coerces `10-days`, `1-year`, and `lifetime-source` to `ONE_MONTH` via the `default` case.
- Files:
  - `src/config/pricing.ts:1-17`
  - `prisma/schema.prisma:69-75`
  - `src/lib/subscriptions.ts:6-27`
- Impact: **Revenue leakage / access wrong plan** — a user paying $1,799 for `1-year` gets provisioned as `ONE_MONTH` (30 days), $79,999 for `lifetime-source` also becomes `ONE_MONTH`. Order table stores the wrong `pricingTier`.
- Fix approach: Add missing enum values to `PricingTier` in `schema.prisma`, extend `mapTier()` cases, update `computeExpirationDate()` to handle each. Make `default` throw instead of silently mapping.

**Filename mismatch between complete and download:**
- Issue: `complete` writes to blob as `AL-ai-FX_GoldBot_${jobId}.ex5`; `download` returns `Content-Disposition` as `GoldBot_v2.0_${jobId}.ex5`. Two different filenames for the same artifact.
- Files: `src/app/api/compiler/complete/route.ts:56`, `src/app/api/compiler/download/route.ts:47`
- Impact: Cosmetic, but confusing during support — the file the user downloads has a different name than the blob path shown in logs.
- Fix approach: Centralize filename generation in a helper keyed by product/version.

**`emailSuccess` dead-flag in `findOrCreateUser`:**
- Issue: `src/lib/subscriptions.ts:47-63` returns `{ user, emailSuccess: true }` unconditionally. `emailSuccess` is a hardcoded `true` inside `findOrCreateUser`; the actual email failure detection happens later in `provisionSubscription`. The initial constant serves no purpose.
- Files: `src/lib/subscriptions.ts:47-63`
- Impact: Misleading return shape suggests welcome-email delivery is tracked when it isn't.
- Fix approach: Drop `emailSuccess` from `findOrCreateUser`; only return it from `provisionSubscription`.

**Free trial "credentials" copy is stale:**
- Issue: `src/app/api/checkout/free-trial/route.ts:35` returns error copy referring to "welcome email with your credentials"/"get your password" — but the system moved to magic-link auth. New free-trial users have no password to receive.
- Files: `src/app/api/checkout/free-trial/route.ts:33-37`
- Impact: Support confusion; users read the error and expect a password reset flow that doesn't apply.
- Fix approach: Update copy to reference the secure sign-in link.

## Known Bugs

**Compile job left in `PROCESSING` forever if external compiler crashes:**
- Symptoms: A job flips `PENDING` → `PROCESSING` in `/api/compiler/poll` and stays there indefinitely if the Windows compile server dies mid-job or never posts to `/complete`. The dashboard `LicenseManager` polls forever because it only exits on `COMPLETED`/`FAILED`.
- Files:
  - `src/app/api/compiler/poll/route.ts:22-26` (marks PROCESSING with no timestamp of when)
  - `src/components/dashboard/LicenseManager.tsx:32-50` (client polling loop)
  - `prisma/schema.prisma:59-67` (no `startedAt`/`heartbeatAt` field)
- Trigger: External Windows compile server is currently offline; every new `update-mt5` call creates a `PENDING` row that gets grabbed by any restarted worker and orphaned.
- Workaround: Manual DB update: `UPDATE "Compilation" SET status='FAILED' WHERE status='PROCESSING' AND "updatedAt" < now() - interval '10 minutes';`
- Fix approach: Add `startedAt` + heartbeat, plus a reaper cron / cleanup route that marks stale `PROCESSING` jobs as `FAILED`. Cap client-side polling at ~5 minutes with an explicit timeout state.

**Compile job race — no lock between poll and status transition:**
- Symptoms: With two external compile workers, both can call `/api/compiler/poll` simultaneously and receive the same `PENDING` job before either has flipped it to `PROCESSING`.
- Files: `src/app/api/compiler/poll/route.ts:13-26`
- Trigger: Any deployment scenario with more than one compile worker (current setup is single-worker, so latent).
- Fix approach: Replace the `findFirst` + `update` with `prisma.$queryRaw` doing `UPDATE ... SET status='PROCESSING' WHERE id = (SELECT id FROM "Compilation" WHERE status='PENDING' ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *;` — atomic claim.

**Cross-user compile job authorization gap (theoretical):**
- Symptoms: `GET /api/compiler/download?jobId=` checks `job.subscription.userId === session.user.id`. That check is correct, but `GET /api/licenses/status?jobId=` also uses the same pattern — both trust the session's `userId`. If a `Compilation` row is orphaned from its `Subscription`, the include would return `undefined` and hit a runtime crash.
- Files: `src/app/api/compiler/download/route.ts:19-30`, `src/app/api/licenses/status/route.ts:19-27`
- Trigger: Unlikely in production (Prisma cascade on delete), but no defensive check.
- Fix approach: Explicit null guard on `job.subscription` before comparing `userId`.

**Session survives block/delete for up to 30 days:**
- Symptoms: `isBlocked` / `isDeleted` are checked only at `authorize()` time (`src/lib/auth.ts:35-43`). Every other authenticated endpoint (`update-mt5`, `licenses/status`, `download`, `update-password`, `billing`) only checks `session.user.id`. With JWT `maxAge: 30 * 24 * 60 * 60` (30 days) and `updateAge: 24h`, an admin blocking a malicious user leaves that user's existing JWT valid up to 24 h (until next `updateAge` refresh, which itself doesn't hit `authorize()`).
- Files:
  - `src/lib/auth.ts:118-146` (jwt/session callbacks — never re-check DB)
  - `src/app/api/licenses/update-mt5/route.ts:13-17`
  - `src/app/api/compiler/download/route.ts:6-9`
- Trigger: Block/delete a signed-in user; they can continue to compile/download for up to 24 h.
- Fix approach: Re-hydrate `role`/`isBlocked`/`isDeleted` from the DB inside the `jwt` callback (with cache) or introduce a `sessionVersion` counter that server-side actions cross-check.

## Security Considerations

**Paygate webhook signature verification silently disabled when secret missing:**
- Risk: If `PAYGATE_WEBHOOK_SECRET` is unset (misconfig, secret rotation, or dev environment leaking to prod), `verifyWebhookSignature` returns `true` and logs a warning instead of rejecting the request. Any anonymous POST can then provision a subscription.
- Files: `src/app/api/webhooks/paygate/route.ts:20-34`
- Current mitigation: Rate limit 1000 rpm (very high), amount validation, `PAID` status check on POST.
- Recommendations: Fail closed. Throw `500` and log critical if `PAYGATE_WEBHOOK_SECRET` is missing in production (`NODE_ENV === "production"`). Keep the dev bypass explicit and gated.

**Paygate GET callback signature scheme is trivial to bypass if leaked:**
- Risk: The GET callback signature is `HMAC-SHA256(orderRef + email + tier + amount, secret)`. There's no timestamp/nonce, so a valid webhook URL is replayable forever. If a URL is captured (proxy log, browser referrer, etc.), it can re-trigger provisioning until an unrelated order with the same `orderRef` exists.
- Files: `src/app/api/webhooks/paygate/route.ts:54-59`
- Current mitigation: Idempotency via `paygateId` unique constraint (`provisionSubscription` short-circuits if `existingOrder` found).
- Recommendations: Include timestamp/expiry in the signed payload; reject if `now - ts > 5min`. This still leaves the GET pattern (secrets in URL query strings) fundamentally weaker than POST.

**Admin SMTP credentials leaked into admin dashboard HTML:**
- Risk: `src/app/[locale]/dashboard/admin/page.tsx:120,124,128` renders `process.env.SMTP_HOST:SMTP_PORT`, `SMTP_FROM_NAME`/`SMTP_FROM_EMAIL`, `SMTP_USER` directly into the DOM (albeit `disabled`). This runs server-side then ships to the client as HTML — anyone with admin access sees them, and any admin session hijack (e.g. XSS through untrusted user-provided data) exposes them.
- Files: `src/app/[locale]/dashboard/admin/page.tsx:117-130`
- Current mitigation: Admin-role check via middleware + page-level `redirect("/dashboard")` if non-admin.
- Recommendations: Show a masked value (`smtp.mailtrap.io:2525` → `smtp.mailtrap.io:••••`) or a boolean "configured / not configured" indicator. Never render `SMTP_USER` directly.

**Rate limiter is in-memory only:**
- Risk: `InMemoryRateLimiter` in `src/lib/rate-limit.ts` uses a per-process `Map`. On serverless (Vercel) each cold instance has its own counter, so an attacker sees a fresh 5-attempt / 3-attempt / 100-req budget per lambda instance. Trivial to defeat by amortizing across concurrent connections.
- Files: `src/lib/rate-limit.ts:5-45`
- Current mitigation: None beyond the in-memory counter.
- Recommendations: Move to a shared store (Vercel KV / Upstash Redis / Postgres). Also, `getClientIdentifier` trusts `x-forwarded-for` without validating it comes from a known proxy — an attacker can spoof the IP by supplying any XFF header and pivot the counter per-request.

**Login endpoint has no rate limit:**
- Risk: `checkLoginRateLimit` exists in `src/lib/rate-limit.ts` but is never invoked. The NextAuth `authorize` in `src/lib/auth.ts` accepts unlimited credential attempts.
- Files: `src/lib/auth.ts:16-76`; `src/lib/rate-limit.ts:55-58` (unused export)
- Current mitigation: bcrypt cost factor 10 makes offline brute force slow.
- Recommendations: Wire `checkLoginRateLimit` into `authorize` (throw when exceeded). Consider account-lockout / captcha after N failures per email.

**Auth `console.log` statements leak signal (not values):**
- Risk: The `authorize` function logs `"[Auth] Attempting login"`, `"User not found"`, `"Invalid password"`, `"Login successful: ${role}"`. Values are not logged, but the presence/absence of "User not found" enables username enumeration through log correlation attacks, and the role log identifies admin logins.
- Files: `src/lib/auth.ts:23,31,53,57`
- Current mitigation: Logs are server-side.
- Recommendations: Downgrade to `debug` level or remove. Do not log successful admin logins in a linear stream — send to a security event stream instead.

**Magic link tokens are long-lived JWTs signed with `NEXTAUTH_SECRET`:**
- Risk: Magic-link tokens use the same secret as the main session JWT. Compromise of `NEXTAUTH_SECRET` compromises both. Also the token contains `email` + `userId` and lives 30 minutes with no revocation store.
- Files: `src/lib/magic-links.ts:20-30`, `src/lib/auth.ts:82-116`
- Current mitigation: 30-minute TTL; `authorize` for magic-link path checks `isBlocked`/`isDeleted` against DB.
- Recommendations: Use a distinct secret (`MAGIC_LINK_SECRET`). Track single-use consumption in DB (e.g. a `nonce` column keyed to `userId`, marked used on successful sign-in).

**Free-trial account never sets a password → user is magic-link-only until they reset:**
- Risk: `findOrCreateUser` creates users with `passwordHash: null`. The credentials provider then rejects them (`"User has no password hash"`, `src/lib/auth.ts:45-48`) — the only way in is via magic link. If Mailtrap fails, the user is stranded.
- Files: `src/lib/subscriptions.ts:47-63`, `src/lib/auth.ts:45-48`, `src/lib/mail.ts:7-11`
- Current mitigation: Free-trial route returns a 500 with a "contact support" message when email fails.
- Recommendations: Persist the failed provision as a queued job with retry, or return a one-time magic link URL in the API response so the client can display it.

**Free-trial rate limit is per-IP not per-email:**
- Risk: 2 trials per IP per day (`checkFreeTrialRateLimit`). An attacker with a rotating IP can create unlimited accounts; a shared-IP office (or CGNAT) locks out legitimate users.
- Files: `src/app/api/checkout/free-trial/route.ts:8-16`, `src/lib/rate-limit.ts:65-68`
- Current mitigation: `provisionSubscription` short-circuits on duplicate `paygateId` (irrelevant for free trial which has no paygateId) and duplicate `ACTIVE` subscription of same tier (this does prevent same-email reuse).
- Recommendations: Rate limit by email + IP combined. Add captcha for free trial.

**CSP allows `'unsafe-inline' 'unsafe-eval'` for scripts:**
- Risk: The default CSP in `next.config.ts:42` disables the two most important CSP protections. Any XSS becomes a full script execution.
- Files: `next.config.ts:41-43`
- Current mitigation: React's default text-escaping, `X-XSS-Protection` header.
- Recommendations: Adopt Next.js's nonce-based CSP, remove `'unsafe-inline'` and `'unsafe-eval'`. Marketing scripts (Google Ads, Facebook Pixel) can be loaded with `strict-dynamic`.

## Performance Bottlenecks

**Base64 file transfer inside a serverless POST body:**
- Problem: `/api/compiler/complete` accepts up to 10 MB of base64-encoded `.ex5` binary in the request body (`validateFileSize(base64Data, 10)`), then base64-decodes to a buffer. On Vercel, serverless functions default to a **4.5 MB body limit** on hobby/pro plans — 10 MB base64 (~7.5 MB raw) would be rejected at the platform edge before the code runs.
- Files: `src/app/api/compiler/complete/route.ts:30-54`
- Cause: External Windows compile server posts the compiled EA back as a JSON blob rather than uploading directly to Vercel Blob or streaming.
- Improvement path: Have the compiler server upload directly to Vercel Blob using a short-lived signed URL issued by a new `POST /api/compiler/upload-url` endpoint; then `POST /api/compiler/complete` only sends `{ jobId, blobUrl, status }` (< 1 KB). Also add `export const runtime = 'nodejs'; export const maxDuration = 60;` or a bodyparser override.

**Compile-worker polls DB in a tight loop with no idle handling:**
- Problem: `GET /api/compiler/poll` returns `{ job: null }` when queue is empty. The external Windows worker presumably re-polls immediately, hitting Postgres constantly.
- Files: `src/app/api/compiler/poll/route.ts:19-21`
- Cause: No long-polling or backoff hint in the API.
- Improvement path: Return `Retry-After` header or a `nextPollDelayMs` field; ideally switch to server-sent events or a queue (SQS / pg-boss). Alternatively add a Postgres `LISTEN/NOTIFY` channel.

**Client polls `/api/licenses/status` every 5 s indefinitely:**
- Problem: `LicenseManager.tsx:35-47` polls every 5 seconds while `isPolling` is true and only stops on `COMPLETED`/`FAILED`. If the job stays `PROCESSING` forever (see stuck-job bug above), each open tab hits Postgres every 5 s until the browser closes.
- Files: `src/components/dashboard/LicenseManager.tsx:32-50`
- Cause: No max iterations, no exponential backoff, no server-side timeout state.
- Improvement path: Cap at ~60 attempts (5 min), then surface an "email support" state. Use exponential backoff (5 s → 10 s → 20 s → 30 s).

**Admin overview does 5 sequential Prisma queries:**
- Problem: `src/app/[locale]/dashboard/admin/page.tsx:13-49` awaits `count`, `aggregate`, `count`, `findMany` (10), `findMany` (15) in series. Each is a round-trip to the remote Coolify Postgres.
- Files: `src/app/[locale]/dashboard/admin/page.tsx:13-49`
- Cause: `await` chain.
- Improvement path: `Promise.all([...])`.

**Landing page component is 1,066 lines of inline JSX:**
- Problem: `src/app/[locale]/page.tsx` is 1,066 lines with inline `const getXXX = (t: any) => [...]` factories called inside `.map()` in render.
- Files: `src/app/[locale]/page.tsx` (1,066 lines)
- Cause: All landing sections in a single component; helper arrays re-created on every render.
- Improvement path: Split into section components, memoize the static arrays outside render, replace `any` with proper types.

## Fragile Areas

**External Windows compile server (out of repo):**
- Files: `src/app/api/compiler/poll/route.ts`, `src/app/api/compiler/complete/route.ts` (both use `Bearer ${process.env.COMPILER_SECRET}`).
- Why fragile: The compiler is a separate Windows box authenticated only by a shared bearer token. It has no health check endpoint, no heartbeat, no dead-letter queue, and is currently **OFFLINE**. Any provisioned user attempting to compile builds a `PENDING` row that sits indefinitely.
- Safe modification: Do not add fields to `Compilation` without also updating the poll response contract (external server may crash on unknown fields depending on its parser). Any API rename requires atomic redeploy of both services.
- Test coverage: **Zero.** No integration test, no mock. The three endpoints (`/poll`, `/complete`, `/download`) have no test files.

**PricingTier mapping (`src/lib/subscriptions.ts:6-27`):**
- Files: `src/lib/subscriptions.ts:6-27,29-45`
- Why fragile: Adding a new UI tier without touching `mapTier`/`computeExpirationDate` silently downgrades users to `ONE_MONTH`. Adding a new DB enum value without touching UI creates orphaned subscriptions. Three places must stay in lockstep: `src/config/pricing.ts`, `prisma/schema.prisma`, `src/lib/subscriptions.ts`.
- Safe modification: When touching tiers, grep for all three files and update simultaneously. Consider a single source of truth (e.g. derive UI tiers from the Prisma enum).
- Test coverage: None for `mapTier`. Tier casing/aliasing is fully untested.

**i18n messages hand-derived by machine translation:**
- Files: `src/messages/{en,es,de,ar,hi,bn,ur}.json`, `scripts/translate-dictionaries.js`, `scripts/extract-strings.js`.
- Why fragile: `scripts/translate-dictionaries.js` uses an unofficial Google Translate endpoint (`translate.googleapis.com/translate_a/single?client=gtx`) with a 100 ms delay between strings and no error surface (silently returns original on failure). Translations were never reviewed by a human speaker; the "Landing" namespace alone has ~70 keys tested for existence only (`src/messages/landing-localization.test.ts`), never for correctness. Financial / legal / compliance copy (privacy, refund policy, MT5 warnings) is machine-translated in 6 non-English locales.
- Safe modification: Any new string must be added to `en.json` and reflowed via `translate-dictionaries.js`; existing translations are overwritten wholesale on rerun.
- Test coverage: Presence-only (no empty strings). Zero correctness or brand-consistency checks.

**Same-origin CSRF check is Origin-header-based:**
- Files: `src/proxy.ts:9-49`
- Why fragile: `csrfMiddleware` compares `request.headers.get('origin')` to `host`. If a client (native mobile app, curl script, some browsers on some requests) sends no `Origin`, the check is skipped. The middleware also whitelists `/api/webhooks/*` entirely — which is correct for external webhooks but means the paygate signature verification is the only gate.
- Safe modification: Do not weaken the Origin fallback further; any new mutating API should be inside `/api/` and outside `/api/webhooks/`.
- Test coverage: None.

**Prisma migrations directory is not committed:**
- Files: `prisma/schema.prisma` (present), `prisma/migrations/` (**does not exist**).
- Why fragile: `prisma.config.ts:8-9` references `migrations.path = "prisma/migrations"`, but the folder isn't in the repo. Schema drift between environments cannot be replayed. Coolify Postgres migrations must be run manually.
- Safe modification: Any schema change should be paired with a checked-in migration; today a `prisma db push` in one environment silently diverges from another.
- Test coverage: N/A.

## Scaling Limits

**Postgres connection pool via multiple `new PrismaClient()`:**
- Current capacity: 2 route files leak new pools; `src/lib/prisma.ts` is only lightly used by API routes but heavily used by server components. Remote Coolify Postgres default pool size is typically ~100 connections.
- Limit: On Vercel serverless with N concurrent cold starts, the two leaking routes consume `N × (default pool size, ~10)` connections just for compile-related traffic. `errors like "sorry, too many clients already"` will appear before 50 concurrent compile requests.
- Scaling path: Migrate to shared singleton in all routes; add PgBouncer / Prisma Accelerate in front of Postgres; set `connection_limit=5` explicitly per Prisma instance.

**In-memory rate limiter Map growth:**
- Current capacity: Cleanup runs on ~1% of requests. In sustained load, the `Map` grows until cleanup fires. Under DoS the Map is a memory-growth vector before the rate limit kicks in.
- Limit: Bounded by IP diversity and cleanup luck.
- Scaling path: Switch to bounded LRU (limit ~10k keys) or move to Redis/KV.

**Client polling as user count grows:**
- Current capacity: 1 poll every 5 s per open dashboard tab with a pending compile.
- Limit: 100 concurrent pending compiles → 20 rps against `/api/licenses/status` → 20 rps against Postgres.
- Scaling path: Push notifications via WebSocket, SSE, or Pusher/Ably. Or long-poll with 30 s server-side wait.

## Dependencies at Risk

**`next-auth: ^4.24.14` (v4 is in maintenance):**
- Risk: NextAuth v4 is in maintenance mode; v5 (Auth.js) is the current line. Combined with `next: 16.2.3` (bleeding-edge Next), some v4 middleware patterns are already legacy.
- Impact: Future Next.js versions may break `withAuth`/`getServerSession` middleware; new features (Passkeys, WebAuthn) require v5.
- Migration plan: Plan a v5 (Auth.js) migration; the JWT strategy code and providers translate mostly 1:1, but middleware and session callback shapes changed.

**`mailtrap: ^4.5.1` transactional sender:**
- Risk: Mailtrap is primarily a testing/dev SMTP sandbox — using it for production transactional email (Mailtrap Send API) works but is not the industry norm (SendGrid/Postmark/Resend/SES). Deliverability, DKIM/SPF setup, and support are limited.
- Impact: If Mailtrap has an outage or throttles the account, purchase confirmation + magic-link emails silently fail (`sendResetPasswordEmail` catches and swallows errors intentionally to avoid enumeration).
- Migration plan: Abstract behind a `Mailer` interface so the provider is swappable.

**Google Translate unofficial endpoint (`scripts/translate-dictionaries.js`):**
- Risk: `translate.googleapis.com/translate_a/single?client=gtx` is an internal/unofficial endpoint. It has no SLA, can rate-limit, and could disappear.
- Impact: The translation script silently returns English strings on failure, and no one would notice until users see mixed-language pages.
- Migration plan: Move to a paid translation API (DeepL, Google Cloud Translation) with retries and per-string diffs; or accept human-reviewed translations only.

**`@vercel/blob: ^2.3.3` vendor lock-in:**
- Risk: Blob storage for compiled EAs is Vercel-specific. `access: 'private'` blobs are served via a signed URL fetched with `Bearer ${BLOB_READ_WRITE_TOKEN}` — no direct S3/R2 fallback.
- Impact: Migrating off Vercel requires a full replacement of `put()` calls + download proxy logic.
- Migration plan: Introduce a `Storage` abstraction with `put(path, buf)` / `getSignedUrl(path)` methods.

## Missing Critical Features

**No robot/product entity in schema:**
- Problem: Roadmap includes multiple robots (see landing "Coming Soon" — GoldGap, TradingView bot, cTrader). Schema, pipeline, and UI are single-product.
- Blocks: Any second robot launch; per-product subscriptions; per-product pricing; per-product compile queues.

**No compile-job reaper / cron / dead-letter:**
- Problem: No mechanism to reap stuck `PROCESSING` jobs, retry failed ones, or notify users when a job times out.
- Blocks: Reliable compile pipeline; SLAs; incident postmortems (no audit of "how many jobs got stuck yesterday?").

**No compile-server health endpoint:**
- Problem: No `/api/compiler/health` for the Windows worker to signal liveness; no admin dashboard indicator "compiler online/offline".
- Blocks: On-call visibility into current situation (external server is offline right now).

**No migrations checked into repo:**
- Problem: `prisma/migrations/` doesn't exist. Team members / CI can't recreate the schema from source.
- Blocks: Onboarding; reproducible dev DBs; safe schema evolution.

**No admin action to manually retry / reset a compile:**
- Problem: Admin panel shows users, subscriptions, orders — but has no way to inspect `Compilation` rows or manually re-queue a stuck job.
- Blocks: Customer support workflows.

**No idempotency token on `/api/licenses/update-mt5`:**
- Problem: Every call to `update-mt5` creates a new `Compilation` row (`prisma.compilation.create` on line 47). A user double-clicking "Save & Lock" creates two jobs; the external worker races.
- Files: `src/app/api/licenses/update-mt5/route.ts:41-52`
- Blocks: Reliable user experience.

**No password-reset flow (only magic-link):**
- Problem: `forgot-password` sends a magic sign-in link, not a password reset link. `update-password/route.ts` requires an existing session. A user who forgot their password can only get in via magic link and then set a password from `/dashboard/reset-password`. This is a two-step recovery masquerading as one.
- Files: `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/update-password/route.ts`, `src/lib/magic-links.ts` (has `purpose: "reset"` but nothing consumes it differently)
- Blocks: Standard "reset password" UX expectations.

## Test Coverage Gaps

**Compile pipeline (`src/app/api/compiler/*`):**
- What's not tested: `poll` race conditions, `complete` upload path, `complete` failure path, `download` authorization, base64 size limits, filename generation.
- Files: `src/app/api/compiler/poll/route.ts`, `.../complete/route.ts`, `.../download/route.ts`
- Risk: The riskiest, most stateful, most external-dependent code has zero tests.
- Priority: **High.**

**Paygate webhook (`src/app/api/webhooks/paygate/route.ts`):**
- What's not tested: Signature verification when secret missing (fail-open bug), replay protection, GET vs POST paths, tier mapping edge cases.
- Risk: This route provisions paid access — a bug here is either revenue leakage or free-access exploit.
- Priority: **High.**

**Tier mapping (`src/lib/subscriptions.ts:6-45`):**
- What's not tested: `mapTier` fallthrough behavior, `computeExpirationDate` for every enum value, unknown tier handling.
- Risk: Silent revenue leakage as documented above.
- Priority: **High.**

**Auth (`src/lib/auth.ts`):**
- What's not tested: Credentials provider block/delete checks, magic-link provider validation, session/JWT callback role propagation.
- Files: `src/lib/auth.ts` — no `auth.test.ts`.
- Risk: Auth bypass or role escalation.
- Priority: **High.**

**Rate limiter (`src/lib/rate-limit.ts`):**
- What's not tested: Window boundary, cleanup, `x-forwarded-for` spoofing, per-instance isolation on serverless.
- Priority: Medium.

**Middleware CSRF (`src/proxy.ts`):**
- What's not tested: Origin-missing bypass, webhook allowlist, next-auth path allowlist.
- Priority: Medium.

**i18n translation quality (`src/messages/*.json`):**
- What's tested: Presence of Landing keys (`src/messages/landing-localization.test.ts`).
- What's not tested: Legal-copy accuracy, financial-terms consistency, RTL layout in Arabic/Urdu, pluralization, ICU MessageFormat parameters.
- Priority: Medium (compliance risk in some jurisdictions).

**Landing page (`src/app/[locale]/page.tsx`, 1,066 lines):**
- What's not tested: Rendering, hero CTA links, pricing cards.
- Priority: Low (marketing surface, but conversion-critical).

---

*Concerns audit: 2026-07-04*
