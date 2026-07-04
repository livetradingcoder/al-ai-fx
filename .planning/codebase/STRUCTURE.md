# Codebase Structure

**Analysis Date:** 2026-07-04

## Directory Layout

```
al-ai-fx/
├── AGENTS.md                        # Agent-facing warning: Next 16 has breaking changes vs. training data
├── CLAUDE.md                        # Aliases AGENTS.md
├── README.md                        # Default create-next-app README
├── package.json                     # npm scripts + deps (Next 16.2.3 / React 19.2.4 / Prisma 6)
├── package-lock.json                # npm lockfile
├── next.config.ts                   # next-intl plugin + security headers + CSP
├── prisma.config.ts                 # Prisma CLI config (schema path, DATABASE_URL, classic engine)
├── postcss.config.mjs               # Tailwind CSS 4 via @tailwindcss/postcss
├── eslint.config.mjs                # Flat ESLint config (next/core-web-vitals + next/typescript)
├── tsconfig.json                    # Strict TS, @/* → src/*, jsx: react-jsx
├── Auto Run Docs/
│   └── Initiation                   # Project setup notes (non-code)
├── prisma/
│   └── schema.prisma                # Single-file Prisma schema (no migrations directory)
├── scripts/                         # Standalone Node scripts (JS, not compiled)
│   ├── create-admin.js
│   ├── promote-admin.js
│   ├── extract-strings.js
│   ├── translate-dictionaries.js
│   ├── update-en.js
│   ├── test-blob.js
│   └── test-mailtrap.js
├── public/                          # Static assets served at /
│   ├── favicon.ico / favicon.png / logo.png
│   ├── goldbot-social.png           # OG image (referenced from src/lib/seo.ts)
│   ├── goldbotmt5.avif              # Hero image
│   ├── branding/
│   ├── testimonials/                # Screenshot JPEGs used on landing page
│   ├── tutorials/                   # Tutorial imagery
│   └── next.svg / vercel.svg / *.svg
├── src/
│   ├── proxy.ts                     # Next.js 16 "middleware" (renamed to proxy.ts)
│   ├── app/                         # App Router root
│   │   ├── globals.css              # ~4.5k lines of global styles (Tailwind + custom)
│   │   ├── favicon.ico
│   │   ├── sitemap.ts               # Public sitemap.xml
│   │   ├── robots.ts                # robots.txt
│   │   ├── [locale]/                # All localized pages live under this dynamic segment
│   │   │   ├── layout.tsx           # Root layout: NextIntlClientProvider, AuthSessionProvider, Navbar, footer
│   │   │   ├── page.tsx             # Marketing landing (large client component with animations)
│   │   │   ├── login/page.tsx
│   │   │   ├── magic-login/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── checkout/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── CheckoutClient.tsx
│   │   │   │   └── thank-you/
│   │   │   │       ├── page.tsx
│   │   │   │       └── ThankYouClient.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── layout.tsx       # Sidebar shell
│   │   │   │   ├── page.tsx         # Overview
│   │   │   │   ├── licenses/page.tsx
│   │   │   │   ├── billing/page.tsx
│   │   │   │   ├── reset-password/page.tsx
│   │   │   │   └── admin/
│   │   │   │       ├── page.tsx     # Admin overview (revenue, compiles, tables)
│   │   │   │       └── users/
│   │   │   │           ├── page.tsx
│   │   │   │           ├── UsersTable.tsx
│   │   │   │           └── actions.ts    # "use server" server actions
│   │   │   ├── tutorials/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── support/page.tsx
│   │   │   ├── faq/page.tsx
│   │   │   ├── disclaimer/page.tsx
│   │   │   ├── privacy-policy/page.tsx
│   │   │   ├── terms-conditions/page.tsx
│   │   │   └── refund-policy/page.tsx
│   │   └── api/                     # Route handlers (NOT locale-prefixed)
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts
│   │       │   ├── forgot-password/route.ts
│   │       │   └── update-password/route.ts
│   │       ├── checkout/
│   │       │   └── free-trial/route.ts
│   │       ├── paygate/
│   │       │   ├── create-session/route.ts
│   │       │   └── order-status/route.ts
│   │       ├── webhooks/
│   │       │   └── paygate/route.ts
│   │       ├── licenses/
│   │       │   ├── status/route.ts
│   │       │   └── update-mt5/route.ts
│   │       └── compiler/
│   │           ├── poll/route.ts        # External worker → GET (bearer)
│   │           ├── complete/route.ts    # External worker → POST (bearer)
│   │           └── download/route.ts    # User → session-gated
│   ├── components/
│   │   ├── AuthSessionProvider.tsx
│   │   ├── Navbar.tsx
│   │   ├── LanguageSwitcher.tsx
│   │   ├── dashboard/
│   │   │   ├── DashboardSidebar.tsx
│   │   │   └── LicenseManager.tsx       # Client polling + MT5 input; core of the compile UX
│   │   └── marketing/
│   │       ├── MarketingScripts.tsx     # Injects gtag + fbq
│   │       └── MarketingPageTracker.tsx # Fires page_view on route change
│   ├── config/
│   │   └── pricing.ts                   # TierId + PRICING_TIERS (marketing tier catalog)
│   ├── i18n/
│   │   ├── routing.ts                   # Locales + defineRouting + createNavigation exports
│   │   └── request.ts                   # next-intl getRequestConfig
│   ├── lib/
│   │   ├── auth.ts                      # NextAuth authOptions (credentials + magic-link)
│   │   ├── auth-redirects.ts
│   │   ├── magic-links.ts               # JWT sign/verify + URL builder
│   │   ├── mail.ts                      # Mailtrap client + 3 templates
│   │   ├── marketing.ts                 # gtag/fbq config from env
│   │   ├── marketing-client.ts          # Client-only tracking helpers + sessionStorage
│   │   ├── pricing-showcase.ts          # Marketing card copy builders
│   │   ├── prisma.ts                    # Prisma singleton with query logging
│   │   ├── rate-limit.ts                # In-memory per-IP token bucket
│   │   ├── seo.ts                       # PAGE_COPY per locale + sitemap helpers
│   │   ├── subscriptions.ts             # provisionSubscription (the shared provisioning entrypoint)
│   │   ├── validation.ts                # Email/MT5/password/amount/file-size validators
│   │   └── *.test.ts                    # Colocated tests (no runner configured)
│   ├── messages/                        # next-intl message catalogs
│   │   ├── en.json / hi.json / bn.json / ur.json / ar.json / de.json / es.json
│   │   └── landing-localization.test.ts
│   └── types/
│       └── next-auth.d.ts               # Session/User/JWT module augmentation for role + id
└── .planning/
    ├── INTENT_NOTES.md
    └── codebase/                        # ← These docs (STACK.md, ARCHITECTURE.md, STRUCTURE.md, ...)
```

