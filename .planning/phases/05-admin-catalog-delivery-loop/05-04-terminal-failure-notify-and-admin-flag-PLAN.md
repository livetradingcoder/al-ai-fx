---
phase: 05-admin-catalog-delivery-loop
plan: 04
type: execute
wave: 2
depends_on: [05-03]
files_modified:
  - src/lib/mail.ts
  - src/lib/compiler-notify.ts
  - src/app/api/compiler/complete/route.ts
  - src/app/api/compiler/reap/route.ts
  - src/components/dashboard/LicenseManager.tsx
  - src/app/[locale]/dashboard/admin/page.tsx
user_setup:
  - service: mailtrap
    why: "Terminal-failure user email + admin alert email. Code path is complete and no-op-safe without it; the dashboard flag (below) satisfies DLVR-04 independently, and dashboard failure UI satisfies DLVR-03's user-facing half without mail."
    env_vars:
      - name: MAILTRAP_TOKEN
        source: "Mailtrap dashboard -> API Tokens (user must supply)"
      - name: ADMIN_ALERT_EMAIL
        source: "Founder/ops inbox to receive compiler alerts (falls back to SMTP_FROM_EMAIL)"
autonomous: true

must_haves:
  truths:
    - "Both terminal-FAILED code paths notify: /api/compiler/complete's retries-exhausted branch (nextAttempt >= MAX_ATTEMPTS) AND /api/compiler/reap's stuck-job exhaustion both call a single shared notifyTerminalFailure helper"
    - "notifyTerminalFailure sends the buying user a best-effort compile-failed email (with a support link) AND fires the existing admin alert (sendAdminCompilerAlertEmail kind:'job-failed') — both best-effort, neither ever fails the request"
    - "Before this plan, /api/compiler/complete's terminal-FAILED branch fired NO admin alert (only the reaper did); after, both paths alert — no silent terminal failure"
    - "sendCompileFailedEmail is no-op-safe (`if (!client)` guard) like every other mail.ts sender"
    - "The dashboard failure state (DLVR-03 user half) is strengthened in LicenseManager: a FAILED job shows a clear failure message + a support/contact link (not just 'check later')"
    - "The admin dashboard shows a DLVR-04 dashboard-flag: a visible indicator when the compile-worker heartbeat is stale (past HEARTBEAT_DEAD_SECONDS) OR there are recent terminal-FAILED jobs — so criterion 5 is satisfiable/verifiable in-browser WITHOUT Mailtrap"
    - "npx tsc --noEmit + eslint pass; a terminal FAILED via /complete is exercised (admin alert + user email fire best-effort) and the admin flag + dashboard failure UI are verified in a browser"
  artifacts:
    - path: "src/lib/compiler-notify.ts"
      provides: "Shared notifyTerminalFailure(job) helper called from both terminal-FAILED sites"
      contains: "export async function notifyTerminalFailure"
    - path: "src/lib/mail.ts"
      provides: "sendCompileFailedEmail sender (no-op-safe, support link)"
      contains: "sendCompileFailedEmail"
    - path: "src/app/api/compiler/complete/route.ts"
      provides: "terminal-FAILED branch now calls notifyTerminalFailure"
      contains: "notifyTerminalFailure"
    - path: "src/app/api/compiler/reap/route.ts"
      provides: "reaper terminal-FAILED now calls notifyTerminalFailure (user email + admin alert)"
      contains: "notifyTerminalFailure"
    - path: "src/app/[locale]/dashboard/admin/page.tsx"
      provides: "DLVR-04 dashboard flag (stale heartbeat / recent failures)"
      contains: "HEARTBEAT_DEAD_SECONDS"
    - path: "src/components/dashboard/LicenseManager.tsx"
      provides: "Strengthened FAILED state with support link (DLVR-03)"
      contains: "FAILED"
  key_links:
    - from: "src/app/api/compiler/complete/route.ts"
      to: "src/lib/compiler-notify.ts notifyTerminalFailure"
      via: "terminal branch (nextAttempt >= MAX_ATTEMPTS)"
      pattern: "notifyTerminalFailure\\("
    - from: "src/app/api/compiler/reap/route.ts"
      to: "src/lib/compiler-notify.ts notifyTerminalFailure"
      via: "stuck-job exhaustion branch"
      pattern: "notifyTerminalFailure\\("
    - from: "src/lib/compiler-notify.ts"
      to: "src/lib/mail.ts sendCompileFailedEmail + sendAdminCompilerAlertEmail"
      via: "best-effort user email + admin alert"
      pattern: "sendCompileFailedEmail|sendAdminCompilerAlertEmail"
    - from: "src/app/[locale]/dashboard/admin/page.tsx"
      to: "prisma.workerHeartbeat + prisma.compilation"
      via: "stale-heartbeat + recent-FAILED count for the flag"
      pattern: "HEARTBEAT_DEAD_SECONDS"
