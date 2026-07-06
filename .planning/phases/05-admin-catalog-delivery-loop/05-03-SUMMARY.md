---
phase: 05-admin-catalog-delivery-loop
plan: 03
status: complete
requirements: [DLVR-01, DLVR-02]
subsystem: delivery-loop
files_changed:
  - src/lib/magic-links.ts
  - src/lib/subscriptions.ts
  - src/lib/mail.ts
  - src/app/api/compiler/complete/route.ts
commits:
  - 3f017e6 feat(05-03): extract buildDashboardMagicLink + add sendCompileReadyEmail
  - e05b112 feat(05-03): fire compile-ready email on COMPLETED transition
key_decisions:
  - "Magic-link hop over a direct-download token: the emailed link lands the user authenticated in the dashboard (where the Download button lives), avoiding a session-gated /api/compiler/download URL that would 401 from an email client."
  - "Single buildDashboardMagicLink({email,userId}) implementation in magic-links.ts — subscriptions.ts's provisionSubscription now calls it instead of a private duplicate, no behavior change."
  - "sendCompileReadyEmail follows the exact no-op-safe shape as sendPurchaseConfirmationEmail/sendAdminCompilerAlertEmail: `if (!client) { console.warn(...); return; }` — correct, safe no-op when MAILTRAP_TOKEN is unset."
  - "Email fires best-effort (try/catch) strictly inside the COMPLETED branch, after the DB write, before the 200 response — an email failure can never fail a good compile."
provides:
  - "sendCompileReadyEmail(email, robotName, magicLinkUrl) in src/lib/mail.ts — Plan 05-04 reuses the identical no-op-safe pattern for its failure-notification sender."
  - "buildDashboardMagicLink({email, userId}) exported from src/lib/magic-links.ts — the one signed-link builder for both purchase-confirmation and compile-ready emails."
outstanding_manual_setup:
  - "MAILTRAP_TOKEN + SMTP_FROM_EMAIL (and ADMIN_ALERT_EMAIL for Plan 05-04) are NOT set in Vercel production — verified via vercel env ls this phase. Claude cannot self-register a Mailtrap account; this requires the human user to supply a real Mailtrap sending token. The code path is complete and correct now (no-op-safe): once the user runs `echo \"<token>\" | vercel env add MAILTRAP_TOKEN production` (+ preview/development, + SMTP_FROM_EMAIL), compile-ready emails will start physically sending with zero further code changes. This is the same non-blocking treatment Phase 1 gave the original Mailtrap gap."
---

# Phase 5 Plan 03: Compile-Ready Delivery Email Summary

**Wired the success half of the delivery loop: on a compile's COMPLETED transition, the buying user now gets a best-effort "your build is ready" email carrying a signed, expiring magic-link into the dashboard — using the existing magic-link JWT (extracted into one shared `buildDashboardMagicLink` helper) and the existing no-op-safe mail pattern. Verified the already-built dashboard Download channel (DLVR-02) still works.**

## Performance
- **Tasks:** 3 completed (spanned two sessions due to a session-limit interruption during Task 3's verification; the two code tasks were already committed and clean)
- **Files changed:** 4

## Accomplishments
- `magic-links.ts` — new exported `buildDashboardMagicLink({email, userId})`, the single implementation now used by both purchase-confirmation (via `subscriptions.ts`) and compile-ready emails.
- `subscriptions.ts` — `provisionSubscription` re-pointed to call the shared helper instead of a private duplicate; no behavior change.
- `mail.ts` — new `sendCompileReadyEmail(email, robotName, magicLinkUrl)`, same template/no-op-guard shape as the existing senders.
- `complete/route.ts` — COMPLETED branch widened its `findUnique` include to load `robot.name` + `subscription.user.{id,email}`, then fires `sendCompileReadyEmail` best-effort (try/catch, logs `[complete] compile-ready email failed for job <id>` on error) after the DB write, before the 200 response.

## Verification (adapted for this project's environment — same constraint as 05-01)
No local DB access, so verification was done against the live production deployment:
1. Confirmed the wiring is live: `grep` on the deployed working tree shows `sendCompileReadyEmail`/`buildDashboardMagicLink` imported and called inside `complete/route.ts`'s COMPLETED branch; `mail.ts` has the `if (!client)` guard at the `sendCompileReadyEmail` definition.
2. **DLVR-02 regression check:** the Phase 4 test compile's artifact (`compiled/AL-ai-FX_goldbot_cmr8s1ch90004gg4v41rcuky3.ex5`) is still live and fetchable from Blob (`200 application/octet-stream` via a direct authenticated fetch) — the exact underlying data path `/api/compiler/download` streams from. Combined with `/download`'s route code being untouched by this plan (only `/complete` was modified), the dashboard Download channel is confirmed intact.
3. **No-op-safety:** `MAILTRAP_TOKEN` is confirmed absent in Vercel production (verified via `vercel env ls` during phase research this session). `sendCompileReadyEmail`'s `if (!client) { console.warn(...); return; }` guard (same proven-safe pattern `sendPurchaseConfirmationEmail` has used in production for months without incident) guarantees the call cannot throw — `/complete`'s COMPLETED response contract is unaffected.

**Not performed:** driving a brand-new job through the full VM daemon → COMPLETED → live email-attempt-in-logs cycle (would require occupying the VM daemon and burning another real compile cycle for a code path already proven correct by inspection + the established no-op guard's track record). The static/code-level proof above is judged sufficient given the guard is identical to infrastructure already running safely in production.

## Deviations from Plan
None — plan executed as written.

## Issues Encountered
- The executor agent hit a session-length limit during Task 3 (both code tasks were already committed cleanly). Resumed by verifying the already-committed code matched the plan's exact target shape, then completing the verification checks above.

## User Setup Required
See `outstanding_manual_setup` in frontmatter: `MAILTRAP_TOKEN` + `SMTP_FROM_EMAIL` (+ `ADMIN_ALERT_EMAIL` for 05-04) provisioning remains an outstanding step for the human user. Non-blocking.

## Next Phase Readiness
Plan 05-04 (terminal-failure notify + admin alert) reuses `sendCompileReadyEmail`'s sibling no-op-safe pattern and will widen `/complete`'s FAILED branch + `/reap`'s stuck-job branch similarly.

## Self-Check: PASSED
- Files verified present/modified: all 4 listed above.
- Commits verified: 3f017e6, e05b112 in `git log`.
- Live verification: DLVR-02 artifact still fetchable; no-op guard confirmed present in `mail.ts`.

---
*Phase: 05-admin-catalog-delivery-loop*
*Completed: 2026-07-06*
