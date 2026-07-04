# Technology Stack

**Analysis Date:** 2026-07-04

## Languages

**Primary:**
- TypeScript ^5 - All application code (`src/**/*.ts`, `src/**/*.tsx`)
- JavaScript (ESM) - Utility scripts in `scripts/` (e.g. `scripts/create-admin.js`, `scripts/test-blob.js`)

**Secondary:**
- SQL (via Prisma migrations) - `prisma/migrations/` (managed by Prisma CLI, schema authored in Prisma schema language at `prisma/schema.prisma`)
- JSON - Locale message catalogs (`src/messages/{en,hi,bn,ur,ar,de,es}.json`)

## Runtime

**Environment:**
- Node.js - Version pinned via `@types/node ^20`, targeted at Node 20+
- TypeScript compile target: `ES2017`, module `esnext`, moduleResolution `bundler` (`tsconfig.json`)

**Package Manager:**
- npm - Lockfile: `package-lock.json` present at project root
- No `.nvmrc` present

## Frameworks

**Core:**
- Next.js `16.2.3` - App Router web platform. Entry config at `next.config.ts`. Custom auth middleware lives at `src/proxy.ts` (project uses the renamed `proxy.ts` middleware convention rather than `middleware.ts`).
- React `19.2.4` / React DOM `19.2.4` - UI runtime
- Prisma `^6.19.3` (client `@prisma/client ^6.19.3`) - ORM. Schema at `prisma/schema.prisma`, config at `prisma.config.ts`. Uses `engine: "classic"` and binary targets `["native", "rhel-openssl-3.0.x"]` (Vercel-compatible).
- NextAuth `^4.24.14` - JWT-strategy auth wired in `src/lib/auth.ts`, mounted at `src/app/api/auth/[...nextauth]/route.ts`
- next-intl `^4.9.1` - i18n plugin registered in `next.config.ts` via `createNextIntlPlugin()`, routing config at `src/i18n/routing.ts`, request handler at `src/i18n/request.ts`

**Testing:**
- Not detected - No Jest / Vitest / Playwright config files. Test files exist alongside sources (`src/lib/*.test.ts`) but no runner is declared in `package.json` scripts.

**Build/Dev:**
- Next.js CLI - `next dev`, `next build`, `next start` (see `package.json` scripts)
- Prisma CLI `^6.19.3` - `prisma generate` runs on `postinstall` and pre-`build`
- Tailwind CSS `^4` via `@tailwindcss/postcss ^4` - Configured in `postcss.config.mjs`
- ESLint `^9` with `eslint-config-next 16.2.3` - Flat config at `eslint.config.mjs`

## Key Dependencies

**Critical:**
- `next 16.2.3` - Framework (breaking changes vs. older Next; see `AGENTS.md`)
- `next-auth ^4.24.14` - Session/JWT auth with credentials + magic-link providers
- `@prisma/client ^6.19.3` - Postgres access, singleton exposed in `src/lib/prisma.ts`
- `@vercel/blob ^2.3.3` - Private blob storage for compiled `.ex5` binaries (`src/app/api/compiler/complete/route.ts`, `src/app/api/compiler/download/route.ts`)
- `mailtrap ^4.5.1` - Transactional email via Mailtrap REST API (`src/lib/mail.ts`)
- `bcryptjs ^3.0.3` (+ `@types/bcryptjs`) - Password hashing (10 rounds) in `src/lib/auth.ts` and `src/app/api/auth/update-password/route.ts`
- `jsonwebtoken ^9.0.3` (+ `@types/jsonwebtoken`) - Magic-link JWT signing/verification in `src/lib/magic-links.ts` (30 minute default expiry)
- `validator ^13.15.35` (+ `@types/validator`) - Email + string sanitization in `src/lib/validation.ts`
- `next-intl ^4.9.1` - Locale routing and message loading for 7 locales

**Infrastructure:**
- `framer-motion ^12.38.0` - Client-side animations in marketing/dashboard components
- `lucide-react ^1.8.0` - Icon set (marketing pages, dashboards)

## Configuration

**Environment:**
- `.env` loaded by `prisma.config.ts` via `import "dotenv/config"` (Prisma CLI + migrations)
- Next.js loads env automatically from `.env`, `.env.local`, `.env.production`
- No `.env.example` present at project root
- All `NEXT_PUBLIC_*` env vars used from `src/lib/marketing.ts` (Google Ads, Meta Pixel)

**Required env vars (referenced in source):**
- `DATABASE_URL` - Postgres connection string (falls back to local dev URL in `prisma.config.ts`)
- `NEXTAUTH_SECRET` - Signs NextAuth JWTs and magic-link tokens
- `NEXTAUTH_URL` - Public base URL used to build magic links (fallback `https://www.al-ai-fx.xyz`)
- `PAYGATE_PAYOUT_USDC_ADDRESS` - Wallet address for Paygate wallet creation
- `PAYGATE_CALLBACK_URL_BASE` - Optional override for webhook callback host
- `PAYGATE_WEBHOOK_SECRET` - HMAC-SHA256 signature verification for `/api/webhooks/paygate`
- `COMPILER_SECRET` - Bearer token for external Windows compile server (poll + complete endpoints)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob store token, required to upload/download compiled binaries
- `MAILTRAP_TOKEN` (or fallback `SMTP_PASS`) - Mailtrap API token
- `SMTP_FROM_EMAIL` - Sender address (default `hello@al-ai-fx.xyz`)
- `SMTP_FROM_NAME` - Sender name (default `GoldBot Support`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` - Referenced by scripts but the runtime `src/lib/mail.ts` only uses the Mailtrap REST client
- `NEXT_PUBLIC_GOOGLE_ADS_ID`
- `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_BEGIN_CHECKOUT`
- `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_PURCHASE`
- `NEXT_PUBLIC_META_PIXEL_ID`

**Build:**
- `next.config.ts` - Wrapped in `withNextIntl(...)`. Defines security headers (`Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`) and a Content-Security-Policy that whitelists `https://api.paygate.to` and `https://checkout.paygate.to` for `connect-src` and `frame-src`.
- `tsconfig.json` - Strict mode on; path alias `@/* -> ./src/*`; JSX `react-jsx`.
- `prisma.config.ts` - Points Prisma at `prisma/schema.prisma` and `prisma/migrations`, uses classic engine.
- `postcss.config.mjs` - Tailwind CSS 4 via `@tailwindcss/postcss` plugin.
- `eslint.config.mjs` - Flat config combining `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

## Platform Requirements

**Development:**
- Node 20+, npm
- Local Postgres (falls back to `postgresql://postgres:postgres@localhost:5432/postgres` in `prisma.config.ts`)
- `.env` populated with at minimum `DATABASE_URL` and `NEXTAUTH_SECRET`
- Optional external services (Paygate, Vercel Blob, Mailtrap, Google Ads / Meta Pixel) for full flow

**Production:**
- Deployment target: Vercel (evidenced by `@vercel/blob` usage, `rhel-openssl-3.0.x` Prisma binary target, and matcher exclusion of `_vercel` in `src/proxy.ts`)
- Public origin: `https://www.al-ai-fx.xyz` (referenced in `src/lib/seo.ts`, `src/lib/mail.ts`, and fallbacks)
- Remote Postgres reachable from build env for `prisma generate` (schema-only) and from runtime
- External Windows compile server hitting `/api/compiler/poll` and `/api/compiler/complete` with `Authorization: Bearer <COMPILER_SECRET>`

---

*Stack analysis: 2026-07-04*
