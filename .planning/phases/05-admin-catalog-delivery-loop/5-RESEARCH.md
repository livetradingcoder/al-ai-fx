# Phase 5: Admin Catalog + Delivery Loop - Research

**Researched:** 2026-07-06
**Domain:** Next.js 16 admin CRUD (Server Actions) + Mailtrap transactional email + signed download links + admin alerting
**Confidence:** HIGH (codebase patterns verified by reading source; Next 16 verified against bundled docs; one MEDIUM external dependency — Mailtrap credentials must be user-provided)

> **No CONTEXT.md** — user said "don't ask, just implement." Full discretion. No `## User Constraints` section applies. Recommendations below are prescriptive.

---

## Summary

This phase is **~80% wiring, 20% new infrastructure**, almost entirely inside the existing Next.js app — no VM/daemon involvement. Every pattern this phase needs already exists in the codebase and just needs to be extended to a new resource (`Robot`) and a new event (compile COMPLETED/FAILED):

- **Admin CRUD (ADMN-01..05)** copies the proven `dashboard/admin/users/` trio verbatim: a Server-Component `page.tsx` (role gate → `redirect('/dashboard')`), a `"use server"` `actions.ts` (role gate → `throw`, mutate, `revalidatePath`), and a `"use client"` table/form. Source-version upload (ADMN-04) reuses `uploadEncryptedSource()` + bumps `Robot.sourceVersion` — the helper already exists and is battle-tested (GoldBot v1 lives in Blob today).
- **Delivery loop (DLVR-01..04)** hooks the `Compilation` status transitions that already exist. The dashboard channel is **already 90% built** — `LicenseManager` already renders a Download button on COMPLETED and a failure line on FAILED. The email channel and the admin alert are the genuinely new work.

**The one hard blocker, verified this session:** **no mail credentials exist in Vercel production.** `vercel env ls production` shows NO `MAILTRAP_TOKEN`, no `SMTP_*`, no `ADMIN_ALERT_EMAIL`. `src/lib/mail.ts` initializes `client = null` and **every email function is a silent no-op today**, including `sendPurchaseConfirmationEmail` (so Phase 2 "purchase confirmation" emails have never actually sent in prod) and `sendAdminCompilerAlertEmail`. DLVR-01/03/04 email channels **cannot be verified as working** until the user provisions a real Mailtrap sending token. This must be surfaced as a plan-blocking preflight, not discovered at execution.

**Primary recommendation:** Structure as the roadmap's 4 plans. Plans 05-01/05-02 (admin CRUD) are independent of the mail blocker and can land first. Plan 05-03/05-04 (delivery emails) each need a preflight step that provisions `MAILTRAP_TOKEN` + `ADMIN_ALERT_EMAIL` via `vercel env add` (requires the user to supply a Mailtrap token — Claude cannot self-provision one). **Scope ADMN-03's "pricing tiers" to metadata-only this phase; defer per-robot pricing rows to Phase 6, which explicitly owns PRIC-01.** For the emailed "signed, expiring download link" (DLVR-01), reuse the existing **magic-link JWT** pattern (`src/lib/magic-links.ts` + `createUserMagicLink`) rather than hand-rolling a new HMAC scheme.

---

## Current-State Facts (verified this session — the planner should trust these over assumptions)

### Delivery flow as it actually works today
1. Compile is triggered from **`PUT /api/licenses/update-mt5`** (when the user binds/changes their MT5 account), NOT from purchase. That route creates the `Compilation` row (`status: PENDING`, denormalized `robotId` + `sourceVersion`). — `src/app/api/licenses/update-mt5/route.ts:50`
2. The VM daemon polls, compiles, uploads to private Blob, and calls **`POST /api/compiler/complete`** with `status: COMPLETED|FAILED`. This route is the **single transition point** for both DLVR-01 (COMPLETED) and the per-job DLVR-03 (terminal FAILED). — `src/app/api/compiler/complete/route.ts`
3. The **reaper** (`GET /api/compiler/reap`, CRON_SECRET-gated) is the *other* path a job reaches terminal FAILED (stuck-in-PROCESSING → retries exhausted) and is where the existing admin alert already fires. — `src/app/api/compiler/reap/route.ts`
4. Dashboard reads live status two ways: server-render (`dashboard/page.tsx` + `dashboard/licenses/page.tsx` load `compilations` ordered desc take 1) and client poll (`LicenseManager` → `GET /api/licenses/status?jobId=`). — `src/components/dashboard/LicenseManager.tsx`

