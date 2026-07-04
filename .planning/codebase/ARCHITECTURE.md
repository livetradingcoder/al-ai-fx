# Architecture

**Analysis Date:** 2026-07-04

## Pattern Overview

**Overall:** Next.js 16 App Router monolith with server-first rendering, thin service layer, external compile worker, and cookie-based JWT sessions.

**Key Characteristics:**
- Single Next.js app (`src/app`) handles both marketing site (`[locale]/...`) and authenticated dashboard (`[locale]/dashboard/...`) plus all backend routes (`api/...`) in one deploy target (Vercel).
- Data flows go directly from route handlers to Prisma — no repository/service-object abstraction. The only meaningful backend "service" is `src/lib/subscriptions.ts::provisionSubscription()` which is the shared entrypoint for both paid and free-trial subscription creation.
- Single Postgres database accessed through a global Prisma client singleton (`src/lib/prisma.ts`). One route (`src/app/api/compiler/complete/route.ts` and `.../poll/route.ts`) instantiates its own `new PrismaClient()` instead of reusing the singleton — this is an inconsistency to be aware of.
- Auth is JWT-only (`session.strategy = "jwt"` in `src/lib/auth.ts`) with two Credentials providers: email/password (bcryptjs) and magic-link (JWT verified in `src/lib/magic-links.ts`).
- The compile pipeline is asynchronous and outsourced to a separate Windows machine that polls the app for jobs. The Next.js app never runs MetaEditor itself.
- **Hardcoded to a single product ("GoldBot"):** The `Subscription` model has no `productId` / `robotId`. The compile output filename is baked in as `AL-ai-FX_GoldBot_<jobId>.ex5` (`src/app/api/compiler/complete/route.ts:56`) and `GoldBot_v2.0_<jobId>.ex5` (`src/app/api/compiler/download/route.ts:47`). Adding multi-robot support requires schema changes plus threading a product identifier through checkout → subscription → compilation → download.

## Layers

**Presentation (Server Components + Client Islands):**
- Purpose: Render locale-aware marketing pages and authenticated dashboard views.
- Location: `src/app/[locale]/**` (server components by default) with `"use client"` islands for interactive pieces.
- Contains: Page components (`page.tsx`), layouts (`layout.tsx`), and colocated client components (e.g. `src/app/[locale]/checkout/CheckoutClient.tsx`, `src/app/[locale]/checkout/thank-you/ThankYouClient.tsx`, `src/app/[locale]/dashboard/admin/users/UsersTable.tsx`).
- Depends on: `next-intl` for translations, NextAuth `getServerSession`, Prisma singleton, `src/lib/seo.ts` for metadata.
- Used by: The browser (via Next rendering) and the Navbar/DashboardSidebar client components.

**Shared UI Components:**
- Purpose: Cross-page UI primitives.
- Location: `src/components/**`
- Contains:
  - `src/components/Navbar.tsx` — Global marketing/dashboard nav (client, uses `useSession()`).
  - `src/components/LanguageSwitcher.tsx` — next-intl locale switcher.
  - `src/components/AuthSessionProvider.tsx` — Client-side `<SessionProvider>` wrapper.
  - `src/components/dashboard/DashboardSidebar.tsx` — Dashboard nav with role-gated admin section.
  - `src/components/dashboard/LicenseManager.tsx` — MT5 account editor + compile status poller (the client half of the compile pipeline).
  - `src/components/marketing/MarketingScripts.tsx`, `src/components/marketing/MarketingPageTracker.tsx` — Google Ads / Meta Pixel injectors.

