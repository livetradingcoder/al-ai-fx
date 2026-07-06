---
phase: 05-admin-catalog-delivery-loop
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/magic-links.ts
  - src/lib/mail.ts
  - src/app/api/compiler/complete/route.ts
user_setup:
  - service: mailtrap
    why: "Transactional delivery emails (compile-ready). Code path is complete and no-op-safe without it; email only physically sends once the token is provisioned."
    env_vars:
      - name: MAILTRAP_TOKEN
        source: "Mailtrap dashboard -> Sending Domains -> API Tokens (user must supply; Claude cannot self-register a Mailtrap account)"
      - name: SMTP_FROM_EMAIL
        source: "Verified sender on the Mailtrap sending domain (e.g. hello@al-ai-fx.xyz)"
autonomous: true

must_haves:
  truths:
    - "When /api/compiler/complete receives status COMPLETED, after the DB update it fires a best-effort compile-ready email to the buying user carrying a signed, expiring magic-link URL that lands them in the dashboard"
    - "The email send is fire-and-forget / try-catch — an email failure NEVER fails the /complete request or bricks a good compile (established rule: notify paths are best-effort)"
    - "The signed link reuses the existing magic-link JWT (NEXTAUTH_SECRET-signed, expiring) via a shared buildDashboardMagicLink helper in magic-links.ts — NO new HMAC scheme, NO new public download route"
    - "sendCompileReadyEmail follows the existing mail.ts shape: guarded by `if (!client) { console.warn; return; }` so it is a correct no-op when MAILTRAP_TOKEN is unset (does not throw)"
    - "The dashboard download channel (DLVR-02) still works: a COMPLETED job shows a working Download button in LicenseManager that streams the .ex5 via the robot-aware /api/compiler/download — verified, not rebuilt"
    - "buildDashboardMagicLink is exported from magic-links.ts and subscriptions.ts's private createUserMagicLink is refactored to use it (no behavior change, no circular import)"
    - "npx tsc --noEmit + eslint pass; the COMPLETED path is exercised and the dashboard Download button verified in a browser"
  artifacts:
    - path: "src/lib/magic-links.ts"
      provides: "Exported buildDashboardMagicLink({email,userId}) helper"
      contains: "export function buildDashboardMagicLink"
    - path: "src/lib/mail.ts"
      provides: "sendCompileReadyEmail sender (no-op-safe)"
      contains: "sendCompileReadyEmail"
    - path: "src/app/api/compiler/complete/route.ts"
      provides: "compile-ready email fired on COMPLETED transition (best-effort)"
      contains: "sendCompileReadyEmail"
  key_links:
    - from: "src/app/api/compiler/complete/route.ts"
      to: "src/lib/mail.ts sendCompileReadyEmail"
      via: "best-effort try/catch after COMPLETED update"
      pattern: "sendCompileReadyEmail\\("
    - from: "src/app/api/compiler/complete/route.ts"
      to: "src/lib/magic-links.ts buildDashboardMagicLink"
      via: "builds signed expiring dashboard link for the email"
      pattern: "buildDashboardMagicLink"
    - from: "src/lib/mail.ts sendCompileReadyEmail"
      to: "renderEmailTemplate + client.send"
      via: "same template + no-op guard as existing senders"
      pattern: "renderEmailTemplate"
---

<objective>
Wire the **success half of the delivery loop (DLVR-01)**: on the `COMPLETED` transition in `/api/compiler/complete`, send the buying user a "your build is ready" email carrying a **signed, expiring magic-link** that lands them authenticated in the dashboard where the Download button lives. Reuse the existing magic-link JWT (extracted into a shared `buildDashboardMagicLink` helper) and the existing `mail.ts` template + no-op guard. Also **verify** the already-built dashboard Download channel (DLVR-02) still works with the robot-aware `/download`.

Purpose: Satisfies success criterion 3 ("On successful compile, user gets Mailtrap email with signed expiring download link AND dashboard Download button").

**Mailtrap note (NON-BLOCKING — documented per phase guidance):** `mail.ts` initializes `client = null` when `MAILTRAP_TOKEN` is unset, so `sendCompileReadyEmail` is a silent, correct no-op today. This plan ships the FULL, correct code path now — it is complete and verifiable (COMPLETED transition fires the call; the call no-ops safely). Physically delivering the email requires the user to provision `MAILTRAP_TOKEN` + `SMTP_FROM_EMAIL` in Vercel (see `user_setup`). This is an outstanding manual step, NOT a blocker for plan completion — the dashboard Download channel (DLVR-02) independently satisfies the "user can get their build" outcome and IS browser-verifiable now.