**Implication for DLVR-01/02:** the "download button + status update" (DLVR-02, dashboard channel) **already exists** in `LicenseManager` (COMPLETED → `<a href="/api/compiler/download?jobId=">`). DLVR-02 is essentially DONE; the plan should verify it, not rebuild it. The new work is DLVR-01's **email** firing on the COMPLETED transition inside `/api/compiler/complete`.

**Implication for DLVR-03:** `LicenseManager` already shows a FAILED status line + `failedCheckLater` message. The dashboard failure state (DLVR-03 half) mostly exists but is thin — planner may want to strengthen it (support link, clearer copy). The **email** on terminal failure is new. Note: a per-job failure can arrive via `/complete` (`nextAttempt >= MAX_ATTEMPTS`) OR via `/reap` — **both terminal-FAILED sites must fire the user email**, or wire a shared helper both call.

### Mail infrastructure (BLOCKER — verify before planning 05-03/05-04)
- `src/lib/mail.ts`: `TOKEN = process.env.MAILTRAP_TOKEN || process.env.SMTP_PASS`. **Neither is set in Vercel production** (verified `vercel env ls production`). `client` is `null` → all sends are silent no-ops with a `console.warn`.
- `sendPurchaseConfirmationEmail(email, tier, expiresAt, magicLinkUrl)` and `sendAdminCompilerAlertEmail(payload)` already exist and are well-structured (shared `renderEmailTemplate`, gold-on-dark HTML). **Add new senders to this file following the same shape** — do not create a second mail module.
- `sendAdminCompilerAlertEmail` recipient = `ADMIN_ALERT_EMAIL || SMTP_FROM_EMAIL` (both currently unset → skips).
- **Full production env inventory (verified):** `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY`, `COMPILER_SECRET`, `CRON_SECRET`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `PAYGATE_WEBHOOK_SECRET`, `POSTGRES_URL`, `PRISMA_DATABASE_URL`, `SOURCE_ENCRYPTION_KEY`. **Absent:** `MAILTRAP_TOKEN`, `SMTP_*`, `ADMIN_ALERT_EMAIL`.

### Admin surface as it exists today
- `/dashboard/admin` (`page.tsx`): Server Component, role gate `session?.user?.role !== "ADMIN"` → `redirect("/dashboard")`. Renders stat cards, `<CompileServerStatus>` tile, recent subscriptions/orders tables, and a read-only "SMTP Configuration" panel. **No robot management yet.**
- `/dashboard/admin/users`: the **canonical CRUD template** — `page.tsx` (server, role gate, `prisma.findMany`) + `actions.ts` (`"use server"`, role gate → `throw new Error("Unauthorized")`, mutate, `revalidatePath("/dashboard/admin/users")`) + `UsersTable.tsx` (`"use client"`, calls actions from `onClick`, `useState` loading, `confirm()`/`alert()`).
- `DashboardSidebar.tsx` (admin section) links only "Admin Overview" + "Manage Users". **A "Robots" / "Catalog" link must be added here** for the new page to be reachable.

### Schema / pricing
- `Robot` model has everything ADMN-01/02 metadata needs: `slug @unique`, `name`, `shortDescription`, `longDescription @db.Text`, `active`, `artworkUrl?`, `sortOrder`, `sourceVersion`. **No schema change needed for admin metadata CRUD.**
- **Pricing is global**, not per-robot: `src/config/pricing.ts` (`PRICING_TIERS` static map, 8 tiers) + `src/lib/pricing-tiers.ts` (`TIER_METADATA` SSoT). No `RobotPricing`/`RobotTier` table exists. **See Open Question 1** — recommend deferring per-robot pricing to Phase 6.

---

## Standard Stack

Everything needed is **already installed**. No new dependencies.