---

<objective>
Wire the **failure half of the delivery loop**: a single shared `notifyTerminalFailure` helper (user compile-failed email + admin alert) called from BOTH terminal-FAILED code paths (`/api/compiler/complete`'s retries-exhausted branch AND `/api/compiler/reap`'s stuck-job branch — Pitfall 2), so no terminal failure is silent (DLVR-03 email + DLVR-04 admin alert). Strengthen the dashboard FAILED state with a support link (DLVR-03 user half), and add a **dashboard flag** on `/dashboard/admin` (stale heartbeat / recent terminal failures) so DLVR-04's "email OR dashboard flag" is satisfiable and verifiable in-browser WITHOUT Mailtrap.

Purpose: Satisfies success criteria 4 ("On terminal failure, user gets email + support link, dashboard shows failure state") and 5 ("Admin gets alerted — email OR dashboard flag — on retry-exhausted or server-offline-past-threshold").

**Mailtrap note (NON-BLOCKING — documented per phase guidance):** the two email sends inside `notifyTerminalFailure` are no-op-safe (`mail.ts` `client = null` guard) — the code path is complete and correct now. Physical email delivery needs the user to provision `MAILTRAP_TOKEN` + `ADMIN_ALERT_EMAIL` (see `user_setup`). This is an outstanding manual step, NOT a blocker: the **dashboard flag** (admin) and **dashboard failure UI + support link** (user) independently satisfy criteria 4 & 5 in a browser today.

**Depends on Plan 05-03** — reuses the same no-op-safe `mail.ts` pattern and touches the same `mail.ts` + `complete/route.ts` files (→ Wave 2, sequential after 05-03).

Output:
- `src/lib/mail.ts` — `sendCompileFailedEmail(email, robotName, supportUrl)`
- `src/lib/compiler-notify.ts` — shared `notifyTerminalFailure(job)`
- `src/app/api/compiler/complete/route.ts` — call it in the terminal-FAILED branch
- `src/app/api/compiler/reap/route.ts` — call it in the stuck-job exhaustion branch
- `src/components/dashboard/LicenseManager.tsx` — support link on FAILED
- `src/app/[locale]/dashboard/admin/page.tsx` — dashboard flag
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-admin-catalog-delivery-loop/5-RESEARCH.md
@.planning/phases/05-admin-catalog-delivery-loop/05-03-SUMMARY.md
@src/lib/mail.ts
@src/lib/compiler-config.ts
@src/app/api/compiler/complete/route.ts
@src/app/api/compiler/reap/route.ts
@src/components/dashboard/LicenseManager.tsx
@src/app/[locale]/dashboard/admin/page.tsx
@prisma/schema.prisma
@AGENTS.md
</context>