**API Routes (App Router Route Handlers):**
- Purpose: All backend behavior (auth, checkout, webhooks, compile job endpoints, licenses).
- Location: `src/app/api/**/route.ts`
- Contains:
  - Auth: `api/auth/[...nextauth]/route.ts` (NextAuth handler), `api/auth/forgot-password/route.ts` (issues magic-link email), `api/auth/update-password/route.ts` (bcrypt password update).
  - Checkout: `api/checkout/free-trial/route.ts` (calls `provisionSubscription`), `api/paygate/create-session/route.ts` (creates Paygate wallet + returns hosted checkout URL), `api/paygate/order-status/route.ts` (thank-you page polls this).
  - Webhooks: `api/webhooks/paygate/route.ts` (GET + POST, HMAC-verified, calls `provisionSubscription`).
  - Compile pipeline: `api/compiler/poll/route.ts` (external worker pulls next job), `api/compiler/complete/route.ts` (worker uploads finished `.ex5`), `api/compiler/download/route.ts` (authenticated user streams blob).
  - Licenses: `api/licenses/update-mt5/route.ts` (user sets MT5 + enqueues compile job), `api/licenses/status/route.ts` (client polls compilation status).
- Depends on: Prisma singleton, `src/lib/subscriptions.ts`, `src/lib/rate-limit.ts`, `src/lib/validation.ts`, `src/lib/mail.ts`, `src/lib/magic-links.ts`, `@vercel/blob`.
- Used by: The browser (`LicenseManager`, `ThankYouClient`, `CheckoutClient`), Paygate (webhooks), external Windows compile worker (compile endpoints).

**Domain/Service Layer (thin):**
- Purpose: Reusable business rules that would otherwise duplicate across routes.
- Location: `src/lib/**`
- Contains:
  - `src/lib/subscriptions.ts` — `mapTier`, `computeExpirationDate`, `findOrCreateUser`, `provisionSubscription` (the single "provision on payment or free trial" entrypoint; also sends confirmation email with a magic-link).
  - `src/lib/auth.ts` — NextAuth `authOptions` (Credentials + magic-link providers, JWT callbacks that copy `id` and `role` from user → JWT → session).
  - `src/lib/magic-links.ts` — JWT sign/verify + URL builder for one-time login/reset links (30 minute default).
  - `src/lib/mail.ts` — Mailtrap REST client + three transactional templates (welcome, purchase, reset).
  - `src/lib/rate-limit.ts` — In-memory per-IP token bucket (login/forgot/free-trial/api/webhook variants). **Non-persistent, per-instance — see `CONCERNS.md`.**
  - `src/lib/validation.ts` — Email, MT5 account (5–12 digits), password (12 char + complexity), file size, amount validators.
  - `src/lib/seo.ts` — Localized page copy, canonical URL builder, sitemap entries.
  - `src/lib/pricing-showcase.ts` — Marketing card copy builders driven by `src/config/pricing.ts`.
  - `src/lib/marketing.ts` / `src/lib/marketing-client.ts` — Google Ads + Meta Pixel config and event helpers.
  - `src/lib/auth-redirects.ts` — Locale-aware login redirect URL builder.
- Depends on: Prisma singleton, JWT, bcryptjs, mailtrap, validator.
- Used by: API routes, server components, client components.

**Data Layer:**
- Purpose: Postgres persistence.
- Location: `prisma/schema.prisma` + `src/lib/prisma.ts`
- Contains models: `User`, `Subscription`, `Order`, `Compilation`; enums `UserRole`, `PricingTier`, `SubStatus`, `OrderStatus`, `CompileStatus`.
- Depends on: `DATABASE_URL` env, remote Postgres.
- Used by: Every server route/component. The Prisma client is instantiated once as a global singleton with query logging enabled.

**Middleware Layer:**
- Purpose: Locale routing, auth gating, CSRF-style origin check.
- Location: `src/proxy.ts` (Next.js 16 renamed the middleware convention; this project uses `proxy.ts` instead of `middleware.ts`).
- Depends on: `next-auth/middleware` (`withAuth`), `next-intl/middleware`, `src/i18n/routing.ts`.
- Behavior:
  - Wraps the whole app in `withAuth`. `authorized` callback gates `/admin` (requires `token.role === "ADMIN"`) and `/dashboard` (requires token).
  - For state-mutating methods on non-webhook, non-NextAuth `/api/*` routes, verifies `Origin` header matches `Host` and rejects with 403 otherwise.
  - For non-API paths, delegates to `createIntlMiddleware(routing)` to add/strip locale prefixes.
  - Matcher: `/`, `/(en|hi|bn|ur|ar|de|es)/:path*`, `/((?!api|_next|_vercel|.*\\..*).*)`, `/api/:path*`.