### Core (already in package.json — versions verified)
| Library | Version | Purpose | Why Standard (here) |
|---------|---------|---------|--------------|
| `next` | **16.2.3** | Server Actions, route handlers, `revalidatePath` | The app framework. ⚠️ Much newer than training — see State of the Art. |
| `react` / `react-dom` | 19.2.4 | `useState`, `useActionState`, `useTransition` | Client interactivity for admin forms/tables |
| `@prisma/client` | 6.19.3 | Robot CRUD, Compilation reads | Existing data layer; `prisma` singleton in `src/lib/prisma.ts` |
| `@vercel/blob` | 2.3.3 | Source upload (`put`), optional admin listing (`list`/`del`/`head`) | Verified exports: `put, list, del, head, get, copy`. `uploadEncryptedSource` already wraps `put`. |
| `mailtrap` | 4.5.1 | DLVR emails | `MailtrapClient` already wired in `src/lib/mail.ts` |
| `jsonwebtoken` | 9.0.3 | Signed expiring download link (reuse magic-link JWT) | `createMagicLinkToken`/`verifyMagicLinkToken` already exist |
| `next-auth` | 4.24.14 | `getServerSession(authOptions)` role gate | Established admin-gate pattern |
| `lucide-react` | 1.8.0 | Icons (optional, for admin UI polish) | Already a dep |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Magic-link JWT for DLVR-01 download link | New HMAC token module (à la `compiler-source-token.ts`) | JWT already carries `exp` + user identity and has a verified route (`/magic-login`) that lands the user *in the dashboard* where the Download button lives. A raw HMAC scheme would need a brand-new public download route + expiry logic. **Reuse the JWT.** |
| Server Actions for source upload | Route Handler (`POST`) + `fetch` | Server Actions are the app's convention (users CRUD). 1MB default body limit is *fine* — MQL5 source is a few KB. No reason to break convention. |
| Extending `mail.ts` | New email service/module | `mail.ts` has the shared template + Mailtrap client; adding functions there keeps one sender identity + one no-op guard. |

**Installation:** none. `npm install` not required.

---

## Architecture Patterns

### Recommended file layout (mirrors existing `admin/users/`)
```
src/app/[locale]/dashboard/admin/
├── page.tsx                    # existing — ADD a "Manage Robots" entry point / link
├── robots/                     # NEW (ADMN-01/02/03/04)
│   ├── page.tsx                # server: role gate → redirect; prisma.robot.findMany
│   ├── actions.ts              # "use server": createRobot, updateRobot, toggleRobotActive, uploadRobotSource
│   ├── RobotsTable.tsx         # "use client": list + active toggle + edit trigger
│   └── RobotForm.tsx           # "use client": add/edit metadata form + source-upload input
├── users/                      # existing template to copy
src/lib/
├── mail.ts                     # ADD sendCompileReadyEmail, sendCompileFailedEmail (+ extend admin alert if needed)
src/components/dashboard/
├── DashboardSidebar.tsx        # ADD "Robots" admin link
├── LicenseManager.tsx          # DLVR-02 already done; DLVR-03 strengthen failure UI (support link)
```

### Pattern 1: Admin Server Action (COPY from `users/actions.ts`)
**What:** `"use server"` file; every export re-checks the session role and throws on failure (Server Actions are reachable by direct POST — the Next 16 docs explicitly warn about this).
**When:** all of ADMN-01..04.
```ts
// Source: src/app/[locale]/dashboard/admin/users/actions.ts (existing, verified)
"use server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleRobotActive(robotId: string, currentActive: boolean) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized"); // ADMN-05
  await prisma.robot.update({ where: { id: robotId }, data: { active: !currentActive } });
  revalidatePath("/dashboard/admin/robots"); // + revalidatePath("/") later for public catalog (Phase 6)
  return { success: true };
}
```
> **Note (Next 16):** `revalidatePath` is the app's proven cache-refresh mechanism (used in `users/actions.ts`). Next 16 also adds `refresh()` from `next/cache` (client-router refresh) and `updateTag` — but stick with `revalidatePath` for consistency unless a plan has a specific reason. Verified against bundled docs `01-app/01-getting-started/07-mutating-data.md`.