Output:
- `src/lib/magic-links.ts` — exported `buildDashboardMagicLink({email,userId})`
- `src/lib/mail.ts` — `sendCompileReadyEmail(email, robotName, magicLinkUrl)`
- `src/app/api/compiler/complete/route.ts` — fire the email best-effort on COMPLETED
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
@src/lib/mail.ts
@src/lib/magic-links.ts
@src/lib/subscriptions.ts
@src/app/api/compiler/complete/route.ts
@src/components/dashboard/LicenseManager.tsx
@prisma/schema.prisma
@AGENTS.md
</context>

<critical_environment_notes>
- **Node:** prepend `export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"` for every node/npx/tsc/eslint/dev call.
- **Best-effort rule (LOCKED, from Phase 1):** the email send inside `/complete` MUST be wrapped in try/catch and MUST NOT change the response. A COMPLETED compile must still return 200 even if Mailtrap throws or is unconfigured. Mirror the reaper's fire-and-forget + `sendAdminCompilerAlertEmail`'s no-op guard.
- **Reuse the magic-link JWT** (`createMagicLinkToken`/`buildMagicLinkUrl`, `NEXTAUTH_SECRET`-signed, default 30m expiry). `subscriptions.ts` has a PRIVATE `createUserMagicLink({email,userId})` doing exactly this — LIFT it into `magic-links.ts` as `buildDashboardMagicLink` and re-point `subscriptions.ts` to the exported version (no behavior change, avoids circular import). Do NOT invent a new HMAC token or a new public download route.
- **Do NOT email a raw `/api/compiler/download` URL** — it is session-gated and 401s from an email client. The magic link → dashboard → Download button is the correct hop.
- **complete/route.ts already includes** `robot: { select: { slug: true } }`. To get the user email + robot name for the email, widen the `findUnique` include to `{ robot: { select: { slug: true, name: true } }, subscription: { include: { user: { select: { id: true, email: true } } } } }`. Verify the exact relation names against `schema.prisma` (Compilation → subscription → user; Compilation → robot).
- **Next 16:** route handler; keep the existing 200/400/401/404 contract exactly — only ADD the best-effort email after the COMPLETED update.
</critical_environment_notes>

<tasks>

<task type="auto">
  <name>Task 1: Extract buildDashboardMagicLink + add sendCompileReadyEmail</name>
  <files>src/lib/magic-links.ts, src/lib/subscriptions.ts, src/lib/mail.ts</files>
  <action>
**1a. `magic-links.ts`** — add an exported helper lifting `subscriptions.ts`'s private `createUserMagicLink`:
```ts
export function buildDashboardMagicLink(input: { email: string; userId: string }) {
  const secret = process.env.NEXTAUTH_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz";
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to issue magic links.");
  const token = createMagicLinkToken(
    { email: input.email, purpose: "login", userId: input.userId },
    secret,
  );
  return buildMagicLinkUrl({ baseUrl, locale: "en", token });
}
```
(This file already imports `jsonwebtoken` as `createMagicLinkToken`/`buildMagicLinkUrl` are defined here — reuse them directly, no new imports needed.)

**1b. `subscriptions.ts`** — replace the private `createUserMagicLink` function body with a thin re-export/wrapper so there is ONE implementation:
  - Import `{ buildDashboardMagicLink }` from `@/lib/magic-links`.
  - Either delete the local `createUserMagicLink` and call `buildDashboardMagicLink(...)` at the existing call site (line ~136), OR keep `createUserMagicLink = buildDashboardMagicLink`. Prefer replacing the call site and removing the dead local. No behavior change; verify `provisionSubscription` still builds the same link.

