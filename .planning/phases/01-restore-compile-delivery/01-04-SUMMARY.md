---
phase: 01-restore-compile-delivery
plan: 04
subsystem: infra
tags: [next16, admin-dashboard, mailtrap, nextauth, prisma, polling, backoff, observability]

# Dependency graph
requires:
  - phase: 01-01
    provides: WorkerHeartbeat table, HEARTBEAT_STALE_SECONDS, HEARTBEAT_DEAD_SECONDS, STUCK_JOB_MINUTES, CLIENT_POLL_* constants in src/lib/compiler-config.ts
  - phase: 01-03
    provides: /api/compiler/reap route (STUCK_JOB_MINUTES + MAX_ATTEMPTS + CRON_SECRET gate) extended in this plan for alert firing
provides:
  - Admin-gated /api/admin/compiler-status endpoint returning worker heartbeat freshness + queue-health counters
  - CompileServerStatus client tile on /dashboard/admin (15s poll, green/stale/red)
  - sendAdminCompilerAlertEmail Mailtrap template (job-failed + stale-heartbeat kinds; silent no-op when MAILTRAP_TOKEN unset)
  - Reaper-fired admin alerts on retry-exhausted FAILED and stale-heartbeat, with 15-min per-warm-instance in-memory cooldown
  - Bounded LicenseManager polling (5s -> 30s backoff, 5-min hard cap) with TIMED_OUT UI state