### Pattern 2: Source-version upload (ADMN-04)
**What:** admin selects a `.mq5` file → Server Action reads it as a Buffer → `uploadEncryptedSource(slug, nextVersion, buf)` → bump `Robot.sourceVersion`. **Version is immutable** (`allowOverwrite:false`), so compute `nextVersion = robot.sourceVersion + 1` and upload to the *new* path before persisting the bump. Guard the bump inside a transaction / check the upload succeeded first.
```ts
// Uses existing src/lib/source-storage.ts (verified) — do NOT reimplement encryption/put
import { uploadEncryptedSource } from "@/lib/source-storage";

export async function uploadRobotSource(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");
  const robotId = String(formData.get("robotId"));
  const file = formData.get("source") as File;
  const robot = await prisma.robot.findUniqueOrThrow({ where: { id: robotId } });
  const nextVersion = robot.sourceVersion + 1;
  const buf = Buffer.from(await file.arrayBuffer());
  await uploadEncryptedSource(robot.slug, nextVersion, buf); // immutable put to sources/<slug>/v<N>.mq5.enc
  await prisma.robot.update({ where: { id: robotId }, data: { sourceVersion: nextVersion } });
  revalidatePath("/dashboard/admin/robots");
  return { success: true, version: nextVersion };
}
```
> **First upload for a brand-new robot (ADMN-02):** a robot created with default `sourceVersion:1` has NO blob at `v1` yet. Either (a) require the metadata-create and source-upload as two steps (create → then upload uploads to v1... but `nextVersion` logic would make it v2), or (b) special-case: if no source has ever been uploaded, upload to `v{current sourceVersion}` (=1) rather than +1. **Planner: decide and document the "first source" semantics explicitly.** Simplest: on create, DON'T pre-bump; treat the create form's optional file as v1 (upload to `v1`, leave `sourceVersion=1`); subsequent uploads do +1. A robot with no source uploaded cannot compile — that's acceptable (admin activates only after uploading).

