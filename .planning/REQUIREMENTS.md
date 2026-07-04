# Requirements: AL-ai-FX

**Defined:** 2026-07-04
**Core Value:** A paying user receives their chosen, compiled, MT5-account-locked robot within minutes of checkout — automatically, every time.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Compile Server Reliability

- [ ] **CMPL-01**: Windows compile VPS is online and reachable — health-checked from the Next.js side (health endpoint or heartbeat table row)
- [ ] **CMPL-02**: Admin sees compile-server status in dashboard (green / red / stale) and is alerted by email when server goes offline
- [ ] **CMPL-03**: Stuck-job reaper: any `Compilation` in `PROCESSING` past N minutes is auto-transitioned to `PENDING` (retry) or `FAILED` (after M retries)
- [ ] **CMPL-04**: Bounded automatic retry on compile failure (N attempts) before marking `FAILED`
- [ ] **CMPL-05**: `PrismaClient` singleton used in `/api/compiler/poll` and `/api/compiler/complete` (fix connection leak in `src/app/api/compiler/*/route.ts`)
- [ ] **CMPL-06**: Base64 payload path replaced or chunked so that `/api/compiler/complete` no longer risks hitting Vercel's 4.5 MB body limit (options: direct-to-Blob upload URL + notify, or size cap)

### Delivery

- [ ] **DLVR-01**: On successful compile, user receives an email (Mailtrap) with a signed, expiring link to download their `.ex5`
- [ ] **DLVR-02**: On successful compile, user's dashboard shows a "Download" button + status update (both channels)
- [ ] **DLVR-03**: On terminal compile failure, user receives an email explaining status + support link, and dashboard shows failure state
- [ ] **DLVR-04**: Admin receives an alert email (or dashboard flag) when a compile job fails after all retries, or when the server has been offline past a threshold

### Robot Catalog

- [ ] **CTLG-01**: `Robot` (Product) entity exists in Prisma schema: id, slug, name, short/long description, active flag, artwork URL, sort order, created/updated timestamps
- [ ] **CTLG-02**: Public catalog page lists all active robots with artwork, description, and CTA to pick / buy
- [ ] **CTLG-03**: Checkout flow accepts a `robotSlug`/`robotId` — user picks robot then tier before paying
- [ ] **CTLG-04**: `Subscription` and `Compilation` models carry a `robotId` foreign key (schema migration)
- [ ] **CTLG-05**: Existing GoldBot data path removed or migrated to new `Robot` row (test data may be wiped per project decision)
- [ ] **CTLG-06**: `/api/compiler/poll` returns robot slug + source-version so the Windows server picks the correct MQL5 source template
- [ ] **CTLG-07**: `/api/compiler/complete` writes compiled binary with a robot-scoped filename and consistent naming used by `/api/compiler/download`
- [ ] **CTLG-08**: `/api/compiler/download` fetches by robot + jobId consistent with the `complete` route (fix current filename mismatch)

### Source Management

- [ ] **SRCE-01**: MQL5 source files stored encrypted in Vercel Blob under a `sources/` prefix, versioned (`sources/<robotSlug>/v<N>.mq5.enc`)
- [ ] **SRCE-02**: Windows compile server fetches source at job time via a short-lived signed URL from the Next.js API (source not shipped in poll payload)
- [ ] **SRCE-03**: Sources are never returned to end users, never logged in plaintext, never rendered in any admin UI

### Admin Catalog Management

- [ ] **ADMN-01**: Admin dashboard: list all robots with active/inactive toggle
- [ ] **ADMN-02**: Admin dashboard: add a new robot — metadata form (name, slug, description, artwork, sort) + trigger source-upload flow
- [ ] **ADMN-03**: Admin dashboard: edit an existing robot's metadata and pricing tiers
- [ ] **ADMN-04**: Admin dashboard: upload a new source version for a robot (encrypted to Blob, version bumped)
- [ ] **ADMN-05**: Admin actions authorized by role check (`UserRole.ADMIN`)

### Pricing

- [ ] **PRIC-01**: Per-robot pricing rows — each robot has its own tiers (free trial / 1 month / 6 months / lifetime) and prices
- [ ] **PRIC-02**: `PricingTier` enum, `config/pricing.ts`, and `mapTier()` fully aligned — no silent downgrade of unknown tiers (fix `src/config/pricing.ts` ↔ `PricingTier` enum drift)
- [ ] **PRIC-03**: Checkout displays per-robot tier options with correct prices; refuses unknown tiers instead of coercing
- [ ] **PRIC-04**: Admin can edit per-robot tier prices without a deploy

### Free Trial

- [ ] **TRIL-01**: Each user may claim at most one free trial per robot (one trial × N robots, not one global trial)
- [ ] **TRIL-02**: Free trial claim enforced server-side (unique constraint or check) — cannot be bypassed by client
- [ ] **TRIL-03**: Free trial subscription lifecycle matches paid: MT5 binding, compile job, delivery, expiry

### Security Hardening (Payment Webhook)

- [ ] **SECR-01**: Paygate webhook signature verification is fail-**closed** when `PAYGATE_WEBHOOK_SECRET` is missing (rejects request; does not fall through)
- [ ] **SECR-02**: Paygate webhook rejects replayed payloads (timestamp window + nonce, or upstream idempotency ID stored + checked in DB)
- [ ] **SECR-03**: Paygate webhook is idempotent — repeated legitimate deliveries do not double-fulfill an order

### New Robot Onboarding

