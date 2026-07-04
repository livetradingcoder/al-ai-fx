# Coding Conventions

**Analysis Date:** 2026-07-04

## Naming Patterns

**Files:**
- React components: `PascalCase.tsx` (e.g., `Navbar.tsx`, `LicenseManager.tsx`, `AuthSessionProvider.tsx`, `DashboardSidebar.tsx`)
- Route handlers (App Router): `route.ts` inside directory-based paths (`src/app/api/**/route.ts`)
- Page files: `page.tsx` inside directory-based paths (`src/app/[locale]/**/page.tsx`)
- Layouts: `layout.tsx`
- Server actions: `actions.ts` (e.g., `src/app/[locale]/dashboard/admin/users/actions.ts`)
- Libraries / plain utilities: `kebab-case.ts` (e.g., `magic-links.ts`, `auth-redirects.ts`, `rate-limit.ts`, `marketing-client.ts`, `pricing-showcase.ts`)
- Client-only variants of a lib module suffix with `-client` (e.g., `marketing.ts` server-safe, `marketing-client.ts` browser-only)
- Test files: co-located `<name>.test.ts` alongside the source (e.g., `src/lib/seo.ts` + `src/lib/seo.test.ts`)
- Type augmentation: `<name>.d.ts` in `src/types/` (e.g., `src/types/next-auth.d.ts`)
- Locale message files: `src/messages/<locale>.json` (locale codes: `en`, `hi`, `bn`, `ur`, `ar`, `de`, `es`)

**Functions:**
- `camelCase` for all exported and internal functions (`buildLoginRedirectPath`, `createMagicLinkToken`, `provisionSubscription`, `computeExpirationDate`).
- Prefix builders with `build*` when they compose strings/URLs/data structures (`buildLoginRedirectPath`, `buildMagicLinkUrl`, `buildLocalizedUrl`, `buildCheckoutThankYouPath`, `buildSubscriptionPlans`).
- Prefix creators with `create*` when they produce a token/object (`createMagicLinkToken`, `createUserMagicLink`).
- Prefix async validators/rate-limit checkers with `check*` (`checkLoginRateLimit`, `checkForgotPasswordRateLimit`, `checkFreeTrialRateLimit`, `checkApiRateLimit`, `checkWebhookRateLimit`).
- Analytics tracking uses `track*` (`trackPageView`, `trackBeginCheckout`, `trackPurchase`, `trackViewContent`).
- Marketing storage helpers: `store*` / `get*` / `clear*Pending*` (`storePendingCheckout`, `getPendingCheckout`, `clearPendingCheckout`).
- Getters use `get*` (`getMarketingConfig`, `getPageMetadata`, `getPublicSitemapEntries`, `getClientIdentifier`).

**Variables:**
- `camelCase` throughout (`normalizedEmail`, `magicLinkUrl`, `walletJson`, `orderRef`, `signaturePayload`).
- Uppercase `SCREAMING_SNAKE_CASE` constants for module-level tunables (`SITE_URL`, `SITE_NAME`, `OG_IMAGE_URL`, `LAST_MODIFIED`, `TESTIMONIALS`, `HERO_PILLS`, `PENDING_CHECKOUT_PREFIX`, `TRACKED_PURCHASE_PREFIX`, `PAYGATE_WALLET_ENDPOINT`).
- Uppercase constants also used for exported config maps (`PRICING_TIERS`, `PAGE_PATHS`, `PAGE_COPY`, `INDEXABLE_PAGES`, `PAGE_CHANGE_FREQUENCY`).
- Prisma enum members are `SCREAMING_SNAKE_CASE` (`FREE_TRIAL`, `ONE_MONTH`, `SIX_MONTHS`, `LIFETIME`, `SECRET_TEST_TIER`).

**Types:**
- `PascalCase` for types and interfaces (`MagicLinkPayload`, `MarketingConfig`, `PendingCheckout`, `PricingTier`, `Locale`, `PublicPageKey`, `LicenseManagerProps`).
- Suffix payload types with `Payload` (`CompilationCompletePayload`, `UpdateMt5Payload`, `MagicLinkPayload`).
- Suffix input types with `Input` (`BuildMagicLinkUrlInput`).
- Suffix generated tier IDs and keys with `Id` (`TierId`).