### Pattern 3: DLVR-01 email on COMPLETED (hook `/api/compiler/complete`)
**What:** inside the `status === 'COMPLETED'` branch, after the DB update, fetch the user email + robot name and fire a "your build is ready" email carrying a **magic-link URL** (lands them in the dashboard where the Download button is). Fire-and-forget / try-catch — **never fail the `/complete` request because email failed** (this is an established rule — see `sendAdminCompilerAlertEmail` doc + reaper's fire-and-forget).
```ts
// after prisma.compilation.update({ ... status: 'COMPLETED' ... })
// need: job.subscription.user.email + robot.name + a magic link
// reuse createUserMagicLink pattern from src/lib/subscriptions.ts (JWT → /magic-login)
try {
  await sendCompileReadyEmail(email, robotName, magicLinkUrl); // NEW in mail.ts
} catch (e) { console.error("[complete] ready email failed:", e); } // best-effort
```
Requires the `findUnique`/`update` to `include: { subscription: { include: { user: true } }, robot: true }`. **`createUserMagicLink` currently lives module-private in `subscriptions.ts`** — either export it or move it to `magic-links.ts` for reuse (recommend the latter: a small `buildDashboardMagicLink({email,userId})` helper in `magic-links.ts`).

> **DLVR-01 "signed, expiring link":** the magic-link JWT is signed (`NEXTAUTH_SECRET`) and expiring (default 30m, configurable via `createMagicLinkToken` `expiresIn`). It satisfies "signed + expiring." The user clicks it → authenticated into dashboard → clicks Download → `/api/compiler/download` (session-gated, streams private Blob). This is cleaner than emailing a raw `/api/compiler/download` URL (which requires an *active browser session* and would 401 from an email client). **Recommended interpretation of DLVR-01.** If the planner instead wants a *direct* download from the email (no dashboard hop), that needs a NEW public route accepting an HMAC/JWT token bound to `jobId+exp` — more surface, more risk. Default to the magic-link hop.

### Pattern 4: DLVR-04 admin alert (EXTEND existing, don't duplicate)
**What already exists:** `/api/compiler/reap` fires `sendAdminCompilerAlertEmail` for BOTH triggers DLVR-04 names — `job-failed` (retries exhausted, per batch) and `stale-heartbeat` (server offline past `HEARTBEAT_DEAD_SECONDS`). Module-scope 15-min cooldown dedup. **DLVR-04 is ~70% already implemented by Phase 1's 01-04.**
**Gap analysis (planner must verify):**
- Reaper covers retry-exhaustion **only for jobs it reaps** (stuck-in-PROCESSING path). A job that exhausts retries via `/api/compiler/complete`'s FAILED branch (`nextAttempt >= MAX_ATTEMPTS`) does **NOT** currently fire an admin alert. **DLVR-04 net-new: fire `sendAdminCompilerAlertEmail({kind:'job-failed',...})` in the terminal branch of `/complete` too** (same site as the DLVR-03 user email — do both there).
- "server offline past threshold" (DLVR-04 half) is fully covered by reaper's `stale-heartbeat`. No new work beyond ensuring `ADMIN_ALERT_EMAIL` is provisioned so it actually sends.
- **Optional dashboard flag alternative:** DLVR-04 allows "email OR dashboard flag." A dashboard flag (e.g. a red banner on `/dashboard/admin` when latest heartbeat is stale or there are recent terminal-FAILED jobs) is a robust fallback given the mail-provisioning risk. `<CompileServerStatus>` already surfaces server health — planner could add a "recent failed compiles" count to the admin overview as the dashboard-flag half, making DLVR-04 satisfiable even if email stays unprovisioned. **Recommend implementing the dashboard flag regardless** (belt-and-suspenders, and unblocks verification without Mailtrap).

### Anti-Patterns to Avoid
- **Reimplementing encryption/upload.** `uploadEncryptedSource` + `encryptSource` are done and tested. Call them.
- **A second mail module / second sender identity.** Extend `src/lib/mail.ts`.
- **Emailing a session-gated `/api/compiler/download` URL directly.** It 401s without a browser session. Use the magic-link hop.
- **Letting an email failure throw inside `/complete` or `/reap`.** Established rule: alert/notify paths are best-effort, never fail the request.
- **Overwriting a source version.** `allowOverwrite:false` is intentional; always bump `sourceVersion`.
- **Adding a per-robot pricing table this phase.** That's Phase 6 (PRIC-01). See Open Q1.
- **Client-only admin gate.** Server Actions are directly POST-reachable (Next 16 docs warn explicitly) — the role check must be *inside every action*, not just on the page.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encrypting + versioning source upload | AES/GCM + Blob `put` by hand | `uploadEncryptedSource()` (`src/lib/source-storage.ts`) | Already handles key, IV, immutable pathname, private access |
| Signed expiring download/access link | New HMAC token + verify route | `createMagicLinkToken`/`buildMagicLinkUrl` (`src/lib/magic-links.ts`) | Signed + expiring + lands user authenticated in dashboard |
| Email sending + templating | New SMTP/Mailtrap client + HTML | Extend `src/lib/mail.ts` (`renderEmailTemplate`, `MailtrapClient`) | One sender identity, one no-op guard, consistent branding |
| Admin CRUD scaffolding | Bespoke forms/routes | Copy `dashboard/admin/users/` trio | Proven role-gate + `revalidatePath` + client-table pattern |
| Admin role authorization | New middleware | `getServerSession(authOptions)` + `role !== "ADMIN"` | Page → `redirect`; action/JSON → `throw`/403 (both established) |
| Compile-status polling on dashboard | New websocket/poll | `LicenseManager` + `/api/licenses/status` already do it | Bounded backoff poll already shipped in Phase 1 |

**Key insight:** this phase's risk is NOT novel engineering — it's *integration correctness* (firing side-effects at the right transition, on both terminal-FAILED paths) and *the external Mailtrap dependency*. Almost every building block is already in the repo.

---

## Common Pitfalls

### Pitfall 1: Assuming emails "work" because the code exists
**What goes wrong:** `sendPurchaseConfirmationEmail`/`sendAdminCompilerAlertEmail` are written and imported, so it *looks* wired — but `client === null` in prod (no token), so every send silently no-ops. A plan that "adds the email call" and calls it done will pass tsc/eslint and still deliver nothing.
**Root cause:** `MAILTRAP_TOKEN`/`SMTP_PASS` unset in Vercel production (verified).
**How to avoid:** Treat "provision `MAILTRAP_TOKEN` (+`ADMIN_ALERT_EMAIL`, +`SMTP_FROM_EMAIL`/`SMTP_FROM_NAME`) in all 3 Vercel scopes" as a **plan-blocking preflight** for 05-03/05-04, exactly as Phase 2 treated `PAYGATE_WEBHOOK_SECRET`. **Claude cannot self-provision a Mailtrap account/token** — the user must supply the token; then `echo "<token>" | vercel env add MAILTRAP_TOKEN production` (repeat preview/development). Verify with a real send to a Mailtrap inbox or the founder's email.
**Warning sign:** `[Mail] Mailtrap client not initialized` in Vercel logs.

### Pitfall 2: Only one of the two terminal-FAILED paths notifies
**What goes wrong:** you wire the DLVR-03 user email + DLVR-04 admin alert into `/api/compiler/reap` (which already alerts) but forget `/api/compiler/complete`'s FAILED-terminal branch (or vice-versa). Some failures notify, others hang silently — exactly the "no silent hangs" success criterion this phase must guarantee.
**Root cause:** two independent code paths reach `status: FAILED` (reaper stuck-scan vs daemon-reported failure past MAX_ATTEMPTS).
**How to avoid:** extract a single `notifyTerminalFailure(job)` helper (user email + admin alert) and call it from **both** sites. Grep for every `status: 'FAILED'` write.
**Warning sign:** a job with `status FAILED` and no corresponding log line from the notify helper.

### Pitfall 3: First-source-upload version off-by-one
**What goes wrong:** new robot defaults `sourceVersion:1`; a naive `nextVersion = current + 1` uploads the first real source to `v2`, leaving `v1` empty → compile fetches `v1` → 404. (Or an immutable `allowOverwrite:false` collision if you upload to `v1` twice.)
**How to avoid:** define explicit "first source" semantics (see Pattern 2 note). Recommend: create-with-file uploads to `v1` and leaves `sourceVersion=1`; later uploads do `+1`. Robots with no uploaded source stay `active:false` until first upload.
**Warning sign:** `/api/compiler/source` 404 for a newly-onboarded robot.

### Pitfall 4: Slug uniqueness / immutability on edit
**What goes wrong:** admin edits a robot's `slug` after sources exist at `sources/<oldSlug>/...` and compiled artifacts/subscriptions reference the old slug → orphaned Blob paths + broken downloads.
**How to avoid:** treat `slug` as **create-only, read-only on edit** (the schema comment already calls slug the "join key for Blob path + compiled filename"). Edit form should disable/omit slug. Enforce `@unique` collision → catch P2002 → friendly error.
**Warning sign:** download filename / source path mismatch after an edit.

### Pitfall 5: Server Action file upload body limit
**What goes wrong:** assuming Server Actions can take arbitrary uploads. Default body limit is **1MB** (verified in bundled docs).
**Reality:** MQL5 `.mq5` sources are a few KB → **well under 1MB, no config change needed.** Only relevant if artwork upload were added as a Server Action with large images — but `artworkUrl` is a URL field (paste a URL), not a binary upload, so no issue. Document that source upload stays small; if artwork *binary* upload is ever added, use direct-to-Blob client upload, not a Server Action.

### Pitfall 6: `revalidatePath` scope for the public catalog
**What goes wrong:** toggling a robot active/inactive revalidates only `/dashboard/admin/robots`; the (Phase 6) public catalog page stays stale.
**How to avoid:** this phase's admin actions should already `revalidatePath("/")` / the catalog path where a robot's visibility matters — but the public catalog doesn't exist until Phase 6. **Note for planner:** add the catalog-path revalidation when Phase 6 builds the catalog, or add it now defensively (harmless no-op if path doesn't render robots yet).

