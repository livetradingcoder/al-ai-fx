# External Integrations

**Analysis Date:** 2026-07-04

## APIs & External Services

**Payments (Paygate.to - crypto/USDC):**
- Wallet creation - `GET https://api.paygate.to/control/wallet.php`
  - Called from: `src/app/api/paygate/create-session/route.ts`
  - Auth: none (URL-based); requires `PAYGATE_PAYOUT_USDC_ADDRESS` env var as the `address` query param
  - Returns: `{ address_in, callback_url, ipn_token, polygon_address_in }`
- Hosted checkout - `https://checkout.paygate.to/process-payment.php`
  - Constructed in: `src/app/api/paygate/create-session/route.ts`
  - Client redirects the user to this URL with `address`, `amount`, `currency`, `email`, and optional `provider` query params.
- Content-Security-Policy in `next.config.ts` whitelists `api.paygate.to` (`connect-src`) and `checkout.paygate.to` (`connect-src`, `frame-src`).

**Compilation (self-hosted Windows compile server):**
- Job poll (incoming, external puller) - `GET /api/compiler/poll` (`src/app/api/compiler/poll/route.ts`)
  - Auth: `Authorization: Bearer ${COMPILER_SECRET}` header, compared to `process.env.COMPILER_SECRET`
  - Behavior: picks the oldest `PENDING` `Compilation` row, flips it to `PROCESSING`, and returns `{ jobId, mt5AccountNumber, expiresAt }`
- Job completion (incoming callback) - `POST /api/compiler/complete` (`src/app/api/compiler/complete/route.ts`)
  - Auth: same `Bearer ${COMPILER_SECRET}` scheme
  - Body: `{ jobId, fileDataBase64, status }`; base64 payload capped at 10 MB pre-decode and 5 MB post-decode
  - On success: uploads to Vercel Blob at `compiled/AL-ai-FX_GoldBot_${jobId}.ex5` with `access: 'private'`, sets `Compilation.status = COMPLETED` and stores `downloadUrl`
- The Windows worker uses these two endpoints as a pull-based queue and is not otherwise addressable from this app.

**Email (Mailtrap):**
- SDK: `mailtrap ^4.5.1` (`MailtrapClient`) initialized in `src/lib/mail.ts`
- Auth: `MAILTRAP_TOKEN` (or fallback `SMTP_PASS`) - Mailtrap API token
- Sender: `SMTP_FROM_EMAIL` (default `hello@al-ai-fx.xyz`), `SMTP_FROM_NAME` (default `GoldBot Support`)
- Templates in `src/lib/mail.ts`:
  - `sendWelcomeEmail(email, magicLinkUrl)` - category `Onboarding`
  - `sendPurchaseConfirmationEmail(email, tier, expiresAt, magicLinkUrl)` - category `Transaction`
  - `sendResetPasswordEmail(email, magicLinkUrl)` - category `Authentication`
- All templates render inline dark-gold branded HTML plus a plaintext fallback. Client is `null` when no token is configured; sends are then no-ops with a `console.warn`.

**Marketing / Analytics (client-side pixels):**
- Google Ads / gtag - fired via `window.gtag` (`src/lib/marketing-client.ts`)
  - Events: `page_view`, `begin_checkout`, `purchase`, and generic `conversion` with `send_to`
  - Env: `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_BEGIN_CHECKOUT`, `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_PURCHASE`
- Meta Pixel - fired via `window.fbq` (`src/lib/marketing-client.ts`)
  - Events: `PageView`, `ViewContent`, `InitiateCheckout`, `Purchase`
  - Env: `NEXT_PUBLIC_META_PIXEL_ID`
- Config parsed in `src/lib/marketing.ts` via `getMarketingConfig()`. `trackPurchase()` deduplicates by writing `tracked_purchase:<orderRef>` into `sessionStorage`.

## Data Storage