## Code Style

**Formatting:**
- No Prettier/Biome config file present. Default to Next.js defaults (2-space indent, double quotes for strings in most files, semicolons on).
- Mixed quote usage exists: TS/TSX source predominantly uses double quotes (`"`); a few older files use single quotes (`'`). New code should use double quotes to match the majority.
- Trailing commas are used in multi-line object/array/function-parameter literals in newer code (see `src/lib/subscriptions.ts`, `src/lib/magic-links.ts`).
- Two-space indentation everywhere.

**Linting:**
- ESLint 9 flat config at `eslint.config.mjs`.
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
- Ignores `.next/**`, `out/**`, `build/**`, `next-env.d.ts`.
- Run with `npm run lint` (invokes `eslint`).
- No project-level custom rule overrides; rely on Next.js defaults.

## Import Organization

**Order (observed in most files):**
1. External packages first (`next`, `next-auth`, `next-intl`, `@prisma/client`, `react`, `bcryptjs`, `jsonwebtoken`, `validator`, `framer-motion`, `lucide-react`).
2. Internal imports via the `@/` path alias (`@/lib/*`, `@/components/*`, `@/config/*`, `@/i18n/*`).
3. Relative imports (`./`, `../`) — used sparingly and mostly in i18n/routing files (`./routing`, `../../components/Navbar`).
4. Type-only imports use `import type` (e.g., `import type { NextAuthOptions, Session, User } from "next-auth"`).

**Path Aliases:**
- Configured in `tsconfig.json`: `"@/*": ["./src/*"]`.
- Prefer `@/lib/prisma`, `@/lib/auth`, `@/components/...`, `@/i18n/routing`, `@/config/pricing`. Relative imports (`../../components/Navbar`) still appear in `src/app/[locale]/layout.tsx` — prefer the `@/` alias for new code.

## Error Handling

**Patterns:**
- **API routes** wrap the business logic body in `try/catch`, log via `console.error("[Context] ...", error)`, and return `NextResponse.json({ error: "..." }, { status: N })`. Rate-limit checks live *outside* the try block so a 429 short-circuits before parsing.
- **Validation errors** return the message from the validator directly: `if (!emailValidation.valid) return NextResponse.json({ error: emailValidation.error }, { status: 400 });`
- **Auth failures** return `{ error: "Unauthorized" }` with status `401`; missing resource returns `404`; forbidden signature returns `401` (webhook) or `403` (CSRF).
- **Server actions** (`src/app/[locale]/dashboard/admin/users/actions.ts`) `throw new Error("Unauthorized")` instead of returning JSON — Next.js surfaces the error to the client.
- **NextAuth `authorize` callbacks** return `null` for silent failure but `throw new Error("...")` for user-facing states like blocked/deleted accounts.
- **Fire-and-forget side effects** (e.g., sending emails) are wrapped in their own `try/catch` so the outer flow returns success even when the side effect failed: see `src/app/api/auth/forgot-password/route.ts:57-60` and `src/lib/subscriptions.ts:156-168`.
- **Standard error shape:** `{ error: string }` for failures, `{ success: true, message?: string, ... }` for success. Some routes also include `details` (`src/app/api/compiler/complete/route.ts`) with the underlying error message string.
- **Error narrowing:** `error instanceof Error ? error.message : String(error)` (see `src/app/api/compiler/complete/route.ts:79,94`).

## Logging

**Framework:** `console` only. No structured logger (winston/pino) is used.

**Patterns:**
- Prefix log messages with a bracketed subsystem tag: `[Auth]`, `[Mail]`, `[Free Trial]`, `[Paygate Webhook]`, `[Compiler Complete]`, `[Forgot Password API]`, `[Subscription Service]`, `[CSRF]`, `[Update Password API]`.
- Use `console.log` for info, `console.warn` for missing-configuration warnings, `console.error` for caught exceptions.
- Never log passwords or full JWT payloads. Emails are logged in some contexts (`sendWelcomeEmail`) — acceptable for this codebase.
- Prisma client is configured with `log: ["query"]` in `src/lib/prisma.ts:8` — every query prints in dev *and* prod.