## Directory Purposes

**`src/app/[locale]/`:**
- Purpose: Every user-facing page. The dynamic `[locale]` segment is validated in `src/app/[locale]/layout.tsx` against `routing.locales`; unknown locales `notFound()`.
- Contains: Server components (default) with client component siblings named `<Feature>Client.tsx`. Layouts define shared shells.
- Key files: `layout.tsx`, `page.tsx`, `dashboard/layout.tsx`, `dashboard/licenses/page.tsx` (client wraps `LicenseManager`), `checkout/CheckoutClient.tsx`.
- Convention: **Do not** put API routes under `[locale]/`. API stays flat under `src/app/api/**` so it's locale-agnostic.

**`src/app/api/`:**
- Purpose: All backend HTTP handlers. Route filenames are `route.ts` exporting `GET`, `POST`, `PUT`, `DELETE`.
- Contains: One subdirectory per concern (`auth`, `checkout`, `paygate`, `webhooks`, `licenses`, `compiler`).
- Key files: `webhooks/paygate/route.ts` (Paygate → Next), `compiler/poll/route.ts` + `complete/route.ts` (external worker), `licenses/update-mt5/route.ts` (enqueue compile), `licenses/status/route.ts` (client poll).

**`src/components/`:**
- Purpose: Reusable UI split by consumer area.
- Contains:
  - Top level: Cross-page primitives (`Navbar.tsx`, `LanguageSwitcher.tsx`, `AuthSessionProvider.tsx`).
  - `dashboard/`: Dashboard-only components.
  - `marketing/`: Analytics injectors.