- [ ] **ONBD-01**: Onboard robot #2 into catalog: metadata row, encrypted source uploaded, tier pricing set, visible on catalog page, buyable
- [ ] **ONBD-02**: Onboard robot #3 into catalog (same criteria)
- [ ] **ONBD-03**: Onboard robot #4 into catalog (same criteria)
- [ ] **ONBD-04**: End-to-end test with a real MT5 account: purchase → compile → deliver → user runs `.ex5` in MetaTrader — for each newly onboarded robot

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Bundle

- **BUND-01**: All-access bundle subscription — one purchase covers every active robot
- **BUND-02**: Bundle pricing tiers + entitlement checks against per-robot compile flow

### Platform Expansion

- **PLAT-01**: MT4 (MQL4) source support (separate compiler toolchain)
- **PLAT-02**: cTrader / other platform support

### UX Depth

- **UXPL-01**: Per-robot marketing landing pages with dedicated SEO
- **UXPL-02**: Real-time delivery notifications (WebSocket / push) instead of polling
- **UXPL-03**: Bundle discount codes, coupons, promo flows

### Hardening (Deferred)

- **HARD-01**: Serverless-correct rate limiter (KV / Redis-backed instead of in-memory)
- **HARD-02**: NextAuth session re-check against DB on block/delete (currently up to 24h stale)
- **HARD-03**: CSP tightening (remove `'unsafe-inline'` / `'unsafe-eval'`)
- **HARD-04**: Human i18n review of machine-translated dictionaries
- **HARD-05**: Prisma production log level review (currently `log: ["query"]` — PII risk)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| All-access bundle in v1 | Adds cross-robot entitlement complexity; per-robot pricing ships first |
| MT4 / cTrader / non-MT5 platforms | User confirmed MQL5 / MT5 only for this milestone |
| Third-party robot marketplace | First-party catalog only; multi-seller is a different product |
| Real-time delivery push | Email + dashboard polling sufficient for v1 |
| Test-user data migration | User confirmed test users may be wiped on schema change |
| In-browser MQL5 editor | Sources are proprietary; no in-app editing |
| Deferred hardening items above | Important, but not launch blockers for this milestone |

## Traceability

Populated by roadmapper on 2026-07-04.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CMPL-01 | Phase 1 | Pending |
| CMPL-02 | Phase 1 | Pending |
| CMPL-03 | Phase 1 | Pending |
| CMPL-04 | Phase 1 | Pending |
| CMPL-05 | Phase 1 | Pending |
| CMPL-06 | Phase 1 | Pending |
| DLVR-01 | Phase 5 | Pending |
| DLVR-02 | Phase 5 | Pending |
| DLVR-03 | Phase 5 | Pending |
| DLVR-04 | Phase 5 | Pending |
| CTLG-01 | Phase 3 | Pending |
| CTLG-02 | Phase 6 | Pending |
| CTLG-03 | Phase 6 | Pending |
| CTLG-04 | Phase 3 | Pending |
| CTLG-05 | Phase 3 | Pending |
| CTLG-06 | Phase 4 | Pending |
| CTLG-07 | Phase 4 | Pending |
| CTLG-08 | Phase 4 | Pending |
| SRCE-01 | Phase 3 | Pending |
| SRCE-02 | Phase 4 | Pending |
| SRCE-03 | Phase 4 | Pending |
| ADMN-01 | Phase 5 | Pending |
| ADMN-02 | Phase 5 | Pending |
| ADMN-03 | Phase 5 | Pending |
| ADMN-04 | Phase 5 | Pending |
| ADMN-05 | Phase 5 | Pending |
| PRIC-01 | Phase 6 | Pending |
| PRIC-02 | Phase 2 | Pending |
| PRIC-03 | Phase 6 | Pending |
| PRIC-04 | Phase 6 | Pending |
| TRIL-01 | Phase 6 | Pending |
| TRIL-02 | Phase 6 | Pending |
| TRIL-03 | Phase 6 | Pending |
| SECR-01 | Phase 2 | Pending |
| SECR-02 | Phase 2 | Pending |
| SECR-03 | Phase 2 | Pending |
| ONBD-01 | Phase 7 | Pending |
| ONBD-02 | Phase 7 | Pending |
| ONBD-03 | Phase 7 | Pending |
| ONBD-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40 (100%)
- Unmapped: 0

**Per-phase counts:**
- Phase 1 (Restore Compile Delivery): 6 requirements (CMPL-01 through CMPL-06)
- Phase 2 (Payment + Pricing Launch Blockers): 4 requirements (PRIC-02, SECR-01, SECR-02, SECR-03)
- Phase 3 (Multi-Robot Schema Foundation): 4 requirements (CTLG-01, CTLG-04, CTLG-05, SRCE-01)
- Phase 4 (Robot-Aware Compile Pipeline): 5 requirements (CTLG-06, CTLG-07, CTLG-08, SRCE-02, SRCE-03)
- Phase 5 (Admin Catalog + Delivery Loop): 9 requirements (ADMN-01 through ADMN-05, DLVR-01 through DLVR-04)
- Phase 6 (Public Catalog, Per-Robot Pricing, Free Trials): 8 requirements (CTLG-02, CTLG-03, PRIC-01, PRIC-03, PRIC-04, TRIL-01, TRIL-02, TRIL-03)
- Phase 7 (Onboard 3 New Robots + End-to-End Validation): 4 requirements (ONBD-01, ONBD-02, ONBD-03, ONBD-04)

---
*Requirements defined: 2026-07-04*
*Traceability populated: 2026-07-04 by roadmapper*
