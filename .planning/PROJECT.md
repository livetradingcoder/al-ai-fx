# AL-ai-FX

## What This Is

Web platform that sells subscription licenses for MT5 (MetaTrader 5) Expert Advisor trading robots. Users pick a robot on the site, pay via Paygate, and receive a compiled `.ex5` binary locked to their own MT5 account number. Today the platform ships a single robot (GoldBot); this milestone opens it up to a multi-robot catalog with 3+ new MQL5 robots and fixes the currently-offline Windows compile server that delivers the binaries.

## Core Value

**A paying user receives their chosen, compiled, MT5-account-locked robot within minutes of checkout — automatically, every time.**

If that flow breaks, no other feature matters. Server uptime, correct robot selection, correct MT5 binding, and reliable delivery are the ONE thing.

## Requirements

### Validated

Inferred from existing codebase map (`.planning/codebase/*`). These already work in production:

- ✓ Email + password signup, magic-link login, forgot/reset password (NextAuth v4) — existing
- ✓ Multi-locale marketing site: en / es / de / ar / hi / bn / ur (next-intl) — existing
- ✓ Paygate checkout flow: create session → redirect → webhook → order fulfilled — existing (webhook has known gaps, see Active)
- ✓ Free trial + paid tier subscription lifecycle (Prisma `Subscription` model) — existing
- ✓ MT5 account number capture + validation (5–12 digits) — existing
- ✓ External Windows compile server integration via `/api/compiler/poll` + `/api/compiler/complete` (bearer `COMPILER_SECRET`) — existing (currently offline)
- ✓ Compiled binary storage in Vercel Blob (`compiled/` prefix, private access) — existing
- ✓ Dashboard: license list, MT5 account update, billing view, admin promote/list — existing
- ✓ Tutorials, FAQ, disclaimer, privacy, refund, T&C pages — existing
- ✓ Transactional email via Mailtrap — existing

### Active

Milestone scope. Each is a hypothesis until shipped and validated.

**Reliability of compile pipeline (blocker — server offline today)**

- [ ] Windows compile VPS brought back online, health-checked from Next.js side
- [ ] Stuck-job reaper: `PROCESSING` compilations past N minutes auto-retry or `FAILED`
- [ ] Automatic retry on compile failure (bounded N attempts)
- [ ] Admin alert (email + dashboard flag) when server offline or job stuck

**Delivery**

- [ ] Auto-email download link to user on successful compile (Mailtrap)
- [ ] Dashboard notification + download button on successful compile
- [ ] Both channels together (email + dashboard) — no single point of failure

**Multi-robot catalog**

- [ ] `Product` (Robot) entity in Prisma schema (id, slug, name, description, active, artwork, marketing copy)
- [ ] Robot selector on public catalog page + checkout flow (single catalog UX, not per-robot landing pages in v1)
- [ ] Per-robot MQL5 source stored encrypted in Vercel Blob, versioned
- [ ] Compile pipeline updated: `Compilation.productId`, `/api/compiler/poll` returns robot slug/version to Windows server, `/api/compiler/complete` uses robot-scoped filename
- [ ] Admin dashboard UI: add / edit / activate / deactivate robots, upload new source version (metadata + source-upload flow)

**Multi-robot pricing + trials**

- [ ] Per-robot pricing tiers (free trial / 1mo / 6mo / lifetime) — each robot has its own price
- [ ] One free trial **per robot per user** (not one global trial)
- [ ] Fix pricing tier drift: `PricingTier` enum + `config/pricing.ts` + `mapTier()` fully aligned; no silent downgrade of `1-year` / `lifetime-source` to `ONE_MONTH`
- [ ] MT5 account binding stays per-subscription (each robot license locked to one MT5 account) — unchanged from today

**New robots**

- [ ] Onboard 3+ new MQL5 robots into catalog with marketing copy, pricing, source in Blob, admin-visible

**Security hardening (in-scope this milestone)**

- [ ] Paygate webhook: fail-**closed** if `PAYGATE_WEBHOOK_SECRET` missing (not fail-open)
- [ ] Paygate webhook: reject replayed payloads (timestamp + nonce or Paygate-side idempotency check)

### Out of Scope

Explicitly deferred. Do not add without a scope review.

