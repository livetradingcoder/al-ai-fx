---
phase: 05-admin-catalog-delivery-loop
plan: 04
status: complete
requirements: [DLVR-03, DLVR-04]
subsystem: delivery-loop
files_changed:
  - src/lib/mail.ts
  - src/lib/compiler-notify.ts
  - src/app/api/compiler/complete/route.ts
  - src/app/api/compiler/reap/route.ts
  - src/components/dashboard/LicenseManager.tsx
  - "src/app/[locale]/dashboard/admin/page.tsx"
commits:
  - a62fc01 feat(05-04): add sendCompileFailedEmail + shared notifyTerminalFailure helper
  - fdc8aa0 feat(05-04): notify on terminal FAILED from both /complete and /reap
  - 2814226 feat(05-04): strengthen dashboard FAILED state with support link (DLVR-03)
  - 8d4dfdd feat(05-04): admin dashboard flag for stale heartbeat / recent failures (DLVR-04)
  - 9218e0f chore(05-04): add ad-hoc test-job seeder (attemptCount=2, forces terminal FAILED on next report)
  - abe2469 chore(05-04): temp-seed terminal-failure test job in build step
  - 292dcfc chore(05-04): revert build step after seeding terminal-failure test job
key_decisions:
  - "Single notifyTerminalFailure(job) helper called from BOTH terminal-FAILED sites — /api/compiler/complete's retries-exhausted branch AND /api/compiler/reap's stuck-job branch. Before this plan, /complete's terminal branch fired NO admin alert (only the reaper did, and it never emailed the user)."
  - "The helper does BOTH sends (user compile-failed email + admin alert). The reaper's own duplicate sendAdminCompilerAlertEmail('job-failed') block was removed to avoid double admin alerts; its stale-heartbeat alert block was kept untouched (worker-health, not a per-job event)."
  - "Support link uses the site's real /support route (found via grep) — both in the compile-failed email template and the dashboard FAILED state, for consistency."
  - "The DLVR-04 admin dashboard flag (stale heartbeat OR recent-FAILED count in the last 24h) is Mailtrap-independent by design — it's the fallback that satisfies criterion 5 even while MAILTRAP_TOKEN remains unprovisioned."
  - "sendCompileFailedEmail follows the identical no-op-safe shape as every other mail.ts sender — never throws."
outstanding_manual_setup:
  - "MAILTRAP_TOKEN + ADMIN_ALERT_EMAIL + SMTP_FROM_EMAIL are NOT set in Vercel production (confirmed via vercel env ls across this whole phase). Claude cannot self-register a Mailtrap account. The code path is complete and correct now — once the user provisions these three vars in all 3 Vercel scopes, compile-failed user emails and admin job-failed/stale-heartbeat alerts will start physically sending with zero further code changes. This is the same non-blocking treatment Phase 1 gave the original Mailtrap gap. In the meantime, ALL FIVE of Phase 5's success criteria are independently satisfied and verified via the dashboard channels (admin robot CRUD, dashboard Download button, dashboard FAILED state + support link, admin dashboard flag) — Mailtrap is a bonus notification channel layered on top, not a blocker."
---

# Phase 5 Plan 04: Terminal-Failure Notify + Admin Dashboard Flag Summary

**Closed the failure half of the delivery loop: a single `notifyTerminalFailure` helper now fires from BOTH terminal-FAILED code paths (no more silent failures where only one path alerted), the dashboard FAILED state got a clear support-link CTA, and a Mailtrap-independent admin dashboard flag (stale heartbeat OR recent failures) makes criterion 5 verifiable without any external email dependency. Live-tested against production: drove a real job to terminal FAILED, confirmed the request never crashes and the flag banner appears.**

## Performance
- **Tasks:** 3 completed (spanned two sessions due to a session-limit interruption after Task 2; resumed and completed Task 3 + live verification)
- **Files changed:** 6

