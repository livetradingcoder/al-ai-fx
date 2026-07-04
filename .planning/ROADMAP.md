# Roadmap: AL-ai-FX

## Overview

This milestone takes AL-ai-FX from a single-robot GoldBot pipeline with an offline compile server to a multi-robot catalog that reliably delivers three new MQL5 robots on top of the existing one. Phases are ordered around three hard blockers: the Windows compile server is offline (nothing ships until it returns and reaps stuck jobs), the Prisma schema is hardcoded to a single product (must change before any multi-robot UX), and two silent launch-blockers (pricing tier drift + fail-open webhook) leak revenue and access. We unblock delivery first with the existing single robot, harden the payment/pricing gate, land the schema foundation, thread robot identity through the compile pipeline, expose admin + delivery UX, ship public catalog + per-robot pricing/trials, then onboard the three new robots with end-to-end validation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Restore Compile Delivery** - Bring the Windows compile server back online, kill stuck-job orphans, and make the pipeline retry-safe on the existing single robot
- [ ] **Phase 2: Payment + Pricing Launch Blockers** - Fix silent tier downgrade and fail-open Paygate webhook before real revenue arrives
- [ ] **Phase 3: Multi-Robot Schema Foundation** - Land the `Robot` entity, wire `robotId` through subscriptions/compilations, move sources to encrypted Blob storage
- [ ] **Phase 4: Robot-Aware Compile Pipeline** - Thread robot identity through poll/complete/download; source fetched by short-lived signed URL, never logged
- [ ] **Phase 5: Admin Catalog + Delivery Loop** - Admin can add/edit/upload robots without a deploy; users get email + dashboard delivery + failure notices
- [ ] **Phase 6: Public Catalog, Per-Robot Pricing, Free Trials** - Customer-facing catalog + checkout + per-robot tiers + one-trial-per-robot enforcement
- [ ] **Phase 7: Onboard 3 New Robots + End-to-End Validation** - Ship robots #2/#3/#4 as real catalog entries and validate purchase → compile → MetaTrader for each

## Phase Details

### Phase 1: Restore Compile Delivery
**Goal**: The existing GoldBot compile flow is reliable end-to-end again — server online, no orphaned `PROCESSING` rows, bounded retry, admin has visibility.
**Depends on**: Nothing (first phase — unblocks all delivery)
**Requirements**: CMPL-01, CMPL-02, CMPL-03, CMPL-04, CMPL-05, CMPL-06
**Success Criteria** (what must be TRUE):
  1. A user who binds an MT5 account on the existing GoldBot receives a `COMPLETED` compilation within minutes and a downloadable `.ex5` — no manual DB intervention.
  2. Admin dashboard shows the compile server's status (green / red / stale) and admin receives an email alert when the server goes offline or a job stays stuck past threshold.
  3. Any `Compilation` stuck in `PROCESSING` past the reaper threshold auto-transitions to retry (bounded N attempts) or `FAILED` — no infinite polling from the client.
  4. `/api/compiler/poll` and `/api/compiler/complete` use the shared Prisma singleton and no longer risk exhausting Postgres connections under load.
  5. Compiled `.ex5` payloads no longer fail at Vercel's 4.5 MB body limit — either delivered via a direct-to-Blob upload URL or explicitly size-capped.
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Schema + shared config (WorkerHeartbeat model, Compilation.attemptCount/attemptedAt/sha256/sizeBytes/errorMessage, src/lib/compiler-config.ts, `prisma db push` to remote Coolify Postgres) [Wave 1]
- [ ] 01-02-PLAN.md — Direct-to-Blob worker + secret rotation (rewrite VM daemon.js for `@vercel/blob` `put()`, drop hardcoded fallback secret, MetaEditor triple-check, cleanup; refactor `/api/compiler/complete` to metadata-only; unify filename via new `src/lib/compiler-filename.ts`; rotate COMPILER_SECRET) [Wave 2]
- [ ] 01-03-PLAN.md — Heartbeat + atomic dequeue + reaper (patch `/poll` for WorkerHeartbeat upsert + `FOR UPDATE SKIP LOCKED` via `$queryRaw`; new `/api/compiler/reap` CRON_SECRET-gated; second NSSM service `al-ai-fx-reaper` on VM pings every 60s — Hobby-plan-safe external cron) [Wave 2, parallel with 01-02]
- [ ] 01-04-PLAN.md — Admin visibility + client-poll cap + alert email (new `/api/admin/compiler-status` + `<CompileServerStatus>` tile on admin dashboard; `sendAdminCompilerAlertEmail` + reaper integration w/ dedup cooldown; cap LicenseManager polling at 5 min w/ exponential backoff + TIMED_OUT UI state) [Wave 3]