**Marketing / Tracking Layer (client-only):**
- `src/components/marketing/MarketingScripts.tsx` injects gtag + fbq snippets.
- `src/components/marketing/MarketingPageTracker.tsx` fires `trackPageView` on route change.
- `src/lib/marketing-client.ts` writes checkout state to `sessionStorage` and dedupes `Purchase` events by `orderRef`.

## Data Flow

### Marketing → Checkout → Payment → Subscription

1. Visitor lands on `/[locale]/` (`src/app/[locale]/page.tsx`, client component). Marketing scripts render server-side.
2. Visitor clicks a pricing card → navigates to `/[locale]/checkout?tier=<tier-id>` (`src/app/[locale]/checkout/page.tsx` → `CheckoutClient.tsx`).
3. `CheckoutClient` submits either:
   - **Free trial:** POST `/api/checkout/free-trial` with email → `provisionSubscription(email, "free-trial")` creates `User` (if missing) + `Subscription (FREE_TRIAL, ACTIVE, 3-day expiry)` and sends a magic-link email. UI shows success card.
   - **Paid tier:** POST `/api/paygate/create-session` with tier + email. Route generates a random `orderRef`, calls `https://api.paygate.to/control/wallet.php` to allocate a wallet, builds a payment URL against `https://checkout.paygate.to/process-payment.php`, and returns it. The client opens Paygate in a new window and redirects the current tab to `/checkout/thank-you?orderRef=<uuid>`.
4. Thank-you page (`ThankYouClient.tsx`) polls `/api/paygate/order-status?orderRef=...` every 5 seconds. This route checks the local `Order` table for a record matching `paygateId`; the order only exists once Paygate has hit the webhook.
5. Paygate calls the callback URL that was embedded in the wallet allocation: `GET /api/webhooks/paygate?order_ref=...&email=...&tier=...&amount=...&signature=...` (also supports a POST variant with JSON + `x-paygate-signature`). The route:
   - Rate-limits (1000/min), verifies HMAC-SHA256 signature against `PAYGATE_WEBHOOK_SECRET`, validates email + amount.
   - Calls `provisionSubscription(email, tier, orderRef, amount, currency)`.
6. `provisionSubscription` (`src/lib/subscriptions.ts:93`):
   - Idempotency: if an `Order` with matching `paygateId` already exists, returns `duplicated: true`.
   - Idempotency: if the user already has an `ACTIVE` `Subscription` of that tier, reuses it.
   - Otherwise creates `Subscription` with expiry from `computeExpirationDate(tier)` and creates the `Order` with `status: SUCCESS`.
   - Issues a magic-link JWT (via `src/lib/magic-links.ts`) and sends `sendPurchaseConfirmationEmail(...)`.
7. Next thank-you poll sees `Order.status === "SUCCESS"` and fires `trackPurchase` (deduped in `sessionStorage`).

### User Login (dashboard entry)

- **Credentials:** Login page (`src/app/[locale]/login/page.tsx`) calls `signIn("credentials", ...)`. NextAuth handler at `/api/auth/[...nextauth]` runs `authOptions.providers[0].authorize` → `prisma.user.findUnique` → bcrypt compare → returns user (blocked/deleted users are rejected).
- **Magic link:** Email contains `.../magic-login?token=<jwt>`. `MagicLoginPage` calls `signIn("magic-link", { token })`. The magic-link provider (`src/lib/auth.ts:77`) verifies the JWT via `verifyMagicLinkToken`, loads the user, and returns the session shape.
- On success, JWT callback stores `role` and `id`; session callback exposes them at `session.user.role` and `session.user.id` (typed in `src/types/next-auth.d.ts`).
- Middleware then permits `/dashboard/**` for any authenticated token and `/admin/**` (currently unused prefix — actual admin routes live under `/dashboard/admin`, which the `authorized` callback allows via the generic dashboard rule) only for `role === "ADMIN"`.

### Compile Pipeline (checkout → binary in user's browser)

The pipeline is asynchronous and split across the Next.js app, an external Windows compile worker, and Vercel Blob.