**Databases:**
- PostgreSQL (remote, likely Coolify-hosted per project context)
  - Connection: `DATABASE_URL` env var
  - Client: Prisma `^6.19.3`, singleton in `src/lib/prisma.ts` (with `log: ["query"]`), fresh `PrismaClient` instances also constructed in `src/app/api/compiler/poll/route.ts` and `src/app/api/compiler/complete/route.ts`
  - Schema at `prisma/schema.prisma` - models: `User`, `Subscription`, `Order`, `Compilation`; enums: `UserRole`, `PricingTier`, `SubStatus`, `OrderStatus`, `CompileStatus`
  - Binary targets: `native` and `rhel-openssl-3.0.x` (Vercel-compatible)
  - `prisma.config.ts` loads `.env` at CLI time via `import "dotenv/config"` so migrations hit the remote DB directly

**File Storage:**
- Vercel Blob (`@vercel/blob ^2.3.3`)
  - Auth: `BLOB_READ_WRITE_TOKEN` env var, passed explicitly to `put()` in `src/app/api/compiler/complete/route.ts`
  - Access: `private` - direct URLs require the same bearer token when fetched from `src/app/api/compiler/download/route.ts`
  - Path convention: `compiled/AL-ai-FX_GoldBot_<jobId>.ex5`; served to end users as `GoldBot_v2.0_<jobId>.ex5` via `Content-Disposition: attachment`
- Local filesystem: `public/` for static assets (logos, testimonials, tutorials) - no user uploads.

**Caching:**
- None external. In-memory only:
  - `InMemoryRateLimiter` in `src/lib/rate-limit.ts` (per-process `Map<string, number[]>`)
  - Prisma client is memoized on `globalThis` in dev (`src/lib/prisma.ts`)
  - Session storage on the client for pending-checkout and dedup keys (`src/lib/marketing-client.ts`)

## Authentication & Identity

**Auth Provider:**
- NextAuth v4 (`next-auth ^4.24.14`)
  - Options: `src/lib/auth.ts` (JWT strategy, 30-day `maxAge`, 24-hour `updateAge`, custom `signIn: '/login'`)
  - Handler: `src/app/api/auth/[...nextauth]/route.ts`
  - Two credentials providers:
    - `Credentials` (id `credentials`) - email + bcrypt password compare, respects `isBlocked` / `isDeleted` on `User`
    - `Credentials` (id `magic-link`) - accepts a signed magic-link JWT and resolves the user by `payload.userId`; clears `shouldResetPassword` on use
  - Callbacks store `role` and `id` on both the JWT and the session's `user`
- Middleware auth guard: `src/proxy.ts` wraps with `withAuth`
  - `/admin/*` requires `token.role === "ADMIN"`
  - `/dashboard/*` requires any authenticated token
  - Also runs a custom CSRF/origin check on state-mutating requests to `/api/*` (skipping `/api/auth/*` and `/api/webhooks/*`)
- Password hashing: `bcryptjs` at 10 rounds (`src/app/api/auth/update-password/route.ts`, `src/lib/auth.ts`)
- Password policy enforced in `src/lib/validation.ts::validatePassword` (min 12 chars, upper/lower/number/special, common-password blocklist)

**Magic links:**
- Signed JWTs via `jsonwebtoken`, 30-minute default expiry (`src/lib/magic-links.ts`)
- Payload: `{ email, purpose: 'login' | 'reset', userId }`
- URL built with `buildMagicLinkUrl()` -> localized path `/magic-login?token=...&callbackUrl=...`
- Issued from: `src/lib/subscriptions.ts::provisionSubscription` (login purpose), `src/app/api/auth/forgot-password/route.ts` (reset purpose)

## Monitoring & Observability

**Error Tracking:**
- None. All error paths use `console.error` / `console.warn` (e.g. `src/lib/auth.ts`, `src/app/api/webhooks/paygate/route.ts`).

**Logs:**
- `console.*` only. Prisma client is instantiated with `log: ["query"]` in `src/lib/prisma.ts`, so every query is logged to stdout in every environment.

## CI/CD & Deployment