- Key files: `dashboard/LicenseManager.tsx` (owns the compile-poll interaction).

**`src/lib/`:**
- Purpose: Framework-agnostic helpers and the tiny domain layer. **This is where new server-side logic should go**, unless it must live in a route or component.
- Contains: Prisma singleton, auth config, mail/JWT helpers, validators, rate limiter, SEO/marketing helpers, subscription provisioning.
- Key files: `prisma.ts`, `auth.ts`, `subscriptions.ts`, `validation.ts`, `rate-limit.ts`, `mail.ts`, `magic-links.ts`, `seo.ts`.

**`src/config/`:**
- Purpose: Static config/data referenced by both server and client (e.g. tier catalog).
- Contains: `pricing.ts` (`PRICING_TIERS` record, `TierId` union).
- **Add here:** Anything that is a plain constant table shared between UI and API.

**`src/i18n/`:**
- Purpose: next-intl wiring.
- Contains: `routing.ts` (locales list + `createNavigation` exports of `<Link>`, `useRouter`, `redirect`), `request.ts` (loads messages).
- **Do not** import `next/link` inside localized pages — always import `Link` from `@/i18n/routing`.

**`src/messages/`:**
- Purpose: One JSON per locale. Namespaced by top-level object key (e.g. `Landing`, `Navbar`, `Dashboard`, `Auth`, `Checkout`, `Tutorials`).
- Convention: Add new keys to `en.json` first, then run `scripts/translate-dictionaries.js` (or update other locales manually).

**`src/types/`:**
- Purpose: Ambient `.d.ts` declarations only.
- Contains: `next-auth.d.ts` extending `Session.user` with `id: string; role: UserRole`.

**`src/proxy.ts`:**
- Purpose: Combined middleware — CSRF-style origin check, NextAuth `withAuth`, and next-intl locale middleware.
- Note: Next.js 16 uses `proxy.ts` (not `middleware.ts`). Do not rename.

**`prisma/`:**
- Purpose: Prisma schema. **No `migrations/` directory currently exists** — migrations against the remote Postgres (Coolify) are managed elsewhere or applied via `prisma db push`. The `prisma.config.ts` still points at `prisma/migrations` for future use.

**`scripts/`:**
- Purpose: Standalone Node maintenance scripts (JS, not TS, not part of the build).
- Contains: Admin creation/promotion, environment probes (`test-blob.js`, `test-mailtrap.js`), i18n helpers (`extract-strings.js`, `translate-dictionaries.js`, `update-en.js`).
- Convention: Run with `node scripts/<name>.js` from the project root; they load `.env` via `dotenv` implicitly through Prisma.

**`public/`:**
- Purpose: Static files served at `/`. Referenced with root-relative paths (`/goldbotmt5.avif`, `/testimonials/*.jpeg`, `/favicon.png`).

## Key File Locations

**Entry Points:**
- `src/app/[locale]/layout.tsx` — Root HTML layout, applies `dir="rtl"` for `ar`/`ur`, wraps in `SessionProvider` + `NextIntlClientProvider`.
- `src/app/[locale]/page.tsx` — Marketing landing (client component with framer-motion).
- `src/app/api/auth/[...nextauth]/route.ts` — Auth handler.
- `src/proxy.ts` — Middleware / auth gate.