1. **User binds MT5 account.** In `/dashboard/licenses` (`src/app/[locale]/dashboard/licenses/page.tsx`), the server component fetches `subscriptions.include({ compilations: { orderBy: createdAt desc, take: 1 } })` and hands each active subscription to `<LicenseManager>`.
2. **Enqueue job.** `LicenseManager` (`src/components/dashboard/LicenseManager.tsx`) collects the MT5 number and PUTs `/api/licenses/update-mt5` with `{ subscriptionId, mt5AccountNumber }`. That route:
   - Verifies session ownership of the subscription.
   - Validates the MT5 number (5–12 digits, `src/lib/validation.ts:validateMT5Account`).
   - Sets `subscription.mt5AccountNumber`.
   - Creates a `Compilation { subscriptionId, status: PENDING }` and returns it.
3. **Client polls status.** `LicenseManager` starts a 5 s interval to `GET /api/licenses/status?jobId=<id>` (`src/app/api/licenses/status/route.ts`), which returns `{ id, status, downloadUrl, updatedAt }` after ownership check.
4. **External worker pulls the job.** The Windows compile server (not in this repo) sends `GET /api/compiler/poll` with `Authorization: Bearer $COMPILER_SECRET`. `src/app/api/compiler/poll/route.ts`:
   - Loads the oldest `Compilation` where `status === PENDING`, including its subscription.
   - Atomically flips its status to `PROCESSING`.
   - Returns `{ job: { id, mt5AccountNumber, expiresAt } }` (or `{ job: null }`).
   - **Note:** the Prisma client here is a fresh `new PrismaClient()` per module, not the singleton.
5. **Worker compiles MT5 EA offline.** Worker uses `mt5AccountNumber` + `expiresAt` as compile-time constants to produce an account-locked `.ex5`.
6. **Worker uploads result.** Worker POSTs `/api/compiler/complete` with `{ jobId, fileDataBase64, status }` and the same bearer secret. `src/app/api/compiler/complete/route.ts`:
   - Requires `BLOB_READ_WRITE_TOKEN` env; returns 500 otherwise.
   - Validates base64 file size ≤ 10 MB pre-decode and decoded buffer ≤ 5 MB.
   - Uploads to Vercel Blob at path `compiled/AL-ai-FX_GoldBot_<jobId>.ex5` with `access: 'private'`, `contentType: 'application/octet-stream'`.
   - Updates `Compilation { status: COMPLETED, downloadUrl: blob.url }`.
   - On `status !== "COMPLETED"` payload, flips the row to `FAILED`.
7. **User downloads.** Once client-side polling sees `status === COMPLETED`, the UI reveals a link to `/api/compiler/download?jobId=<id>` (`src/app/api/compiler/download/route.ts`):
   - Requires a session and verifies `compilation.subscription.userId === session.user.id`.
   - Fetches the private blob using `Authorization: Bearer ${BLOB_READ_WRITE_TOKEN}` and streams it back to the browser as `GoldBot_v2.0_<jobId>.ex5`.

**Idempotency / retries:**
- The `Compilation.status` state machine is `PENDING → PROCESSING → COMPLETED|FAILED`. There is no retry / requeue path; a `FAILED` job stays failed and the user must click "Save & lock" again to trigger a new PUT (which creates a fresh `Compilation` row).
- The polling route is not race-safe under multiple workers: two concurrent pollers could each read the same `PENDING` row before either update lands.

**State Management:**
- Server state is Postgres; client state lives inside individual client components with `useState` / `useEffect` (no Zustand/Redux/React Query).
- `sessionStorage` holds `pending_checkout:*` and `tracked_purchase:*` entries via `src/lib/marketing-client.ts`.
- NextAuth JWT is stored in an HttpOnly cookie; session lifetime 30 days, refresh every 24 h.

## Key Abstractions

**`User` (`prisma/schema.prisma:11`):**
- Purpose: Login identity + role. Soft-delete via `isDeleted`, block via `isBlocked`.
- Relations: `subscriptions Subscription[]`, `orders Order[]`.
- Notes: `passwordHash` is nullable — free-trial and magic-link users start without a password. `shouldResetPassword` forces a password set after admin-initiated flows.