Note: CMPL-05 (Prisma singleton in compiler routes) was closed pre-planning by commit `1073e45 fix(compiler): use shared Prisma singleton in poll + complete routes` — no dedicated plan needed. Poll route gets further changes in Plan 03; complete route gets further changes in Plan 02, both continuing to use the singleton.

### Phase 2: Payment + Pricing Launch Blockers
**Goal**: No real customer can pay for `1-year` / `lifetime-source` and get silently downgraded, and no anonymous POST can provision a subscription via a misconfigured webhook.
**Depends on**: Phase 1 (delivery must work before we take real money)
**Requirements**: PRIC-02, SECR-01, SECR-02, SECR-03
**Success Criteria** (what must be TRUE):
  1. Every tier advertised in `src/config/pricing.ts` maps to a real `PricingTier` enum value with a correct expiry — no `default` fallthrough. An unknown tier is refused, not coerced.
  2. Paygate webhook rejects (HTTP error, no provisioning) when `PAYGATE_WEBHOOK_SECRET` is missing in production — fail-closed, not fail-open with a warning log.
  3. A replayed Paygate webhook payload (same signature, past its timestamp window or with a previously-seen nonce/paygateId) is rejected without double-fulfilling an order.
  4. Repeating a legitimate webhook delivery for the same order is idempotent — one `Order`, one `Subscription`, one confirmation email.
**Plans**: TBD (est. 3)

Plans:
- [ ] 02-01: Align `PricingTier` enum ↔ `config/pricing.ts` ↔ `mapTier()` (extend enum, extend `computeExpirationDate`, throw on unknown)
- [ ] 02-02: Fail-closed webhook secret verification (production-strict + explicit dev bypass)
- [ ] 02-03: Replay protection + idempotency (timestamp window, nonce / `paygateId` uniqueness check, POST + GET paths)

### Phase 3: Multi-Robot Schema Foundation
**Goal**: The database and source-storage layer support multiple robots. No user-facing UX yet — the ground the rest of the milestone builds on.
**Depends on**: Phase 1 (single-robot flow must be stable before we thread a new dimension through it)
**Requirements**: CTLG-01, CTLG-04, CTLG-05, SRCE-01
**Success Criteria** (what must be TRUE):
  1. A `Robot` (Product) row exists in Postgres with id, slug, name, short/long description, active flag, artwork URL, sort order, and timestamps — introspectable by admin and referenceable by other models.
  2. `Subscription.robotId` and `Compilation.robotId` are non-null foreign keys — every new subscription and compile job is scoped to exactly one robot.
  3. The existing GoldBot data path is either migrated to a real `Robot` row or the test data is wiped and a seed script recreates GoldBot cleanly as the first catalog entry (per project decision — no test-user preservation).
  4. MQL5 source files live encrypted in Vercel Blob at `sources/<robotSlug>/v<N>.mq5.enc` — versioned, not stored in the repo, not in Postgres.
**Plans**: TBD (est. 3)

Plans:
- [ ] 03-01: `Robot` model + Prisma migration + seed script (checked-in migration; GoldBot seed row)
- [ ] 03-02: Wire `robotId` into `Subscription` + `Compilation` (schema + `provisionSubscription` + `update-mt5`)
- [ ] 03-03: Encrypted source-storage layer in Blob (upload helper, versioning convention, key management)