**Configuration:**
- `next.config.ts` — Next config + security headers + CSP.
- `prisma.config.ts` — Prisma CLI config.
- `tsconfig.json` — TS strict mode, `@/*` alias.
- `eslint.config.mjs` — Flat ESLint.
- `postcss.config.mjs` — Tailwind 4.

**Core Logic:**
- `src/lib/subscriptions.ts` — `provisionSubscription()`, the single source of truth for creating a subscription after a paid webhook or free trial.
- `src/lib/auth.ts` — NextAuth options (credentials + magic-link providers).
- `src/lib/prisma.ts` — Prisma singleton (`prisma`).
- `src/lib/magic-links.ts` — Magic-link JWT helpers.
- `src/lib/validation.ts` — Shared validators.
- `src/lib/rate-limit.ts` — Rate limiter (in-memory).
- `src/config/pricing.ts` — Tier catalog (`PRICING_TIERS`, `TierId`).
- `prisma/schema.prisma` — Data model.

**Testing:**
- Colocated `*.test.ts` files under `src/lib/` and `src/messages/`. **No test runner is wired up in `package.json`**; these are aspirational/unrunnable as-is.

## Naming Conventions

**Files:**
- Page components: lowercase kebab-case directories, filename always `page.tsx` (App Router convention).
- Route handlers: filename always `route.ts` inside a segment directory.
- Client components colocated with server pages: PascalCase filename ending in `Client.tsx` (e.g. `CheckoutClient.tsx`, `ThankYouClient.tsx`).
- Reusable components under `src/components/`: PascalCase `.tsx` (e.g. `LicenseManager.tsx`, `DashboardSidebar.tsx`).
- Server actions files: `actions.ts` (with `"use server"` at the top).
- Library helpers under `src/lib/`: lowercase kebab-case (e.g. `magic-links.ts`, `auth-redirects.ts`, `pricing-showcase.ts`).
- Types: ambient `.d.ts` files under `src/types/` (e.g. `next-auth.d.ts`).

**Directories:**
- App Router dynamic segments: `[param]` (e.g. `[locale]`, `[id]`, `[...nextauth]`).
- API groupings: singular or plural noun (`auth`, `paygate`, `webhooks`, `licenses`, `compiler`, `checkout`).
- Locale codes: two-letter ISO 639-1 (`en`, `hi`, `bn`, `ur`, `ar`, `de`, `es`).