- **All-access bundle subscription** — recommended for v2; keep pricing per-robot in v1 to keep checkout simple. Bundle math + entitlement flows are a milestone of their own.
- **MT4 (MQL4) or cTrader support** — MQL5/MT5 only. New platforms would fork the compile pipeline.
- **In-browser MQL5 editor / robot marketplace for third-party sellers** — this is a first-party catalog only.
- **Migration of existing test-user data** — user confirmed test users can be wiped on schema changes; no data migration burden.
- **Realtime web-socket delivery** — email + dashboard polling is sufficient for v1.
- **Reworking rate limiter for serverless correctness** — CONCERNS.md flagged in-memory limiter is per-instance; important but out of this milestone.
- **NextAuth session re-check on block/delete** — CONCERNS.md flagged 24h stale session risk; important but out of this milestone.
- **CSP hardening (`'unsafe-inline'` / `'unsafe-eval'`)** — flagged, deferred.
- **i18n re-translation review** — machine-translated dictionaries flagged, deferred.

## Context

- **Codebase state (map committed at `62a798d`, see `.planning/codebase/`):** Next.js 16.2 App Router with `[locale]` segment, React 19.2, TypeScript, Prisma 6 + Postgres, NextAuth v4, Vercel Blob, Mailtrap, next-intl (7 locales), TailwindCSS 4, framer-motion, Paygate payments. External Windows VPS with MetaEditor CLI (`metaeditor64.exe /compile`) polls the Next.js API and posts back compiled `.ex5` binaries.
- **Known concerns already surfaced by mapper** (see `.planning/codebase/CONCERNS.md`, in priority order for this milestone):
  1. Compile pipeline: hardcoded `AL-ai-FX_GoldBot_*.ex5` filename in `src/app/api/compiler/complete/route.ts:56`, filename mismatch with `src/app/api/compiler/download/route.ts:47`, no `Product` entity — blocks multi-robot.
  2. Poll endpoint omits robot identity — Windows server can't know what to compile in multi-robot world.
  3. Pricing tier drift: `src/config/pricing.ts` has 8 tiers, `PricingTier` enum has 5, `mapTier()` silently coerces missing tiers to `ONE_MONTH` — active revenue leakage.
  4. Paygate webhook fail-open when secret missing (`src/app/api/webhooks/paygate/route.ts:20-34`), no timestamp/nonce, replayable.
  5. No reaper for stuck `PROCESSING` jobs; compounds with offline Windows server.
  6. `new PrismaClient()` in compile routes bypasses shared singleton in `src/lib/prisma.ts` — serverless connection leak risk.
  7. `/api/compiler/complete` accepts base64 payloads up to 10 MB; Vercel body limit is ~4.5 MB — hits limit before code runs.
- **Users today:** test users only, no real revenue. User approved wiping test data if schema changes require it. Milestone is effectively pre-launch hardening.
- **User goal:** ship this fast — server offline = launch blocked and revenue-at-risk once real users arrive.

## Constraints

- **Tech stack**: Next.js 16.2 (breaking changes vs older Next; see `AGENTS.md`), React 19.2, Prisma + Postgres, NextAuth v4, TypeScript strict. Don't rewrite framework choices.
- **Compile target**: MQL5 / MT5 only. MetaEditor CLI on Windows VPS is the only compiler.
- **Source secrecy**: MQL5 sources are proprietary IP. Must stay encrypted in Blob, never returned to user, never logged in plaintext.
- **Timeline**: ASAP — offline compile server is a launch blocker.
- **No data migration required**: test users may be reset; free to change schema without migration scripts (but seed script must recreate a clean admin).
- **Serverless deployment**: All API routes run on Vercel — 4.5 MB body limit, ephemeral instances, no in-memory state that must persist.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Per-robot pricing tiers (not all-access bundle in v1) | Simpler checkout + billing; bundle math and cross-robot entitlement is a separate design problem | — Pending |
| One free trial per robot per user (not global) | Higher acquisition per robot; user explicitly chose this | — Pending |
| Single catalog + selector UX (not per-robot landing pages) | Faster to ship, cleaner navigation; per-robot marketing pages can come later | — Pending |
| MT5 account binding stays per-subscription (not per-user) | Preserves existing security model; each license locked to one MT5 account | — Pending |
| MQL5 sources stored encrypted in Vercel Blob (canonical) | Central, versioned, deployable; Windows VPS pulls on demand instead of holding master copy | — Pending |
| Admin adds robots via dashboard (metadata + source upload flow) | No dev-required workflow; content team can ship a new robot without a deploy | — Pending |
| Wipe test users if schema requires (no migration scripts) | User confirmed no revenue at risk; saves engineering time | — Pending |
| Fix pricing tier drift + harden Paygate webhook in this milestone | Both are launch blockers for real revenue; in-scope now, not deferred | — Pending |
| Windows compile server stays on user's own Windows VPS | User's choice; existing MetaEditor CLI setup preserved | — Pending |

---
*Last updated: 2026-07-04 after initialization*