## Comments

**When to Comment:**
- JSDoc-style block comments (`/** ... */`) on exported utilities in `src/lib/validation.ts`, `src/lib/mail.ts`, and `src/lib/rate-limit.ts` explaining requirements and behavior.
- Inline `//` comments used to explain *why* (e.g., CSRF exemptions in `src/proxy.ts:14-19`, "Allow in development, but log warning" in `src/app/api/webhooks/paygate/route.ts:27`).
- Do NOT restate what the code does; comment the intent, constraint, or gotcha.

**JSDoc/TSDoc:**
- Loose usage — some public helpers have `/** ... */` docblocks (validation, mail, rate-limit), most do not. Not enforced.

## Function Design

**Size:**
- Library helpers are small and single-purpose (5-50 lines): see `src/lib/auth-redirects.ts` (6 lines), `src/lib/magic-links.ts` (48 lines).
- Route handlers are longer (50-160 lines) because they inline validation, rate limiting, DB access, and external calls. Extract shared logic to `src/lib/` when repeated.

**Parameters:**
- Prefer named-object destructuring for 3+ parameters (`buildMagicLinkUrl({ baseUrl, callbackUrl, locale, token })`, `renderEmailTemplate({ buttonLabel, buttonUrl, ... })`).
- Positional args only when 1-2 obvious parameters (`buildLoginRedirectPath(locale, callbackUrl)`, `mapTier(tierRaw)`).
- Default values inline on the parameter (`locale = "en"`, `expiresIn = "30m"`, `maxLength: number = 255`, `maxSizeMB: number = 5`).

**Return Values:**
- Validators return `{ valid: boolean; error?: string }` (see `src/lib/validation.ts`).
- Async rate-limit checkers return `{ success: boolean }`.
- Business-logic services return rich result objects: `{ userId, subscriptionId, orderId, duplicated, emailSuccess }` (see `provisionSubscription`).

## Module Design

**Exports:**
- Named exports throughout. `export default` is reserved for React components, Next.js `page`/`layout`/`route` handlers, `sitemap`/`robots`, and `next.config.ts`.
- `route.ts` files export named HTTP handlers (`export async function GET`, `POST`, `PUT`). One handler per method.
- NextAuth catch-all re-exports the handler as both GET and POST: `export { handler as GET, handler as POST }` (`src/app/api/auth/[...nextauth]/route.ts`).

**Barrel Files:**
- Not used. Each module is imported directly by its full path.

## TypeScript Usage