**Hosting:**
- Vercel (implied by `@vercel/blob`, `rhel-openssl-3.0.x` Prisma binary target, and `src/proxy.ts` matcher exclusion of `_vercel`).

**CI Pipeline:**
- Not detected - no `.github/workflows/`, no `vercel.json` in the repository. Deployment appears to be direct Vercel git integration.

**Build hooks:**
- `postinstall`: `prisma generate` (regenerates client after `npm install`)
- `build`: `prisma generate && next build` (regenerates client before compiling Next.js)

## Environment Configuration

**Required env vars (grouped by consumer):**

- Database:
  - `DATABASE_URL`
- Auth / sessions:
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
- Paygate payments:
  - `PAYGATE_PAYOUT_USDC_ADDRESS`
  - `PAYGATE_WEBHOOK_SECRET` (HMAC-SHA256 secret for `/api/webhooks/paygate`)
  - `PAYGATE_CALLBACK_URL_BASE` (optional; overrides `NEXTAUTH_URL` when building the callback URL)
- Compile server + binary storage:
  - `COMPILER_SECRET`
  - `BLOB_READ_WRITE_TOKEN`
- Email:
  - `MAILTRAP_TOKEN` (falls back to `SMTP_PASS`)
  - `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` - referenced by `scripts/test-mailtrap.js` only; runtime uses the Mailtrap REST client
- Marketing pixels (public):
  - `NEXT_PUBLIC_GOOGLE_ADS_ID`
  - `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_BEGIN_CHECKOUT`
  - `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_PURCHASE`
  - `NEXT_PUBLIC_META_PIXEL_ID`

**Secrets location:**
- `.env` at project root (loaded automatically by Next.js; loaded explicitly by `prisma.config.ts` for CLI usage). No `.env.example` and no secret manager integration detected in-repo.

## Webhooks & Callbacks

**Incoming:**
- `GET /api/webhooks/paygate` - Paygate wallet callback (`src/app/api/webhooks/paygate/route.ts`)
  - Query params: `order_ref`, `email`, `tier`, `currency`, `value_coin` (or `amount`), `signature`
  - Auth: HMAC-SHA256 over `${orderRef}${email}${tier}${amount}` compared to `signature` param, keyed by `PAYGATE_WEBHOOK_SECRET`. If the secret is unset, verification is skipped with a warning (development mode).
  - On success: calls `provisionSubscription(email, tier, orderRef, amount, currency)`
- `POST /api/webhooks/paygate` - alternate JSON webhook path
  - Auth: HMAC-SHA256 over the raw body, signature read from `x-paygate-signature` header
  - Body: `{ orderId, customerEmail, amount, status, metadata: { tier } }`; only processed when `status === "PAID"`
- `GET /api/compiler/poll` - Windows compiler pulls new jobs (Bearer `COMPILER_SECRET`)
- `POST /api/compiler/complete` - Windows compiler posts the finished `.ex5` binary back (Bearer `COMPILER_SECRET`)
- Both compiler routes are exempt from the CSRF/origin check in `src/proxy.ts` because they live under `/api/*` but use their own bearer auth; the CSRF middleware skips webhook prefixes and NextAuth, and same-origin fetches otherwise.

**Outgoing:**
- Paygate wallet creation - `GET https://api.paygate.to/control/wallet.php` from `src/app/api/paygate/create-session/route.ts`
- Vercel Blob download fetches from `src/app/api/compiler/download/route.ts` (`fetch(job.downloadUrl, { headers: { Authorization: 'Bearer ${BLOB_READ_WRITE_TOKEN}' } })`) and re-streams the file to the authenticated user
- Mailtrap REST calls issued by the `MailtrapClient` SDK on every welcome / purchase / reset email

**Rate limiting on incoming endpoints (`src/lib/rate-limit.ts`, keyed by `x-forwarded-for` IP):**
- Login: 5 / 15 min
- Forgot password: 3 / hour
- Free trial: 2 / 24 h
- Generic API: 100 / min
- Webhook: 1000 / min

---

*Integration audit: 2026-07-04*