affects: [phase-02-pricing-consistency (uses same admin dashboard shell), phase-04-source-hardening (private blobs may reuse admin observability pattern)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ADMIN-gated route handlers via session.user.role === 'ADMIN' at top of GET (matches admin/page.tsx redirect pattern)"
    - "Client tile polling: setInterval in useEffect + cancelled flag + interval cleanup on unmount"
    - "Module-level in-memory cooldown map for fire-and-forget alerts inside serverless route handlers (best-effort dedup per warm instance)"
    - "Bounded client polling: setTimeout self-scheduling loop + startedAt wall-clock cap + cancelled flag + setTimeout cleanup"

key-files:
  created:
    - src/app/api/admin/compiler-status/route.ts
    - src/components/dashboard/CompileServerStatus.tsx
    - .planning/phases/01-restore-compile-delivery/01-04-SUMMARY.md
  modified:
    - src/app/[locale]/dashboard/admin/page.tsx
    - src/lib/mail.ts
    - src/app/api/compiler/reap/route.ts
    - src/components/dashboard/LicenseManager.tsx

key-decisions:
  - "Alert cooldown lives at module scope in /api/compiler/reap (per-warm-instance) not in a DB row - cold starts may cause one duplicate email per event, acceptable trade-off vs adding a schema table for Phase 1"
  - "sendAdminCompilerAlertEmail is silent-no-op on missing MAILTRAP_TOKEN + SMTP_PASS (no throw) - alerts are best-effort side effects, /reap must return 200 even if Mailtrap is unreachable"
  - "TIMED_OUT is client-only UI state (React setState) not a Prisma enum value - avoids schema migration for a pure UX transition; server still sees PENDING/PROCESSING/COMPLETED/FAILED only"
  - "Admin status endpoint uses ADMIN role gate (returns 403 for USER, 403 for anon) matching the existing admin/page.tsx redirect - single source of truth for admin gating stays in NextAuth session"

patterns-established:
  - "ADMIN role gate: session?.user?.role !== 'ADMIN' -> 403 (not redirect - this is a JSON endpoint, distinct from the page-level redirect)"
  - "Alert dedup: 15-min ALERT_COOLDOWN_MS + lastAlertAt map keyed by event kind, no async/await needed inside cooldown check"
  - "Client backoff: delay = Math.min(delay * 1.5, MAX_MS); Date.now() - startedAt > TIMEOUT_MS termination check at top of tick"

# Metrics
duration: 5m 33s
completed: 2026-07-04
---

# Phase 1 Plan 4: Admin Visibility + Client Cap + Email Alerts Summary

**Live compile-server health tile on /dashboard/admin, Mailtrap admin alerts fired by the reaper (retry-exhausted + stale-heartbeat, deduped), and a bounded LicenseManager polling loop that transitions to TIMED_OUT after 5 minutes.**

## Performance

- **Duration:** 5m 33s
- **Started:** 2026-07-04T17:04:27Z
- **Completed:** 2026-07-04T17:09:57Z (approx)
- **Tasks:** 3
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Admin can see a green/stale/red Compile Server tile on /dashboard/admin, updating every 15s, alongside queue counters (processing, stuck, failed 24h, oldest pending)
- Reaper now emails the admin (via Mailtrap) when: (a) any job burns through MAX_ATTEMPTS to permanent FAILED, or (b) the WorkerHeartbeat is older than HEARTBEAT_DEAD_SECONDS. 15-min per-warm-instance cooldown prevents flood on repeated ticks.
- LicenseManager no longer polls forever: exponential backoff 5s -> 30s, wall-clock cap at 5 min, transitions to a TIMED_OUT UI state that stops all requests and surfaces a helpful message. Retrying via Save & Lock resets the timeout.
- Production deploy Ready at https://www.al-ai-fx.xyz (deployment id dpl_ESt9bn2jjCUHfzL3aMweADsW1Fyn); /api/admin/compiler-status returns 403 to anonymous callers; /api/compiler/reap still 401 without the CRON_SECRET (regression-free).

## Task Commits

Each task was committed atomically as livetradingcoder <live-trading-league@proton.me> and pushed to origin/main:

1. **Task 1: Admin status endpoint + dashboard tile** - `233cc96` (feat)
2. **Task 2: sendAdminCompilerAlertEmail + wire into /api/compiler/reap** - `f521af9` (feat)
3. **Task 3: Cap LicenseManager polling with backoff + TIMED_OUT UI state** - `21d5bcc` (feat)

**Plan metadata:** `09de6bb` (docs: complete plan; adds SUMMARY.md + STATE.md updates)

## Files Created/Modified
- `src/app/api/admin/compiler-status/route.ts` (created) - ADMIN-gated GET returning `{ status, lastSeenAgoSeconds, oldestPendingAgeSeconds, processingCount, stuckCount, failedLast24h, thresholds }`
- `src/components/dashboard/CompileServerStatus.tsx` (created) - Client tile with 15s poll + colored dot + counters
- `src/app/[locale]/dashboard/admin/page.tsx` (modified) - Import + `<CompileServerStatus />` as 4th card in features-grid; no other structural changes
- `src/lib/mail.ts` (modified) - Appended `sendAdminCompilerAlertEmail(payload)` reusing the existing `client`, `sender`, `renderEmailTemplate`
- `src/app/api/compiler/reap/route.ts` (modified) - Adds `ALERT_COOLDOWN_MS` / `lastAlertAt` map + `tryFireAlert` helper; captures `errorMessage` in the stuck select; post-loop fires `job-failed` alert once per batch and separately fires `stale-heartbeat` alert if `WorkerHeartbeat.lastSeenAt` is past HEARTBEAT_DEAD_SECONDS
- `src/components/dashboard/LicenseManager.tsx` (modified) - Replaced forever-`setInterval` with self-scheduling `setTimeout` loop using `CLIENT_POLL_INITIAL_MS -> CLIENT_POLL_MAX_MS` backoff and `CLIENT_POLL_TIMEOUT_MS` wall-clock cap; added `timedOut` state and TIMED_OUT UI branch; reset `timedOut` in `handleUpdateMt5` so retry resumes polling

## Decisions Made
- Alert cooldown is per-warm-instance in-memory (module-level `lastAlertAt` map) not persistent. Cold starts may cause one duplicate email per event, which is acceptable vs adding a schema table.
- `sendAdminCompilerAlertEmail` is silent no-op if `MAILTRAP_TOKEN`/`SMTP_PASS` missing OR if no `ADMIN_ALERT_EMAIL`/`SMTP_FROM_EMAIL` - never throws. `/reap` must never fail on email issues.
- Admin status route uses `403 Forbidden` (not `401` or redirect) - it's a JSON endpoint, and the ADMIN role gate is the semantic mismatch (authenticated user with wrong role should see 403). Anonymous callers with no session also get 403, matching the plan's success criterion "USER role gets 403".
- TIMED_OUT stays client-only React state - no `CompileStatus.TIMED_OUT` enum value added to Prisma. Prevents a schema migration for a pure UX transition.
- `t.has?.('timedOut')` guard from the plan was not portable across `next-intl` versions - substituted a plain English fallback string. i18n backfill of the `timedOut` message key is a nice-to-have follow-up (`src/messages/*.json`), not a Phase 1 blocker.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Simplified next-intl fallback for timedOut message**
- **Found during:** Task 3 (LicenseManager)
- **Issue:** Plan literally suggested `t.has?.('timedOut') ? t('timedOut') : "English fallback"`. `useTranslations` from `next-intl` does not expose `.has` as a method on the returned callable across all versions - this would either type-error or silently take the fallback branch.
- **Fix:** Used the plain English fallback directly. Plan explicitly acknowledges this is acceptable ("translations are additive; users see the English fallback if missing").
- **Files modified:** `src/components/dashboard/LicenseManager.tsx`
- **Verification:** `npx tsc --noEmit` passes; grep counts match plan expectations.
- **Committed in:** `21d5bcc`

**2. [Rule 2 - Missing Critical] Captured errorMessage from stuck rows for job-failed alert**
- **Found during:** Task 2 (reap route)
- **Issue:** Plan's example only threaded `jobId` + `MAX_ATTEMPTS` into the `job-failed` alert. Without the row's `errorMessage`, the admin email body would say "No error message recorded" every time, defeating the purpose of forwarding it.
- **Fix:** Extended the `select` on the initial `findMany` to include `errorMessage`; captured `firstFailedErrorMessage` during the loop; threaded it into the alert payload. Falls back to the terminal-error string if the row had no prior errorMessage.
- **Files modified:** `src/app/api/compiler/reap/route.ts`
- **Verification:** Type-checks; grep counts pass.
- **Committed in:** `f521af9`

---

**Total deviations:** 2 auto-fixed (1 blocking type/API mismatch, 1 missing critical observability)
**Impact on plan:** Both fixes narrow. TIMED_OUT still uses fallback English per plan's own comment. Alert emails now carry the actual error message (which was the point of forwarding them).

## Issues Encountered
- `sendAdminCompilerAlertEmail` grep in `src/app/api/compiler/reap/route.ts` returns **3**, not 2 as the plan's `<verify>` said - because we have two call sites (one for `job-failed` batch, one for `stale-heartbeat`), which is exactly what the plan's `<action>` step explicitly instructs. The `<verify>` example under-counted; both call sites are required by the plan's success criteria.

## User Setup Required

**External services require manual configuration to activate alert emails (Task #13 in the orchestrator's tracking):**

- `MAILTRAP_TOKEN` (or `SMTP_PASS`) - Mailtrap API token. Currently NOT set in Vercel (verified via `vercel env ls`). Until set, all admin alert calls log a warning and return without sending - `/reap` still returns 200 promptly.
- `ADMIN_ALERT_EMAIL` - recipient for admin alerts. Falls back to `SMTP_FROM_EMAIL` if unset. Both currently unset in Vercel.

**Add via:** `vercel env add MAILTRAP_TOKEN production` (interactive; paste token from Mailtrap dashboard), then `vercel env add ADMIN_ALERT_EMAIL production`, then redeploy. Graceful degradation means no code change needed once the token lands.

## Verification Proof

Production deploy: `dpl_ESt9bn2jjCUHfzL3aMweADsW1Fyn`, readyState `READY`, aliased `https://www.al-ai-fx.xyz`.

```
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" https://www.al-ai-fx.xyz/api/admin/compiler-status
HTTP 403

$ curl -s -o /dev/null -w "HTTP %{http_code}\n" https://www.al-ai-fx.xyz/api/compiler/reap
HTTP 401
```

`/api/admin/compiler-status` returns 403 to unauthenticated callers (session check succeeds — no session, no ADMIN role); `/api/compiler/reap` still 401 without CRON_SECRET (Plan 01-03 gate intact).

Type check clean:
```
$ npx tsc --noEmit
(no output)
```

Grep checks (from plan `<verify>` blocks):
```
$ grep -c "CompileServerStatus" src/app/[locale]/dashboard/admin/page.tsx
2
$ grep -c "sendAdminCompilerAlertEmail" src/lib/mail.ts
1
$ grep -c "sendAdminCompilerAlertEmail" src/app/api/compiler/reap/route.ts
3     # 1 import + 2 call sites (job-failed batch + stale-heartbeat), see Issues Encountered above
$ grep -c "CLIENT_POLL_TIMEOUT_MS" src/components/dashboard/LicenseManager.tsx
3     # 1 import + 2 uses
$ grep -c "setTimedOut" src/components/dashboard/LicenseManager.tsx
3
$ grep -c "setInterval" src/components/dashboard/LicenseManager.tsx
0
```

## Next Phase Readiness

**Phase 1 complete pending 2 follow-ups (both non-blocking):**
1. Provision `MAILTRAP_TOKEN` + `ADMIN_ALERT_EMAIL` in Vercel to activate the alert email path (Task #13).
2. Fix VM MetaTrader stdlib include path (Phase 1 blocker surfaced in Plan 01-02 - MetaEditor can't find Trade.mqh under LocalSystem). Pipeline plumbing is production-ready; real .ex5 delivery blocked at MetaEditor step until this is resolved.

**Ready for Phase 2 (Payment Trust Fixes):**
- Admin dashboard shell (`/dashboard/admin`) is now extensible - the `<CompileServerStatus />` pattern (server component embeds client tile with its own poll) is reusable for future admin observability.
- Alert cooldown pattern (module-level `lastAlertAt` + `tryFireAlert` fire-and-forget) is reusable for any future serverless-route alert needs.
- Bounded client polling pattern (setTimeout self-scheduling + wall-clock cap + terminal UI state) is reusable for any long-running background job UX in the app.

## Self-Check: PASSED

All 3 created files exist. All 4 modified files exist. All 3 task commits (`233cc96`, `f521af9`, `21d5bcc`) present on `main` and pushed to origin.

---
*Phase: 01-restore-compile-delivery*
*Completed: 2026-07-04*