**Strictness:**
- `"strict": true` in `tsconfig.json`.
- Target `ES2017`, `module: "esnext"`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`.

**Type augmentation:**
- `src/types/next-auth.d.ts` augments `next-auth` and `next-auth/jwt` modules so `session.user.id`, `session.user.role`, and `token.role` are typed.

**Payload typing:**
- Route handlers cast `await req.json()` through a local `type XxxPayload = { ... }` (see `src/app/api/compiler/complete/route.ts:8-12`, `src/app/api/licenses/update-mt5/route.ts:7-10`).
- Discriminated on optionality (`?`) with runtime null-checks — Zod is not used.

**`any` usage:**
- Only two locations: `src/app/[locale]/page.tsx` uses `(t: any)` for `next-intl` translator functions inside data-shape builders (see lines 41, 59, 98, 131, 149), and `src/lib/seo.test.ts:47-48` uses `as any` to bypass Next.js Metadata type gymnastics.
- Both are pragmatic escapes — new code should avoid `any` and prefer `TranslatorValues` typing (see the `t` helper in `src/lib/pricing-showcase.test.ts:16-22`) or `Metadata` unions.

**`unknown` and casts:**
- `src/lib/prisma.ts:3` uses `global as unknown as { prisma: PrismaClient }` for the globalThis singleton pattern.
- `src/lib/marketing.ts:36` casts `process.env` through `unknown` before typing.

## Next.js 16 / App Router Conventions

**Notice:** Per `/Users/klev/Code/al-ai-fx/AGENTS.md`, this repo runs Next.js 16.2 with breaking changes vs. training-data-era Next. Read `node_modules/next/dist/docs/` before writing new patterns.

**Observed:**
- `params` is a `Promise` in layouts and pages: `params: Promise<{ locale: string }>` then `const { locale } = await params;` (`src/app/[locale]/layout.tsx:16-40`).
- `generateMetadata` is `async` and awaits `params`.
- App Router route segments are lowercase (`login`, `dashboard`, `magic-login`, `forgot-password`, `checkout`, `tutorials`).
- Dynamic segments use square brackets: `[locale]`, `[...nextauth]`, `[id]`.

## API Route Patterns

**Standard skeleton (POST endpoint with mutation):**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";

export async function POST(req: Request) {
  // 1. Rate limit (before body parse)
  const identifier = getClientIdentifier(req);
  const { success } = await checkApiRateLimit(identifier);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    // 2. Parse + validate
    const { email } = await req.json();
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    // 3. Auth (if required — session or bearer token)
    // 4. Business logic (prisma, external calls, side effects)
    // 5. Return standard shape
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error("[Context] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Auth patterns:**
- Session-based (browser-originated): `const session = await getServerSession(authOptions); if (!session?.user?.id) return 401`.
- Bearer-token (internal service, e.g., compiler worker): `req.headers.get('authorization') !== \`Bearer ${process.env.COMPILER_SECRET}\``.
- HMAC signature (webhook): `verifyWebhookSignature(payload, req.headers.get('x-paygate-signature'))` in `src/app/api/webhooks/paygate/route.ts:20-34`.

**Rate limit tiers (see `src/lib/rate-limit.ts`):**
- Login: 5 / 15 min
- Forgot password: 3 / hour
- Free trial: 2 / 24 hours
- Generic API: 100 / minute
- Webhook: 1000 / minute

**Validation:** Use helpers from `src/lib/validation.ts` (`validateEmail`, `validatePassword`, `validateMT5Account`, `validateAmount`, `validateFileSize`, `sanitizeString`). Do not roll ad-hoc validators.

**Emails always lowercase-trimmed:** `email.trim().toLowerCase()` before DB lookup (see `src/lib/auth.ts:22`, `src/app/api/auth/forgot-password/route.ts:29`, `src/app/api/webhooks/paygate/route.ts:48`).

## Prisma Usage

**Client singleton:**
- Import from `@/lib/prisma` (never construct `new PrismaClient()` directly). Two legacy routes still instantiate their own client — `src/app/api/compiler/complete/route.ts:6` and `src/app/api/compiler/poll/route.ts:4` — new code should use the shared instance.
- The singleton lives on `globalThis` in dev to survive HMR (`src/lib/prisma.ts:3-11`).
- Query logging is enabled globally (`log: ["query"]`). Suppress with `log: []` if noise becomes a problem.

**Query patterns:**
- `findUnique({ where: { id | email | paygateId } })` for single-record lookups by unique column.
- `findFirst({ where: { ... }, orderBy: { createdAt: 'asc' } })` for oldest-pending queue polls (`src/app/api/compiler/poll/route.ts:13`).
- `include: { subscription: true }` and nested `include: { compilations: { orderBy, take } }` for relations (see `src/app/[locale]/dashboard/page.tsx:16-31`).
- After update, `revalidatePath("/path")` in server actions to invalidate the RSC cache (`src/app/[locale]/dashboard/admin/users/actions.ts:24`).

**Ownership checks:**
- Every non-admin mutation verifies `record.userId === session.user.id` before proceeding (see `src/app/api/licenses/update-mt5/route.ts:36`, `src/app/api/licenses/status/route.ts:25`, `src/app/api/compiler/download/route.ts:24`).

**Soft deletes:**
- `User.isDeleted` and `User.isBlocked` are boolean flags. Always filter `!user.isDeleted && !user.isBlocked` in auth and password-reset flows (see `src/lib/auth.ts:35-43`, `src/app/api/auth/forgot-password/route.ts:32`).

## NextAuth Conventions