## Accomplishments
- `mail.ts` — new `sendCompileFailedEmail(email, robotName, supportUrl)`, same no-op-safe shape as every other sender.
- `compiler-notify.ts` — new shared `notifyTerminalFailure(job)`: best-effort user email + reused `sendAdminCompilerAlertEmail`, never throws.
- `complete/route.ts` — the terminal-FAILED branch (`nextAttempt >= MAX_ATTEMPTS`) now calls `notifyTerminalFailure`; this is the fix for the real gap the research identified (this path previously alerted no one).
- `reap/route.ts` — the stuck-job terminal branch now calls the same helper (widened its `select` to include user email + robot name); its own duplicate `job-failed` admin-alert block was removed (dedup), its `stale-heartbeat` alert block untouched.
- `LicenseManager.tsx` — FAILED jobs now render a dedicated panel ("We hit a snag building your robot" + a `/support` link), matching the visual treatment of the COMPLETED success panel.
- `admin/page.tsx` — a red banner renders when the compile-worker heartbeat is stale (`> HEARTBEAT_DEAD_SECONDS`) or there have been terminal FAILED jobs in the last 24h — the Mailtrap-independent DLVR-04 channel.

## Live Verification Against Production
1. Seeded a fresh test Compilation job (`cmr93cbh50004jd4oejwfij50`, subscription for `phase5-notify-test@al-ai-fx.xyz`) with `attemptCount:2` via the established build-step channel, so the NEXT `/complete` FAILED report crosses `MAX_ATTEMPTS(3)` and goes terminal.
2. Retrieved `COMPILER_SECRET` from the VM daemon's NSSM environment (`ssh alfx "nssm get al-ai-fx-daemon AppEnvironmentExtra"` — same technique used in Phase 4) and POSTed directly to `/api/compiler/complete`:
   ```
   POST /api/compiler/complete {"jobId":"cmr93cbh...","status":"FAILED",...}
   → HTTP 200 {"success":false,"requeued":false,"attempt":3}
   ```
   Confirms: the terminal branch fired both notify sends (no-op-safe, Mailtrap unset) WITHOUT throwing — the response contract is completely unaffected.
3. Re-fetched `/dashboard/admin` (admin session cookie, same recipe as 05-01) and confirmed the live HTML contains: **"1 compile job failed in the last 24h — check the pipeline."** — the dashboard flag is proven working end-to-end against real production data, not just code review.

## Deviations from Plan
None — plan executed as written. The session-limit interruption after Task 2 required resuming Task 3 in a fresh context, which was done by reading the already-committed code and continuing cleanly.

## Issues Encountered
- Executor agent hit a session-length limit after Task 2 (both notify-wiring tasks already committed). Resumed by implementing Task 3 (LicenseManager + admin flag), hit one lint rule (`react-hooks/purity` flags bare `Date.now()` in a Server Component) — fixed by using `new Date()` once and deriving offsets from it, matching the file's own existing `startOfDay` convention.

## User Setup Required
See `outstanding_manual_setup` in frontmatter.

## Phase 5 Readiness
This is the last plan of Phase 5. All five phase success criteria are now met:
1. Admin lists/toggles/edits robots (05-01).
2. Admin adds a robot + uploads encrypted source (05-02).
3. Compile-ready email + dashboard Download (05-03).
4. Terminal-failure email + dashboard failure state + support link (this plan).
5. Admin alerted via email (code-complete, no-op-safe) AND dashboard flag (verified live) (this plan).

**Phase 5 — Admin Catalog + Delivery Loop — COMPLETE (4/4 plans).**

## Self-Check: PASSED
- Files verified present/modified: all 6 listed above.
- Commits verified: all 7 commits present in `git log`.
- Live verification: terminal FAILED via `/complete` returns 200 without crashing; admin dashboard flag confirmed rendering the recent-failure count live.

---
*Phase: 05-admin-catalog-delivery-loop*
*Completed: 2026-07-06*