<critical_environment_notes>
- **Node:** prepend `export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"` for every node/npx/tsc/eslint/dev call.
- **Two terminal-FAILED paths (Pitfall 2 — the core correctness risk):** grep confirms `status: 'FAILED'` is written in BOTH `complete/route.ts` (the `nextAttempt >= MAX_ATTEMPTS` else-branch) and `reap/route.ts` (the `else` inside the stuck-job loop). BOTH must call `notifyTerminalFailure`. Before this plan, `/complete`'s terminal branch fired NO admin alert; the reaper already fired the admin alert (via `tryFireAlert('job-failed', ...)`) but NOT a user email. Extract ONE helper; call from both. In the reaper, keep its 15-min per-instance cooldown for the admin alert (don't double-alert) — see the reaper structure; the shared helper's admin-alert half can either respect the reaper's existing `tryFireAlert` (call notify for the USER email in the loop, keep the admin alert on the reaper's cooldown path) OR the helper does both and the reaper drops its own `tryFireAlert('job-failed')`. **Recommended:** helper does BOTH (user email + admin alert); reaper calls `notifyTerminalFailure` per failed job and REMOVES its own `sendAdminCompilerAlertEmail('job-failed')` block to avoid duplication, but KEEPS the `stale-heartbeat` alert (that is worker-health, not a job). Document the dedup choice.
- **Best-effort rule (LOCKED):** every send in `notifyTerminalFailure` is try/catch; the helper NEVER throws. Neither `/complete` nor `/reap` may fail because a notify failed.
- **Reuse `sendAdminCompilerAlertEmail`** (`kind:'job-failed'`) — do NOT write a second admin-alert sender. `sendCompileFailedEmail` is the ONLY new sender.
- **Support link:** bake a support URL into the failed-email template + the dashboard FAILED state. Use the site's support/contact route (e.g. `${NEXTAUTH_URL||'https://www.al-ai-fx.xyz'}/support` or the existing contact page — confirm the real path; if none exists, use `mailto:hello@al-ai-fx.xyz` as the support link).
- **admin/page.tsx** already loads compile/heartbeat context (renders `<CompileServerStatus>`). ADD server-side reads for the flag: `prisma.workerHeartbeat.findUnique({where:{id:'compiler'}})` → stale if age > `HEARTBEAT_DEAD_SECONDS`; `prisma.compilation.count({where:{status:'FAILED', updatedAt: { gte: last24h }}})`. Render a red banner when either condition holds. Import thresholds from `@/lib/compiler-config`.
- **Next 16:** route handlers keep their existing response contracts — only ADD the notify calls. admin/page.tsx is a Server Component (async, already awaits session).
</critical_environment_notes>

<tasks>

<task type="auto">
  <name>Task 1: sendCompileFailedEmail + shared notifyTerminalFailure helper</name>
  <files>src/lib/mail.ts, src/lib/compiler-notify.ts</files>
  <action>
**1a. `mail.ts`** — add the failed-email sender (same no-op guard + template as `sendCompileReadyEmail`):
```ts
export async function sendCompileFailedEmail(
  email: string,
  robotName: string,
  supportUrl: string,
) {
  if (!client) {
    console.warn("[Mail] Mailtrap client not initialized. Skipping compile-failed email.");
    return;
  }
  const { html, text } = renderEmailTemplate({
    buttonLabel: "Contact support",
    buttonUrl: supportUrl,
    eyebrow: "Build issue",
    title: `We hit a snag building your ${robotName}`,
    intro: "Your compile did not complete after several automatic retries. Our team has been alerted and will get your build sorted — no action needed, but you can reach us any time.",
    detailLines: [
      `Robot: ${robotName}`,
      "You have not been charged for a failed build. Reply to this email or use the support link and we'll resolve it quickly.",
    ],
  });
  await client.send({
    from: sender,
    to: [{ email }],
    subject: `${robotName} — build needs attention`,
    html,
    text,
    category: "Delivery",
  });
  console.log(`[Mail] Compile-failed email sent to ${email}`);
}
```

**1b. `src/lib/compiler-notify.ts`** — NEW shared helper. Best-effort user email + admin alert; never throws:
```ts
import { sendCompileFailedEmail, sendAdminCompilerAlertEmail } from "@/lib/mail";

const SUPPORT_URL =
  (process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz") + "/support"; // confirm real support path; else mailto

/**
 * Terminal-failure fan-out, called from BOTH terminal-FAILED sites
 * (/api/compiler/complete retries-exhausted branch AND /api/compiler/reap
 * stuck-job branch). User compile-failed email (DLVR-03) + admin alert
 * (DLVR-04). Every send is best-effort — this helper NEVER throws, so it
 * can never fail the /complete or /reap request.
 */
export async function notifyTerminalFailure(job: {
  id: string;
  attemptCount: number;
  errorMessage: string | null;
  userEmail?: string | null;
  robotName?: string | null;
}): Promise<void> {
  if (job.userEmail && job.robotName) {
    try {
      await sendCompileFailedEmail(job.userEmail, job.robotName, SUPPORT_URL);
    } catch (e) {
      console.error(`[notify] compile-failed user email failed for job ${job.id}:`, e);
    }
  }
  try {
    await sendAdminCompilerAlertEmail({
      kind: "job-failed",
      jobId: job.id,
      attempts: job.attemptCount,
      errorMessage: job.errorMessage ?? undefined,
    });
  } catch (e) {
    console.error(`[notify] admin alert failed for job ${job.id}:`, e);
  }
}
```
(If no `/support` route exists in the app, set `SUPPORT_URL` to `mailto:hello@al-ai-fx.xyz` — grep the app for an existing support/contact route first.)
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q 'export async function sendCompileFailedEmail' src/lib/mail.ts && echo FAILED_SENDER_OK
grep -q 'export async function notifyTerminalFailure' src/lib/compiler-notify.ts && echo NOTIFY_OK
grep -q 'sendAdminCompilerAlertEmail' src/lib/compiler-notify.ts && echo REUSE_ADMIN_ALERT_OK
grep -q 'if (!client)' src/lib/mail.ts && echo NOOP_GUARD_OK
npx tsc --noEmit && npx eslint src/lib/mail.ts src/lib/compiler-notify.ts
```
  </verify>
  <done>`sendCompileFailedEmail` (no-op-safe, support link) + `notifyTerminalFailure` (best-effort user email + reused admin alert, never throws) exist; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 2: Call notifyTerminalFailure from both terminal-FAILED paths</name>
  <files>src/app/api/compiler/complete/route.ts, src/app/api/compiler/reap/route.ts</files>
  <action>
**2a. `complete/route.ts`** — the terminal-FAILED branch (the `else` where `nextAttempt >= MAX_ATTEMPTS`, after the `prisma.compilation.update({ status:'FAILED' ... })`). The `findUnique` include was widened in Plan 05-03 to load `subscription.user` + `robot.name`; reuse it. After the FAILED update, before the return:
```ts
import { notifyTerminalFailure } from '@/lib/compiler-notify';
// ...
// terminal FAILED branch, after the status:'FAILED' update:
await notifyTerminalFailure({
  id: jobId,
  attemptCount: nextAttempt,
  errorMessage: errorMessage ?? null,
  userEmail: job.subscription?.user?.email ?? null,
  robotName: job.robot?.name ?? null,
});
```
`notifyTerminalFailure` never throws, so no extra try/catch is needed, but keeping the response contract identical (`{ success:false, requeued:false, attempt }` 200) is mandatory. Do NOT call notify on the requeue branch (`nextAttempt < MAX_ATTEMPTS`) — only on terminal FAILED.

**2b. `reap/route.ts`** — in the stuck-job loop's terminal `else` (where it writes `status:'FAILED'` and pushes to `failed[]`), call `notifyTerminalFailure` per failed job. To do this the reaper's `findMany` select must also load user email + robot name — widen the select:
```ts
select: {
  id: true, attemptCount: true, errorMessage: true,
  robot: { select: { name: true } },
  subscription: { select: { user: { select: { email: true } } } },
},
```
Then in the terminal branch:
```ts
await notifyTerminalFailure({
  id: job.id,
  attemptCount: nextAttempt,
  errorMessage: job.errorMessage ?? terminalError,
  userEmail: job.subscription?.user?.email ?? null,
  robotName: job.robot?.name ?? null,
});
```
**Dedup:** since `notifyTerminalFailure` now fires the admin alert per failed job, REMOVE the reaper's separate `tryFireAlert('job-failed', () => sendAdminCompilerAlertEmail({kind:'job-failed',...}))` block (and its now-unused pieces) to avoid double admin alerts. KEEP the `stale-heartbeat` alert block untouched (worker-health, not a job). Import `notifyTerminalFailure`; drop the now-unused `sendAdminCompilerAlertEmail` import ONLY if the stale-heartbeat block no longer uses it — it DOES still use it, so keep that import. Re-check `tryFireAlert`/`lastAlertAt` are still referenced (stale-heartbeat still uses them) before deleting anything.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q 'notifyTerminalFailure(' src/app/api/compiler/complete/route.ts && echo COMPLETE_WIRED_OK
grep -q 'notifyTerminalFailure(' src/app/api/compiler/reap/route.ts && echo REAP_WIRED_OK
# reaper still selects user email + robot name:
grep -q 'user: { select: { email: true } }' src/app/api/compiler/reap/route.ts && echo REAP_SELECT_OK
# reaper stale-heartbeat alert still present:
grep -q "kind: 'stale-heartbeat'" src/app/api/compiler/reap/route.ts && echo STALE_KEPT_OK
# no duplicate job-failed admin alert left in the reaper loop (job-failed now via notify):
! grep -q "tryFireAlert('job-failed'" src/app/api/compiler/reap/route.ts && echo NO_DUP_ADMIN_ALERT_OK
npx tsc --noEmit && npx eslint src/app/api/compiler/complete/route.ts src/app/api/compiler/reap/route.ts
```
  </verify>
  <done>Both terminal-FAILED paths call `notifyTerminalFailure`; reaper selects user/robot, keeps stale-heartbeat alert, and no longer double-fires the job-failed admin alert; response contracts unchanged; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 3: Dashboard FAILED support link (DLVR-03) + admin dashboard flag (DLVR-04) + browser verify</name>
  <files>src/components/dashboard/LicenseManager.tsx, src/app/[locale]/dashboard/admin/page.tsx, .claude/launch.json</files>
  <action>
**3a. `LicenseManager.tsx`** — strengthen the FAILED state (currently just `t("failedCheckLater")`). When `compilation.status === "FAILED"`, render a clear failure message plus a support link (a `<Link href="/support">Contact support</Link>` or `mailto:hello@al-ai-fx.xyz` — match Task 1's SUPPORT_URL choice). Keep the existing status color logic. Do not remove the existing retry/compile affordances.

**3b. `admin/page.tsx`** — add the DLVR-04 dashboard flag. In the Server Component, after the existing queries, add:
```ts
import { HEARTBEAT_DEAD_SECONDS } from "@/lib/compiler-config";
// ...
const hb = await prisma.workerHeartbeat.findUnique({ where: { id: "compiler" } });
const hbAgeSec = hb ? Math.floor((Date.now() - hb.lastSeenAt.getTime()) / 1000) : null;
const heartbeatStale = hbAgeSec === null || hbAgeSec > HEARTBEAT_DEAD_SECONDS;
const dayAgo = new Date(Date.now() - 24 * 60 * 60_000);
const recentFailures = await prisma.compilation.count({
  where: { status: "FAILED", updatedAt: { gte: dayAgo } },
});
```
Render a red alert banner near the top of the admin overview when `heartbeatStale || recentFailures > 0`, e.g. "Compile worker offline (last seen Ns ago)" and/or "N compile job(s) failed in the last 24h — check the pipeline." This is the browser-verifiable DLVR-04 half that does not depend on Mailtrap. (Confirm `WorkerHeartbeat` field name `lastSeenAt` against schema.)

**3c. Browser verification** (dev server "web" config as in earlier plans):
1. Start dev server, log in as ADMIN, open `/dashboard/admin`. If the heartbeat is stale (dev VM offline) or there are recent FAILED jobs, confirm the red flag banner renders (`preview_snapshot`/`preview_screenshot`). If neither condition holds, temporarily insert a FAILED compilation row (or set the heartbeat old) via a scratch node script against the dev DB to force the banner, confirm it shows, then revert.
2. Drive a job to terminal FAILED via a POST to `/api/compiler/complete` (with `COMPILER_SECRET`, `status:'FAILED'`, on a job whose `attemptCount` is already `MAX_ATTEMPTS-1`) and confirm the server log shows the notify path ran: `[Mail] ... Skipping compile-failed email` + `[Mail] ... Skipping admin alert` (no-op-safe, MAILTRAP unset) and the response is still 200 `{success:false, requeued:false}`. This proves both sends fire best-effort and neither fails the request.
3. As a user with a FAILED job, open `/dashboard/licenses` and confirm the failure message + support link render (`preview_snapshot`).
Capture screenshots of the admin flag banner and the user FAILED state for the SUMMARY.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q 'HEARTBEAT_DEAD_SECONDS' "src/app/[locale]/dashboard/admin/page.tsx" && echo FLAG_HB_OK
grep -q "status: \"FAILED\"" "src/app/[locale]/dashboard/admin/page.tsx" && echo FLAG_FAILCOUNT_OK
grep -qiE 'support|contact|mailto' src/components/dashboard/LicenseManager.tsx && echo SUPPORT_LINK_OK
npx tsc --noEmit && npx eslint src/components/dashboard/LicenseManager.tsx "src/app/[locale]/dashboard/admin/page.tsx"
```
  Plus browser checks: admin flag banner renders on stale-heartbeat/recent-failure; terminal FAILED via /complete runs notify best-effort (warns, still 200); user FAILED state shows support link.
  </verify>
  <done>Dashboard FAILED state has a support link; admin overview shows a red flag on stale heartbeat OR recent failures (Mailtrap-independent); a terminal FAILED via /complete fires both notify sends best-effort without failing the request; all verified in browser with screenshots; tsc + eslint clean.</done>
</task>

</tasks>

<verification>
- Both terminal-FAILED paths (`/complete` retries-exhausted + `/reap` stuck-job) call the single `notifyTerminalFailure` (user email + admin alert), best-effort.
- Reaper keeps its stale-heartbeat alert and no longer double-fires the job-failed admin alert.
- `sendCompileFailedEmail` is no-op-safe; the helper never throws; response contracts unchanged.
- Dashboard FAILED state shows a support link (DLVR-03); admin overview shows a red flag on stale heartbeat / recent failures (DLVR-04, Mailtrap-independent).
- `npx tsc --noEmit` + `npx eslint` clean; browser verification passed.
- OUTSTANDING (documented, non-blocking): provision `MAILTRAP_TOKEN` + `ADMIN_ALERT_EMAIL` in Vercel to physically send the failure/alert emails.
</verification>

<success_criteria>
- DLVR-03: terminal failure emails the user (support link) + shows a dashboard failure state — email best-effort/no-op-safe, dashboard state verified now.
- DLVR-04: admin is alerted on retry-exhaustion (both paths) and server-offline (reaper stale-heartbeat) via email, AND via a browser-verifiable dashboard flag — criterion 5 satisfiable without Mailtrap.
- No silent terminal failures (both write sites notify).
- Phase success criteria 4 & 5 met (dashboard channels verified now; email channels complete + gated only on the user's Mailtrap token).
</success_criteria>

<output>
After completion, create `.planning/phases/05-admin-catalog-delivery-loop/05-04-SUMMARY.md` with frontmatter: `phase`, `plan`, `status: complete`, `requirements: [DLVR-03, DLVR-04]`, `files_changed`, `commits`, `key_decisions` (single notifyTerminalFailure from both terminal sites; helper does user email + admin alert, reaper drops its duplicate job-failed alert but keeps stale-heartbeat; dashboard flag = stale-heartbeat OR recent-FAILED-count as the Mailtrap-independent DLVR-04 half; support link source), and `provides`. CRITICALLY record under `outstanding_manual_setup`: **provision `MAILTRAP_TOKEN` + `ADMIN_ALERT_EMAIL` (+`SMTP_FROM_EMAIL`) in all 3 Vercel scopes** to physically send the delivery/failure/alert emails — the code path is complete and no-op-safe; this is the same non-blocking manual gap noted since Phase 1. Note the phase's dashboard channels satisfy all 5 success criteria in-browser without it.
</output>