---

## Code Examples

### Robot list page (server, role-gated) — copy of users/page.tsx
```tsx
// Source: pattern from src/app/[locale]/dashboard/admin/users/page.tsx (verified)
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import RobotsTable from "./RobotsTable";

export default async function AdminRobotsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session?.user?.role !== "ADMIN") redirect("/dashboard");
  const robots = await prisma.robot.findMany({ orderBy: { sortOrder: "asc" } });
  return <RobotsTable robots={robots} />;
}
```

### DLVR-03/04 shared terminal-failure notifier
```ts
// NEW helper — called from BOTH /api/compiler/complete (terminal branch) and /api/compiler/reap
import { sendCompileFailedEmail, sendAdminCompilerAlertEmail } from "@/lib/mail";
export async function notifyTerminalFailure(job: {
  id: string; attemptCount: number; errorMessage: string | null;
  userEmail: string; robotName: string;
}) {
  // user email (DLVR-03) — best-effort, support link baked into template
  try { await sendCompileFailedEmail(job.userEmail, job.robotName, /*supportUrl*/); }
  catch (e) { console.error("[notify] user fail email:", e); }
  // admin alert (DLVR-04) — reuse existing sender
  try { await sendAdminCompilerAlertEmail({ kind: "job-failed", jobId: job.id, attempts: job.attemptCount, errorMessage: job.errorMessage ?? undefined }); }
  catch (e) { console.error("[notify] admin alert:", e); }
}
```