### Phase 4: Robot-Aware Compile Pipeline
**Goal**: The Windows worker knows which robot to compile, fetches the right source, and the download route returns a robot-scoped filename that matches what was written.
**Depends on**: Phase 3 (needs `robotId` on `Compilation` and sources in Blob)
**Requirements**: CTLG-06, CTLG-07, CTLG-08, SRCE-02, SRCE-03
**Success Criteria** (what must be TRUE):
  1. `/api/compiler/poll` returns robot slug + source-version on each job so the Windows worker picks the correct MQL5 template — no more "GoldBot by convention".
  2. The Windows worker fetches source at job time via a short-lived signed URL from a new Next.js endpoint — source is never embedded in the poll response.
  3. `/api/compiler/complete` writes the compiled binary to a robot-scoped Blob path (using `Robot.slug` / filename template), and `/api/compiler/download` streams it back to the user under the same naming — no more `AL-ai-FX_GoldBot_...` vs `GoldBot_v2.0_...` mismatch.
  4. MQL5 source content is never returned to end users, never written to application logs in plaintext, and never rendered in any admin UI — verifiable by inspection of logs + response bodies.
**Plans**: TBD (est. 4)

Plans:
- [ ] 04-01: Extend `/api/compiler/poll` response with `robotSlug`, `sourceVersion`, signed source URL (version the endpoint if the Windows worker parser is strict)
- [ ] 04-02: Source signed-URL endpoint (`POST /api/compiler/source-url` or embedded in poll response) with short TTL + audit log
- [ ] 04-03: Robot-scoped filename generator + `/api/compiler/complete` write path + `/api/compiler/download` consumer aligned via a single helper
- [ ] 04-04: Source-secrecy audit (log scrubbing, admin UI never renders source, download-route negative test)

### Phase 5: Admin Catalog + Delivery Loop
**Goal**: An admin can onboard a robot without a deploy, and a paying user gets notified through two independent channels (email + dashboard) whether the compile succeeds or fails.
**Depends on**: Phase 4 (needs robot-aware pipeline so admin-added robots actually compile; needs `Robot` model from Phase 3)
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05, DLVR-01, DLVR-02, DLVR-03, DLVR-04
**Success Criteria** (what must be TRUE):
  1. An admin can list all robots, toggle active/inactive, and edit metadata + pricing tiers from `/dashboard/admin` — no deploy or DB console required.
  2. An admin can add a new robot (metadata form) and upload a new encrypted source version — both actions gated behind `UserRole.ADMIN`, non-admin sessions rejected.
  3. On a successful compile, the user receives a Mailtrap email with a signed, expiring download link AND their dashboard shows a "Download" button — both channels fire, either alone unblocks the user.
  4. On a terminal compile failure (all retries exhausted), the user receives an explanatory email + support link and the dashboard shows a failure state — no silent hangs.
  5. Admin receives an alert (email or dashboard flag) when a compile job fails after all retries or when the compile server has been offline past threshold.
**Plans**: TBD (est. 4)

Plans:
- [ ] 05-01: Admin robot list + activate/deactivate + edit metadata UI (role check + `revalidatePath`)
- [ ] 05-02: Admin add-robot + source-upload flow (metadata form + encrypted-upload handler)
- [ ] 05-03: User delivery: purchase-completion email with signed download link + dashboard download button (both wired to same `Compilation` state)
- [ ] 05-04: Failure delivery: user failure email + dashboard failure state + admin alert on retry-exhausted / server-offline threshold