**1c. `mail.ts`** — add the new sender following the EXACT shape of `sendPurchaseConfirmationEmail` (same `if (!client)` guard, same `renderEmailTemplate` + `client.send`):
```ts
export async function sendCompileReadyEmail(
  email: string,
  robotName: string,
  magicLinkUrl: string,
) {
  if (!client) {
    console.warn("[Mail] Mailtrap client not initialized. Skipping compile-ready email.");
    return;
  }
  const { html, text } = renderEmailTemplate({
    buttonLabel: "Open your dashboard",
    buttonUrl: magicLinkUrl,
    eyebrow: "Build ready",
    title: `Your ${robotName} build is ready`,
    intro: "Your compiled, account-locked EA has finished building. Open your dashboard with the secure link below to download the .ex5.",
    detailLines: [
      `Robot: ${robotName}`,
      "This secure sign-in link is time-limited — if it expires, request a fresh one from your dashboard.",
    ],
  });
  await client.send({
    from: sender,
    to: [{ email }],
    subject: `${robotName} — your build is ready`,
    html,
    text,
    category: "Delivery",
  });
  console.log(`[Mail] Compile-ready email sent to ${email}`);
}
```
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q 'export function buildDashboardMagicLink' src/lib/magic-links.ts && echo HELPER_OK
grep -q 'buildDashboardMagicLink' src/lib/subscriptions.ts && echo SUBS_REPOINT_OK
grep -q 'export async function sendCompileReadyEmail' src/lib/mail.ts && echo SENDER_OK
grep -q 'if (!client)' src/lib/mail.ts && echo NOOP_GUARD_OK
npx tsc --noEmit && npx eslint src/lib/magic-links.ts src/lib/subscriptions.ts src/lib/mail.ts
```
  </verify>
  <done>`buildDashboardMagicLink` exported + reused by subscriptions (single impl); `sendCompileReadyEmail` added with the no-op guard + shared template; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 2: Fire compile-ready email on the COMPLETED transition</name>
  <files>src/app/api/compiler/complete/route.ts</files>
  <action>
Add the best-effort email to the `status === 'COMPLETED'` branch AFTER the `prisma.compilation.update({ ... status:'COMPLETED' ... })` succeeds. Do NOT alter the FAILED path (Plan 05-04 owns terminal-failure notifications) and do NOT change the 200 response contract.

1. Widen the `findUnique` include to load the user email + robot name:
```ts
const job = await prisma.compilation.findUnique({
  where: { id: jobId },
  include: {
    robot: { select: { slug: true, name: true } },
    subscription: { include: { user: { select: { id: true, email: true } } } },
  },
});
```
(Verify relation names against schema: Compilation.robot, Compilation.subscription, Subscription.user.)

2. Import the helpers at the top:
```ts
import { sendCompileReadyEmail } from '@/lib/mail';
import { buildDashboardMagicLink } from '@/lib/magic-links';
```

3. In the COMPLETED branch, after the update returns, fire best-effort:
```ts
// DLVR-01: notify the buying user their build is ready — best-effort, never fail /complete.
try {
  const user = job.subscription?.user;
  if (user?.email) {
    const magicLinkUrl = buildDashboardMagicLink({ email: user.email, userId: user.id });
    await sendCompileReadyEmail(user.email, job.robot.name, magicLinkUrl);
  }
} catch (e) {
  console.error(`[complete] compile-ready email failed for job ${jobId}:`, e);
}
```
Keep this INSIDE the COMPLETED branch, after the DB write, before `return NextResponse.json({ success: true }, { status: 200 })`. The email path must never throw out of the handler.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q 'sendCompileReadyEmail(' src/app/api/compiler/complete/route.ts && echo FIRE_OK
grep -q 'buildDashboardMagicLink' src/app/api/compiler/complete/route.ts && echo LINK_OK
grep -q 'subscription: { include: { user:' src/app/api/compiler/complete/route.ts && echo INCLUDE_OK
# best-effort: the send is inside a try/catch (a catch logging [complete] exists):
grep -q "\[complete\] compile-ready email failed" src/app/api/compiler/complete/route.ts && echo BEST_EFFORT_OK
npx tsc --noEmit && npx eslint src/app/api/compiler/complete/route.ts
```
  </verify>
  <done>COMPLETED branch fires `sendCompileReadyEmail` with a `buildDashboardMagicLink` URL, best-effort (try/catch), after the DB update, without changing the response contract; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 3: Verify dashboard Download channel (DLVR-02) + no-op-safe email path</name>
  <files>.claude/launch.json</files>
  <action>
DLVR-02 (dashboard Download button) already exists in `LicenseManager` — VERIFY it, don't rebuild it. Also confirm the new email path is no-op-safe with MAILTRAP_TOKEN unset (the current local/dev state).