### New mail senders (extend mail.ts using existing renderEmailTemplate)
```ts
// Source: shape from src/lib/mail.ts (verified) — same guard + template
export async function sendCompileReadyEmail(email: string, robotName: string, magicLinkUrl: string) {
  if (!client) { console.warn("[Mail] client not init. Skip ready email."); return; }
  const { html, text } = renderEmailTemplate({
    buttonLabel: "Download your build", buttonUrl: magicLinkUrl,
    eyebrow: `${robotName} ready`, title: `Your ${robotName} build is ready`,
    intro: "Your compiled EA is ready. Open your dashboard to download the .ex5.",
    detailLines: [`Robot: ${robotName}`, "This secure link expires — request a new one from your dashboard if needed."],
  });
  await client.send({ from: sender, to: [{ email }], subject: `${robotName} — your build is ready`, html, text, category: "Delivery" });
}
```

---

## State of the Art (Next.js 16 — newer than training; verified against bundled docs)

> `AGENTS.md` warns: "This is NOT the Next.js you know." Read `node_modules/next/dist/docs/` before writing framework code. Findings below are from the bundled 16.2.3 docs.

| Old (training-era) | Next 16.2.3 (verified) | Impact |
|--------------------|------------------------|--------|
| `experimental.serverActions` flag | Server Actions **stable since 14, on by default** | No config needed |
| `revalidatePath` only | `revalidatePath` + **`refresh()`** (client-router) + **`updateTag`/`revalidateTag`** | Use `revalidatePath` for app consistency; `refresh()` available if needed |
| Sync `cookies()`/`headers()`/route `params` | **async** — `await cookies()`, `params` is a Promise (already handled in existing `[locale]` code) | Don't call sync; existing code already awaits |
| Server Actions "internal only" | Docs **explicitly warn** actions are directly POST-reachable | Role check **inside every action** (already the pattern) |

**Deprecated/outdated to avoid:** don't gate Server Actions behind an experimental flag; don't assume `params`/`cookies` are sync; don't rely on `next/router` (app dir uses `next/navigation`).

**Verified stable + safe to use:** `"use server"` files, `getServerSession(authOptions)` inside actions, `revalidatePath` from `next/cache`, `useActionState`/`useTransition` for pending UI, `redirect` from `next/navigation`.

---

## Open Questions

1. **Does ADMN-03 "edit ... pricing tiers" require a schema change this phase?**
   - **What we know:** pricing is currently **global** (`src/config/pricing.ts` static map + `pricing-tiers.ts` SSoT). No per-robot pricing table. Phase 6 **explicitly owns** per-robot pricing (PRIC-01 "per-robot pricing rows", CTLG-02/03, TRIL-*). Roadmap Phase 6 success criterion 3: "Each active robot has its own set of pricing rows … with independent prices."
   - **What's unclear:** whether ADMN-03 expects *functional* per-robot tier editing now, or metadata-only.
   - **Recommendation (HIGH confidence):** **Scope ADMN-03 to metadata-only this phase** (name, slug [create-only], descriptions, artworkUrl, sortOrder, active, source version). Do NOT add a `RobotPricing` table now — that duplicates/conflicts with Phase 6's PRIC-01 schema work. If a plan wants a token gesture toward "pricing tiers," it can render the existing global `PRICING_TIERS` **read-only** on the robot edit page with a "per-robot pricing arrives in the catalog phase" note. This keeps the phase honest to its dependency graph and avoids schema churn. **Flag this scoping decision to the user in the plan.**

2. **DLVR-01 link style: magic-link hop vs direct download token?**
   - **Recommendation:** magic-link hop (reuse JWT, lands in dashboard, no new public route). Documented in Pattern 3. Only build a direct-download token route if the user explicitly wants one-click download from the email.