**Config location:** `src/lib/auth.ts` exports `authOptions: NextAuthOptions`. The catch-all handler at `src/app/api/auth/[...nextauth]/route.ts` wires `NextAuth(authOptions)` to GET+POST.

**Providers:**
- `CredentialsProvider` with email+password (bcrypt hash comparison against `user.passwordHash`).
- `CredentialsProvider` with `id: "magic-link"` accepting a JWT `token` from `src/lib/magic-links.ts`.

**Session strategy:** `jwt`, `maxAge: 30 * 24 * 60 * 60` (30 days), `updateAge: 24 * 60 * 60` (24 hours).

**Callbacks:**
- `jwt({ token, user })` copies `user.role` and `user.id` onto the JWT.
- `session({ session, token })` copies them onto `session.user`.
- Both are typed via `src/types/next-auth.d.ts`.

**Client usage:**
- Wrap the tree with `<SessionProvider>` via `src/components/AuthSessionProvider.tsx` — mounted once in `src/app/[locale]/layout.tsx`.
- Read via `useSession()` (`Navbar.tsx:13`, `DashboardSidebar.tsx:24`).
- Sign in via `signIn("credentials", { email, password, callbackUrl })` or `signIn("magic-link", { token, callbackUrl })`.
- Sign out via `signOut({ callbackUrl: "/login" })`.

**Middleware:** `src/proxy.ts` composes `withAuth` + `next-intl` middleware + a custom CSRF Origin check. Admin routes require `token?.role === "ADMIN"`; dashboard routes require any authenticated token.

## i18n Conventions (next-intl)

**Locales:** `en` (default, unprefixed), `hi`, `bn`, `ur`, `ar`, `de`, `es` — declared in `src/i18n/routing.ts`.

**Locale-aware navigation:**
- Import `Link`, `redirect`, `useRouter`, `usePathname`, `getPathname` from `@/i18n/routing` — never from `next/link` or `next/navigation` when the URL should respect locale prefixing.
- Server-side URL building: `buildLocalizedPath(locale, "/faq")` from `@/lib/seo` — returns `/faq` for `en`, `/de/faq` for `de`.
- Full URL: `buildLocalizedUrl(locale, "/faq")` returns `https://www.al-ai-fx.xyz/de/faq`.

**Translation access:**
- Server components: `const t = await getTranslations("Dashboard")` from `next-intl/server`.
- Client components: `const t = useTranslations("Dashboard")` from `next-intl`.
- Namespaces are top-level keys in `src/messages/<locale>.json` (`Navbar`, `Landing`, `Auth`, `Dashboard`, `Checkout`, `Footer`, ...).

**Rich text / interpolation:**
- `t("key", { fallback: "..." })` — the `fallback` value is a stylistic convention, not a next-intl feature (see `pricing-showcase.test.ts:20-22`).
- `t.rich("key", { tagName: (chunks) => <Tag>{chunks}</Tag> })` for embedded components (see `LicenseManager.tsx:168`).

**Adding a translation key:**
- Add to all 7 locale files or the `landing-localization.test.ts` will fail.
- For non-Landing namespaces, the test does not enforce parity — but do it anyway.

**RTL:** `dir="rtl"` for `ar` and `ur`, set in `src/app/[locale]/layout.tsx:46`.

## Client vs. Server Components

**Server (default):**
- `page.tsx`, `layout.tsx`, `route.ts`, `actions.ts` (with `"use server"`).
- Direct Prisma access, `getServerSession`, `getTranslations`.

**Client (`"use client"` directive at top):**
- Any file using hooks (`useState`, `useEffect`, `useSession`, `useTranslations`, `useRouter`, `useSearchParams`).
- Interactive components: `Navbar`, `LanguageSwitcher`, `LicenseManager`, `DashboardSidebar`, login/checkout/magic-login pages.
- Analytics client (`src/lib/marketing-client.ts`) — never import into server code.

**Server actions:** File starts with `"use server"`. Called directly from client components as async functions (see `src/app/[locale]/dashboard/admin/users/actions.ts`).

---

*Convention analysis: 2026-07-04*