**Imports:**
- Always use `@/...` alias for src-relative imports (configured in `tsconfig.json`).
- Locale-aware navigation must import from `@/i18n/routing`, not `next/link` / `next/navigation` (except in fully server contexts where `next/navigation`'s `redirect` is fine — `src/app/[locale]/dashboard/page.tsx` does this).
- Session provider on the client uses `useSession` from `next-auth/react`.

## Where to Add New Code

**New locale-aware page:**
- Create `src/app/[locale]/<slug>/page.tsx` as a server component.
- If interactive, colocate `<Slug>Client.tsx` and re-export from `page.tsx` inside a `<Suspense>` where useful.
- Add SEO metadata via `generateMetadata` calling `getPageMetadata()` from `src/lib/seo.ts` (register the new key in `PublicPageKey` + `PAGE_PATHS` + `PAGE_COPY` + `INDEXABLE_PAGES` if it should appear in the sitemap).
- Add translations under a new namespace in every `src/messages/<locale>.json`.

**New API endpoint:**
- Create `src/app/api/<area>/<endpoint>/route.ts` exporting `GET`/`POST`/`PUT`/`DELETE`.
- Import `prisma` from `@/lib/prisma` (singleton, do not `new PrismaClient()`).
- Session-gated routes: `const session = await getServerSession(authOptions);` then check `session?.user?.id`.
- Rate-limit user-facing endpoints via `checkApiRateLimit(getClientIdentifier(req))` from `@/lib/rate-limit`.
- Validate input with helpers from `@/lib/validation`.
- Webhooks/external callers use their own auth (bearer or HMAC) and skip session; add them to the `isWebhook` allowlist in `src/proxy.ts` if they need to accept cross-origin requests.

**New dashboard section:**
- Add `src/app/[locale]/dashboard/<section>/page.tsx` (server component with `getServerSession`+`redirect("/login")` guard).
- Add nav entry in `src/components/dashboard/DashboardSidebar.tsx` (respecting `isAdmin` gating for admin-only entries).

**New shared UI:**
- Cross-page: `src/components/<Name>.tsx`.
- Dashboard-only: `src/components/dashboard/<Name>.tsx`.
- Marketing-only: `src/components/marketing/<Name>.tsx`.

**New server-side logic (helpers, validators, integrations):**
- Add to `src/lib/<name>.ts`. Group as a set of pure exported functions rather than a class.
- If it talks to an external service, put the SDK/client initialization inside the module and export just the domain functions (see `src/lib/mail.ts` for the pattern).

**New static constants (e.g. product catalog, robot list):**
- `src/config/<name>.ts` — this is where the multi-robot catalog should live in parallel to `pricing.ts`.

**New locale:**
- Add code to `routing.locales` in `src/i18n/routing.ts`.
- Add matching key to the middleware matcher in `src/proxy.ts` (currently hard-codes `(en|hi|bn|ur|ar|de|es)` — must be updated).
- Add `src/messages/<code>.json`.
- Add a `PAGE_COPY[<code>]` block in `src/lib/seo.ts` (currently a hard-coded record, not derived from the locales list).
- If RTL, add the code to the `dir` check in `src/app/[locale]/layout.tsx`.

**New Prisma model or field:**
- Edit `prisma/schema.prisma`.
- Run `npx prisma generate` (also runs on `postinstall` and pre-`build`).
- Because there is no local `prisma/migrations/` directory and the DB is remote (Coolify), migration workflow needs to be decided per change — `prisma db push` for schema sync, or introduce proper migrations.

**Multi-robot support (specific to the pending refactor):**
- Add `src/config/robots.ts` with a `Robot` type and `ROBOTS` catalog.
- Extend `prisma/schema.prisma`:
  - `Subscription`: add `robotId String` (or a `Robot` relation).
  - `Compilation`: inherit `robotId` from its subscription, or duplicate for immutability.
- Update `provisionSubscription` in `src/lib/subscriptions.ts` to accept and persist `robotId`.
- Update the compile pipeline: `api/compiler/poll/route.ts` must expose `robotId` on the job payload; `api/compiler/complete/route.ts` and `api/compiler/download/route.ts` must build filenames from `Robot.filenamePrefix` instead of the hardcoded `AL-ai-FX_GoldBot_...` / `GoldBot_v2.0_...` strings.
- Threading through UI: `CheckoutClient.tsx`, landing pricing cards (`src/lib/pricing-showcase.ts`), `LicenseManager.tsx`, and dashboard overview all currently hardcode the "GoldBot" name.

## Special Directories

**`.planning/`:**
- Purpose: Human/agent planning artifacts (intent notes, codebase maps).
- Generated: Yes, by GSD `/map-codebase` and related commands.
- Committed: Should be committed so the whole team benefits.

**`Auto Run Docs/`:**
- Purpose: Project setup notes (single `Initiation` file, no extension).
- Generated: No.
- Committed: Yes.

**`node_modules/`:**
- Generated by `npm install`.
- Not committed.
- **Note:** `AGENTS.md` instructs agents to consult `node_modules/next/dist/docs/` for Next 16 specifics rather than relying on training data.

**`.next/`:**
- Build output (`next build`) and dev cache (`next dev`).
- Not committed.

**`public/`:**
- Committed. Anything here is served verbatim at the root URL.

---

*Structure analysis: 2026-07-04*