### Phase 6: Public Catalog, Per-Robot Pricing, Free Trials
**Goal**: A visitor can browse the catalog, pick a robot, pick a tier, pay, and (for free trials) claim at most one trial per robot — all with correct per-robot pricing and no client-side bypass.
**Depends on**: Phase 5 (admin needs to be able to activate a robot before it can appear on the public catalog; needs delivery loop so a purchase actually lands)
**Requirements**: CTLG-02, CTLG-03, PRIC-01, PRIC-03, PRIC-04, TRIL-01, TRIL-02, TRIL-03
**Success Criteria** (what must be TRUE):
  1. The public catalog page lists every active robot with artwork, description, and a CTA — visitors can browse without logging in.
  2. Checkout accepts `robotSlug` (or `robotId`) — a user picks a robot, then a tier for that robot, then pays; unknown robot or tier is refused, not coerced.
  3. Each active robot has its own set of pricing rows (free trial / 1 month / 6 months / lifetime) with independent prices — displayed correctly in the checkout UI and enforceable server-side.
  4. A user may claim at most one free trial per robot — enforced by a server-side check or unique constraint on (`userId`, `robotId`, `tier=FREE_TRIAL`), not by client-only guards.
  5. A free trial subscription runs the full lifecycle (MT5 binding → compile → delivery → expiry) identically to paid tiers, per-robot.
  6. An admin can change a robot's tier prices from the admin dashboard without a code deploy.
**Plans**: TBD (est. 4)

Plans:
- [ ] 06-01: Public catalog page + robot-aware checkout UX (`/[locale]/catalog` + `CheckoutClient` accepts `robotSlug`)
- [ ] 06-02: Per-robot pricing data model + admin edit UI (`RobotTier` or `RobotPricing` rows keyed by robot + tier)
- [ ] 06-03: Server-side tier enforcement + refusal path (`create-session`, `free-trial` route, webhook validation refuse unknown)
- [ ] 06-04: One-trial-per-robot enforcement (unique constraint + server-side pre-check + updated free-trial flow)

### Phase 7: Onboard 3 New Robots + End-to-End Validation
**Goal**: Three new robots are live on the catalog, priced, buyable, and each has been proven end-to-end from purchase through MetaTrader execution.
**Depends on**: Phase 6 (needs catalog + pricing + delivery loop) and by extension all earlier phases
**Requirements**: ONBD-01, ONBD-02, ONBD-03, ONBD-04
**Success Criteria** (what must be TRUE):
  1. Robot #2 is visible on the public catalog with real metadata, artwork, and pricing; encrypted source is uploaded; a real purchase compiles and delivers a working `.ex5`.
  2. Robot #3 meets the same criteria — visible, priced, source uploaded, purchase → deliver verified.
  3. Robot #4 meets the same criteria — visible, priced, source uploaded, purchase → deliver verified.
  4. For each of the three new robots, an end-to-end test with a real MT5 account has been performed: purchase → compile → deliver → user runs the `.ex5` in MetaTrader against the bound account. The test result is recorded per robot.
**Plans**: TBD (est. 4)

Plans:
- [ ] 07-01: Onboard robot #2 (admin add + source upload + tier prices + catalog listing verified)
- [ ] 07-02: Onboard robot #3 (same criteria as 07-01)
- [ ] 07-03: Onboard robot #4 (same criteria as 07-01)
- [ ] 07-04: End-to-end MT5 validation for each new robot (real purchase, real compile, real MetaTrader run — logged per robot)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 (decimal insertions land between their surrounding integers if any get added later)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Restore Compile Delivery | 0/4 | Planned | - |
| 2. Payment + Pricing Launch Blockers | 0/3 | Not started | - |
| 3. Multi-Robot Schema Foundation | 0/3 | Not started | - |
| 4. Robot-Aware Compile Pipeline | 0/4 | Not started | - |
| 5. Admin Catalog + Delivery Loop | 0/4 | Not started | - |
| 6. Public Catalog, Per-Robot Pricing, Free Trials | 0/4 | Not started | - |
| 7. Onboard 3 New Robots + End-to-End Validation | 0/4 | Not started | - |

---

*Roadmap created: 2026-07-04*
*Coverage: 40/40 v1 requirements mapped*