1. Start the dev server (`preview_start`, "web" config as in earlier plans). Log in as a user who has a COMPLETED compilation (use the known completed job from Phase 4 — `cmr8s1ch90004gg4v41rcuky3` on GoldBot — or drive a job to COMPLETED).
2. Navigate to `/dashboard/licenses` (or `/dashboard`). Use `preview_snapshot` to confirm a "Download" button/link is shown for the COMPLETED build (`href` = `/api/compiler/download?jobId=...`).
3. `preview_click` the Download link (or fetch the href) and confirm it returns the `.ex5` (application/octet-stream) — check via `preview_network` that the download request is 200 with an octet-stream content type (robot-aware filename). This is the DLVR-02 regression check against the robot-aware `/download`.
4. No-op-safe check: exercise the COMPLETED path with MAILTRAP_TOKEN unset (dev). Either (a) drive a real job to COMPLETED via a POST to `/api/compiler/complete` with the `COMPILER_SECRET` and observe the server log shows `[Mail] Mailtrap client not initialized. Skipping compile-ready email.` (proving the send no-ops, not throws), and the response is still `{ success: true }` 200; OR (b) if driving a full job is impractical, assert via a targeted node/tsx invocation that `sendCompileReadyEmail(...)` returns without throwing when client is null. Confirm NO 500 and NO unhandled rejection.
Capture a `preview_screenshot` of the Download button for the SUMMARY.
  </action>
  <verify>
- `/dashboard/licenses` shows a working Download link for a COMPLETED job; the download returns `.ex5` (octet-stream, 200).
- Driving a COMPLETED transition with MAILTRAP_TOKEN unset logs the "client not initialized. Skipping compile-ready email" warning and still returns 200 (email no-ops, does not throw).
  </verify>
  <done>DLVR-02 dashboard Download confirmed working against robot-aware /download; the compile-ready email path is proven no-op-safe (warns + returns) when Mailtrap is unconfigured, and the COMPLETED request still succeeds.</done>
</task>

</tasks>

<verification>
- COMPLETED transition in `/api/compiler/complete` fires `sendCompileReadyEmail` with a signed expiring `buildDashboardMagicLink` URL, best-effort (try/catch), after the DB write.
- `sendCompileReadyEmail` is no-op-safe (`if (!client)` guard) — never throws when MAILTRAP_TOKEN is unset.
- `buildDashboardMagicLink` is the single magic-link implementation, reused by subscriptions.
- DLVR-02 dashboard Download button works with the robot-aware `/download` (verified, not rebuilt).
- `npx tsc --noEmit` + `npx eslint` clean; browser verification passed.
- OUTSTANDING (documented, non-blocking): provision `MAILTRAP_TOKEN` + `SMTP_FROM_EMAIL` in Vercel to physically send the email.
</verification>

<success_criteria>
- DLVR-01: on successful compile, the code path emails the user a signed, expiring dashboard link (physically sends once Mailtrap is provisioned; no-op-safe until then).
- DLVR-02: the dashboard Download button delivers the .ex5 (verified working).
- Phase success criterion 3 met (dashboard channel verified now; email channel complete + gated only on the user's Mailtrap token).
</success_criteria>

<output>
After completion, create `.planning/phases/05-admin-catalog-delivery-loop/05-03-SUMMARY.md` with frontmatter: `phase`, `plan`, `status: complete`, `requirements: [DLVR-01, DLVR-02]`, `files_changed`, `commits`, `key_decisions` (magic-link hop over direct-download token; single buildDashboardMagicLink impl; email best-effort inside COMPLETED branch; no-op-safe when Mailtrap unset), and `provides` — document the `sendCompileReadyEmail(email, robotName, magicLinkUrl)` signature and `buildDashboardMagicLink({email,userId})` export (Plan 05-04 reuses the same no-op-safe mail pattern). CRITICALLY record under an `outstanding_manual_setup` note: **provisioning `MAILTRAP_TOKEN` + `SMTP_FROM_EMAIL` (and `ADMIN_ALERT_EMAIL` for 05-04) in all 3 Vercel scopes is an outstanding user step** — the code is complete and no-op-safe; the same non-blocking treatment as Phase 1's original mail gap.
</output>