**`Subscription` (`prisma/schema.prisma:31`):**
- Purpose: Represents one user's active license window for a tier.
- Fields: `tier PricingTier`, `status SubStatus`, `mt5AccountNumber String?` (the MT5 account the compiled EA is locked to), `startsAt`, `expiresAt`.
- Relations: `user User`, `compilations Compilation[]`.
- **Missing for multi-robot:** No product/robot identifier. Every subscription is implicitly for GoldBot.

**`Order` (`prisma/schema.prisma:46`):**
- Purpose: Historical payment record. Unique by `paygateId` (used for idempotency in `provisionSubscription`).
- Fields: `amount`, `currency`, `status OrderStatus`, `paygateId`, `pricingTier`.

**`Compilation` (`prisma/schema.prisma:59`):**
- Purpose: One compile job for a subscription. `downloadUrl` points at Vercel Blob once complete.
- State machine: `PENDING` (created by `/api/licenses/update-mt5`) → `PROCESSING` (`/api/compiler/poll`) → `COMPLETED` (blob uploaded) or `FAILED`.

**`PricingTier` enum (`prisma/schema.prisma:69`):**
- DB values: `FREE_TRIAL`, `ONE_MONTH`, `SIX_MONTHS`, `LIFETIME`, `SECRET_TEST_TIER`.
- Marketing tier IDs (`src/config/pricing.ts:1`): `free-trial`, `10-days`, `1-month`, `6-months`, `1-year`, `lifetime`, `lifetime-source`, `secret-test`.
- Mapping happens in `src/lib/subscriptions.ts::mapTier`. **Mismatch:** the pricing config exposes `10-days`, `1-year`, and `lifetime-source` in the UI but they all silently fall through to `ONE_MONTH` in `mapTier`'s `default` branch. Documented in `CONCERNS.md`.

**Magic Link (`src/lib/magic-links.ts`):**
- Purpose: Passwordless login + password-reset entry. Signed JWT with payload `{ email, purpose: "login" | "reset", userId }`, default 30 minute expiry.
- Verified inside the `magic-link` Credentials provider in `src/lib/auth.ts`.

**Locale-aware URL builder (`src/lib/seo.ts::buildLocalizedPath`):**
- Purpose: Central place to add the locale prefix (or omit for `en`). Used by mail links, redirects, sitemap, and metadata.

## Entry Points

**Marketing pages:**
- Location: `src/app/[locale]/{page,disclaimer,privacy-policy,faq,refund-policy,terms-conditions,support}.tsx`
- Triggers: Direct browser navigation, sitemap entries.
- Responsibilities: Localized SEO metadata (via `generateMetadata` + `src/lib/seo.ts::getPageMetadata`) and rendering marketing content.

**Checkout flow:**
- Location: `src/app/[locale]/checkout/page.tsx` + `CheckoutClient.tsx`, and `.../thank-you/page.tsx` + `ThankYouClient.tsx`.
- Triggers: Landing-page CTAs (`/checkout?tier=<id>`), Paygate redirect back.

**Auth pages:**
- Location: `src/app/[locale]/login/page.tsx`, `.../forgot-password/page.tsx`, `.../magic-login/page.tsx`.
- Triggers: Anonymous access, email links, `redirect("/login")` from server components.

**Dashboard:**
- Location: `src/app/[locale]/dashboard/{page,licenses,billing,reset-password}.tsx` and `.../admin/{page,users}.tsx`.
- Triggers: Authenticated navigation. Each server page independently calls `getServerSession(authOptions)` and `redirect("/login")` or `redirect("/dashboard")` on failure.

**NextAuth handler:**
- Location: `src/app/api/auth/[...nextauth]/route.ts` — exports `GET`/`POST` bound to `NextAuth(authOptions)`.

**Public webhook (external caller: Paygate):**
- Location: `src/app/api/webhooks/paygate/route.ts` — accepts GET (querystring signature) and POST (`x-paygate-signature` header).