3. **Can DLVR-04 be satisfied without provisioning Mailtrap?**
   - DLVR-04 allows "email OR dashboard flag." A dashboard flag (stale-heartbeat banner + recent-terminal-failures count on `/dashboard/admin`) satisfies it **without** the mail dependency and is verifiable in-browser. **Recommend implementing the dashboard flag regardless**, treating the admin *email* alert as the already-built bonus (reaper) that lights up once `ADMIN_ALERT_EMAIL` is provisioned. This de-risks the phase against the Mailtrap blocker.

4. **Where does `createUserMagicLink` live for reuse?**
   - Currently module-private in `src/lib/subscriptions.ts`. Recommend extracting a `buildDashboardMagicLink({email, userId})` into `src/lib/magic-links.ts` so both `subscriptions.ts` and `/api/compiler/complete` can call it without a circular/awkward import.

---

## Verification Norms for This Phase (flag to planner)

This phase is **heavily UI-facing** (admin robot table/forms, dashboard download/failure states). Per project norms, plans must be verified **in a browser** (dev server + preview tools), not just `tsc --noEmit` + `eslint`:
- Admin robot list renders; active toggle flips + persists; add-robot form creates a row; edit updates metadata; source upload bumps `sourceVersion` + writes a new Blob object; **non-admin session is redirected/403** (test both page and direct action POST).
- Dashboard: COMPLETED → Download button works (already built — regression-check); terminal FAILED → failure state + support link shows.
- Emails: send to a real Mailtrap inbox (requires the token preflight) — confirm the "ready" email's magic link authenticates into the dashboard, and the "failed" email renders with support link. If Mailtrap can't be provisioned during execution, the dashboard channels (DLVR-02/03 dashboard halves, DLVR-04 flag) must still be independently verifiable — that's the "either alone unblocks the user" success criterion.

**Environment note:** Node on PATH is broken v11 — use `/Users/klev/.nvm/versions/node/v20.15.1/bin/node`. Remote DB changes (if any — this phase likely needs none) go through the build-step channel. No VM/SSH involvement expected.

---

## Sources

### Primary (HIGH confidence)
- **Codebase (read this session):** `prisma/schema.prisma`, `src/lib/mail.ts`, `src/lib/subscriptions.ts`, `src/lib/magic-links.ts`, `src/lib/source-storage.ts`, `src/lib/compiler-source-token.ts`, `src/app/api/compiler/{complete,download,reap,source}/route.ts`, `src/app/api/licenses/{status,update-mt5}/route.ts`, `src/app/[locale]/dashboard/{page,admin/page,admin/users/*}.tsx`, `src/components/dashboard/{LicenseManager,DashboardSidebar}.tsx`, `src/config/pricing.ts`, `next.config.ts`, `package.json`.
- **Vercel env (verified live):** `vercel env ls production` — confirmed NO `MAILTRAP_TOKEN`/`SMTP_*`/`ADMIN_ALERT_EMAIL`; full inventory listed in Current-State Facts.
- **Next.js 16.2.3 bundled docs:** `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` (Server Actions, `revalidatePath`/`refresh`/`updateTag`, direct-POST warning), `.../03-api-reference/05-config/01-next-config-js/serverActions.md` (1MB body limit).
- **`@vercel/blob` 2.3.3:** verified exports `put, list, del, head, get, copy` from `dist/index.cjs`.
- **Roadmap/STATE:** `.planning/ROADMAP.md` (Phase 5/6 requirement ownership), `.planning/STATE.md` (decision log).

### Secondary (MEDIUM confidence)
- Mailtrap token provisioning is an external, user-gated step — cannot be verified working until the user supplies a token. The *code path* is HIGH confidence; the *credential availability* is MEDIUM/blocked.

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all deps installed + versions read from `package.json`/`node_modules`.
- Architecture: **HIGH** — every pattern copied from verified existing code; Next 16 specifics checked against bundled docs.
- Pitfalls: **HIGH** — derived from reading the actual flow (two FAILED paths, mail no-op, version immutability) not speculation.
- External dependency (Mailtrap creds): **BLOCKED/MEDIUM** — requires user action.

**Research date:** 2026-07-06
**Valid until:** ~2026-08-06 (stable stack; re-check if Next minor bumps or Mailtrap creds change)