**Compile worker endpoints (external caller: Windows compile server):**
- `GET /api/compiler/poll` — worker requests next job.
- `POST /api/compiler/complete` — worker uploads result.
- Both require `Authorization: Bearer ${COMPILER_SECRET}`.

**User-facing binary download:**
- `GET /api/compiler/download?jobId=<id>` — session-gated proxy to Vercel Blob.

**SEO endpoints:**
- `src/app/sitemap.ts` → delegates to `src/lib/seo.ts::getPublicSitemapEntries`.
- `src/app/robots.ts` → allow `/`, disallow `/api/`, `/dashboard`, `/login` and locale variants.

**Server actions:**
- `src/app/[locale]/dashboard/admin/users/actions.ts` — `toggleBlockUser`, `deleteUser` (both role-guard `session.user.role === "ADMIN"`, self-target guard, then `revalidatePath`).

## Error Handling

**Strategy:** Try/catch in each API route with `NextResponse.json({ error, details? }, { status })`. Server components typically `redirect(...)` on missing session rather than throw. There is no global error boundary file (`error.tsx`) at the moment.

**Patterns:**
- Rate limiter returns `{ success: false }` → route returns `429`.
- Validation helpers return `{ valid: false, error }` → route returns `400`.
- Bearer/HMAC signature failures → `401`.
- Missing configuration (`BLOB_READ_WRITE_TOKEN`, `NEXTAUTH_SECRET`) → `500` with a descriptive `details` field.
- NextAuth `authorize` returns `null` for silent failure and throws only for user-facing messages (blocked/deleted), which surface via `signIn` callback.
- Client polling code (`LicenseManager`, `ThankYouClient`) swallows fetch errors and logs to console.

## Cross-Cutting Concerns

**Logging:**
- `console.log` / `console.warn` / `console.error` throughout, tagged with `[Auth]`, `[Paygate Webhook]`, `[Compiler Complete]`, `[Mail]`, `[Subscription Service]`, etc.
- Prisma is configured with `log: ["query"]` in `src/lib/prisma.ts`, meaning every SQL statement is written to stdout in every environment.

**Validation:**
- Centralized in `src/lib/validation.ts` and called at the top of each mutating route.

**Authentication:**
- NextAuth JWT everywhere. Server components call `getServerSession(authOptions)`. Client components use `useSession()`.
- Route handlers under `/api/compiler/{poll,complete}` use a shared bearer secret instead of a session.
- Webhook authentication is HMAC-SHA256 with `PAYGATE_WEBHOOK_SECRET` (dev fallback: skip verification with a warning log).

**Authorization:**
- Role check pattern: `session?.user?.role === "ADMIN"` (`src/app/[locale]/dashboard/admin/page.tsx`, `.../admin/users/page.tsx`, `.../admin/users/actions.ts`, and the `withAuth` `authorized` callback in `src/proxy.ts`).
- Resource ownership checks are inline in each route (e.g. `subscription.userId !== session.user.id` → 404).

**Rate limiting:**
- `src/lib/rate-limit.ts` in-memory limiter keyed by IP from `x-forwarded-for`. Per-instance only; not shared across serverless regions. See `CONCERNS.md`.

**CSRF / Origin protection:**
- Implemented in `src/proxy.ts::csrfMiddleware` for state-mutating requests on `/api/*` (except `/api/webhooks/*` and `/api/auth/*`) by comparing `Origin` host to request `Host`.

**i18n:**
- Locales: `en, hi, bn, ur, ar, de, es` (`src/i18n/routing.ts`).
- `en` is unprefixed (`localePrefix: 'as-needed'`).
- `ar` and `ur` force `dir="rtl"` in `src/app/[locale]/layout.tsx`.
- Server components: `getTranslations("Namespace")`; client components: `useTranslations("Namespace")`.
- Messages loaded in `src/i18n/request.ts` from `src/messages/<locale>.json`.

**Security headers / CSP:**
- Configured in `next.config.ts::headers()` — HSTS, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- CSP whitelists `https://api.paygate.to` (connect) and `https://checkout.paygate.to` (connect + frame).

---

*Architecture analysis: 2026-07-04*
