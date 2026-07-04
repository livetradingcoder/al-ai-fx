---
phase: 01-restore-compile-delivery
plan: 04
type: execute
wave: 3
depends_on: ["01-01", "01-03"]
files_modified:
  - src/app/api/admin/compiler-status/route.ts
  - src/app/[locale]/dashboard/admin/page.tsx
  - src/components/dashboard/CompileServerStatus.tsx
  - src/lib/mail.ts
  - src/app/api/compiler/reap/route.ts
  - src/components/dashboard/LicenseManager.tsx
autonomous: true

user_setup:
  - service: mailtrap
    why: "Admin alert emails on stale heartbeat / retry-exhausted jobs — same Mailtrap account already used for welcome/purchase/reset emails"
    env_vars:
      - name: ADMIN_ALERT_EMAIL
        source: "Product owner's inbox (planner: klev / zubayer.munna.dev@gmail.com; confirm which to use)"

must_haves:
  truths:
    - "Admin dashboard at /dashboard/admin shows a Compile Server tile with green/stale/red status derived from WorkerHeartbeat.lastSeenAt"
    - "The tile also shows counts: PROCESSING (currently), PENDING > 5 min old, FAILED in last 24h"
    - "The status endpoint requires ADMIN role; USER role gets 403"
    - "Mailtrap sends an admin alert email when the reaper (a) transitions any job to FAILED after MAX_ATTEMPTS, OR (b) detects the heartbeat is stale past HEARTBEAT_DEAD_SECONDS — with idempotency (no email flood; deduped per event window)"
    - "LicenseManager client polling caps at CLIENT_POLL_TIMEOUT_MS (5 min) with exponential backoff from CLIENT_POLL_INITIAL_MS to CLIENT_POLL_MAX_MS"
    - "After the client timeout, LicenseManager shows a TIMED_OUT UI state ('Compilation is taking longer than expected — an email will be sent when ready') and stops making requests"
  artifacts:
    - path: "src/app/api/admin/compiler-status/route.ts"
      provides: "GET returning { status, lastSeenAgoSeconds, oldestPendingAgeSeconds, processingCount, stuckCount, failedLast24h }"
      exports: ["GET"]
    - path: "src/components/dashboard/CompileServerStatus.tsx"
      provides: "Client component that fetches /api/admin/compiler-status every 15s and renders the tile"
    - path: "src/lib/mail.ts"
      provides: "sendAdminCompilerAlertEmail(kind: 'stale-heartbeat' | 'job-failed', context)"
      exports: ["sendAdminCompilerAlertEmail"]
    - path: "src/app/api/compiler/reap/route.ts"
      provides: "Reaper (from Plan 03) extended to fire admin alerts on transitions to FAILED and on stale-heartbeat detection"
    - path: "src/components/dashboard/LicenseManager.tsx"
      provides: "Bounded polling loop with exponential backoff + TIMED_OUT terminal state"
  key_links:
    - from: "src/app/[locale]/dashboard/admin/page.tsx"
      to: "src/components/dashboard/CompileServerStatus.tsx"
      via: "Server component renders the client component"
      pattern: "<CompileServerStatus"
    - from: "src/components/dashboard/CompileServerStatus.tsx"
      to: "/api/admin/compiler-status"
      via: "fetch in setInterval"
      pattern: "fetch.*admin/compiler-status"
    - from: "src/app/api/compiler/reap/route.ts"
      to: "sendAdminCompilerAlertEmail"
      via: "import + call on FAILED transitions + on stale-heartbeat detection (deduped)"
      pattern: "sendAdminCompilerAlertEmail"
    - from: "src/components/dashboard/LicenseManager.tsx"
      to: "/api/licenses/status"
      via: "setTimeout-based loop with CLIENT_POLL_INITIAL_MS -> CLIENT_POLL_MAX_MS backoff + CLIENT_POLL_TIMEOUT_MS wall clock cap"
      pattern: "CLIENT_POLL_TIMEOUT_MS"
---

<objective>
Close the visibility + user-experience gaps. Three coordinated pieces:

1. Admin-only status endpoint + dashboard tile that turns the WorkerHeartbeat singleton (from Plan 03) into a green/stale/red indicator, plus job-queue health counters. Runs client-side polling at 15s so the admin can watch state without refreshing.
2. Admin email alerts — reuse the existing Mailtrap client in `src/lib/mail.ts`. Fire from the reaper (extended from Plan 03) on two events: any transition to permanent FAILED (retry-exhausted), and detection of stale heartbeat (heartbeat.lastSeenAt older than HEARTBEAT_DEAD_SECONDS). Dedupe by keeping a short in-memory cooldown per event kind.
3. Cap the client-side polling in `LicenseManager.tsx` — currently loops forever. New loop uses `setTimeout` with exponential backoff from CLIENT_POLL_INITIAL_MS to CLIENT_POLL_MAX_MS, hard wall-clock cap at CLIENT_POLL_TIMEOUT_MS, then transitions to a TIMED_OUT UI state.

Purpose: Addresses CMPL-01 (admin sees status), CMPL-02 (email alert on offline), Phase 1 success criterion 3 (no infinite polling from client), and closes the observability hole that made "server offline" go unnoticed for 2.5 months.

Output: New admin route + client tile + Mailtrap alert template + reaper alert integration + LicenseManager bounded polling.
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/01-restore-compile-delivery/1-RESEARCH.md
@src/app/[locale]/dashboard/admin/page.tsx
@src/components/dashboard/LicenseManager.tsx
@src/lib/mail.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Admin status endpoint + dashboard tile</name>
  <files>
src/app/api/admin/compiler-status/route.ts
src/components/dashboard/CompileServerStatus.tsx
src/app/[locale]/dashboard/admin/page.tsx
  </files>
  <action>
1. **Create `src/app/api/admin/compiler-status/route.ts`**:

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  HEARTBEAT_STALE_SECONDS,
  HEARTBEAT_DEAD_SECONDS,
  STUCK_JOB_MINUTES,
} from '@/lib/compiler-config';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return new Response('Forbidden', { status: 403 });
  }

  const now = new Date();
  const stuckCutoff = new Date(now.getTime() - STUCK_JOB_MINUTES * 60_000);
  const day = new Date(now.getTime() - 24 * 60 * 60_000);
  const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);

  const [heartbeat, oldestPending, processingCount, stuckCount, failedLast24h] = await Promise.all([
    prisma.workerHeartbeat.findUnique({ where: { id: 'compiler' } }),
    prisma.compilation.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.compilation.count({ where: { status: 'PROCESSING' } }),
    prisma.compilation.count({
      where: { status: 'PROCESSING', attemptedAt: { lt: stuckCutoff } },
    }),
    prisma.compilation.count({
      where: { status: 'FAILED', updatedAt: { gt: day } },
    }),
  ]);

  const lastSeenAgoSeconds = heartbeat
    ? Math.floor((now.getTime() - heartbeat.lastSeenAt.getTime()) / 1000)
    : null;

  let status: 'green' | 'stale' | 'red';
  if (lastSeenAgoSeconds === null || lastSeenAgoSeconds > HEARTBEAT_DEAD_SECONDS) status = 'red';
  else if (lastSeenAgoSeconds > HEARTBEAT_STALE_SECONDS) status = 'stale';
  else status = 'green';

  const oldestPendingAgeSeconds = oldestPending
    ? Math.floor((now.getTime() - oldestPending.createdAt.getTime()) / 1000)
    : null;

  return Response.json({
    status,
    lastSeenAgoSeconds,
    oldestPendingAgeSeconds,
    processingCount,
    stuckCount,
    failedLast24h,
    thresholds: {
      heartbeatStaleSeconds: HEARTBEAT_STALE_SECONDS,
      heartbeatDeadSeconds: HEARTBEAT_DEAD_SECONDS,
      stuckJobMinutes: STUCK_JOB_MINUTES,
    },
  });
}
```

2. **Create `src/components/dashboard/CompileServerStatus.tsx`** (client component with 15s poll):

```tsx
"use client";

import { useEffect, useState } from "react";

type StatusResponse = {
  status: 'green' | 'stale' | 'red';
  lastSeenAgoSeconds: number | null;
  oldestPendingAgeSeconds: number | null;
  processingCount: number;
  stuckCount: number;
  failedLast24h: number;
  thresholds: {
    heartbeatStaleSeconds: number;
    heartbeatDeadSeconds: number;
    stuckJobMinutes: number;
  };
};

const COLORS = {
  green: 'var(--accent-accent)',
  stale: '#f4dca2',
  red: '#ff4444',
} as const;

const LABELS = {
  green: 'Online',
  stale: 'Stale (no recent heartbeat)',
  red: 'Offline',
} as const;

export default function CompileServerStatus() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch('/api/admin/compiler-status');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as StatusResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    fetchStatus();
    const iv = setInterval(fetchStatus, 15_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  if (error) {
    return (
      <div className="feature-card">
        <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Compile Server</h3>
        <div style={{ marginTop: '0.5rem', color: '#ff4444', fontSize: '0.9rem' }}>Status error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="feature-card">
        <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Compile Server</h3>
        <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Loading…</div>
      </div>
    );
  }

  const color = COLORS[data.status];
  const label = LABELS[data.status];

  return (
    <div className="feature-card">
      <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Compile Server</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
        />
        <span style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: 'bold', color }}>{label}</span>
      </div>
      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        <div>Last heartbeat: {data.lastSeenAgoSeconds === null ? 'never' : `${data.lastSeenAgoSeconds}s ago`}</div>
        <div>In progress: {data.processingCount}</div>
        <div>Stuck (&gt; {data.thresholds.stuckJobMinutes}m): {data.stuckCount}</div>
        <div>Failed (24h): {data.failedLast24h}</div>
        {data.oldestPendingAgeSeconds !== null && (
          <div>Oldest pending: {Math.floor(data.oldestPendingAgeSeconds / 60)}m {data.oldestPendingAgeSeconds % 60}s</div>
        )}
      </div>
    </div>
  );
}
```

3. **Insert the tile into `src/app/[locale]/dashboard/admin/page.tsx`**:

Add the import at the top of the file (alongside existing imports):
```tsx
import CompileServerStatus from "@/components/dashboard/CompileServerStatus";
```

Then inside the existing `<div className="features-grid" style={{ marginBottom: '4rem' }}>` (currently three cards: Total Users, Total Revenue, EA Compilations Today), add `<CompileServerStatus />` as a fourth card. Keep the existing three untouched.

Do not restructure the admin page. Do not remove the SMTP config panel or the tables. This is purely additive.
  </action>
  <verify>
`npx tsc --noEmit` passes.
`curl -s -o /dev/null -w "%{http_code}\n" https://www.al-ai-fx.xyz/api/admin/compiler-status` (unauthenticated) returns 403.
Signed in as an ADMIN user, `curl -s -b "next-auth.session-token=..." https://www.al-ai-fx.xyz/api/admin/compiler-status` returns 200 with the six-field JSON.
Visit `/dashboard/admin` as ADMIN, see the fourth tile with a green/stale/red dot, live-updating counters every 15s.
Kill the al-ai-fx-daemon NSSM service on the VM for 6 minutes, refresh admin dashboard, see the tile transition green -> stale -> red.
`grep -c "CompileServerStatus" src/app/[locale]/dashboard/admin/page.tsx` returns 2 (import + JSX use).
  </verify>
  <done>Admin sees a live tile with heartbeat color-coded status + counters; endpoint is ADMIN-gated; polling loop cleans up on unmount.</done>
</task>

<task type="auto">
  <name>Task 2: sendAdminCompilerAlertEmail template + wire into /api/compiler/reap</name>
  <files>
src/lib/mail.ts
src/app/api/compiler/reap/route.ts
  </files>
  <action>
1. **Append `sendAdminCompilerAlertEmail` to `src/lib/mail.ts`** (do not modify existing exports — this is additive at the bottom of the file, before the last closing brace of the file if any, or at the very end):

```typescript
type AdminAlertKind =
  | { kind: 'stale-heartbeat'; lastSeenAgoSeconds: number | null }
  | { kind: 'job-failed'; jobId: string; attempts: number; errorMessage?: string };

/**
 * Fires the admin alert email via Mailtrap. Recipient is ADMIN_ALERT_EMAIL
 * (env), falling back to SMTP_FROM_EMAIL. Silent if MAILTRAP_TOKEN missing —
 * do NOT throw, callers must not fail the request just because email failed.
 */
export async function sendAdminCompilerAlertEmail(payload: AdminAlertKind) {
  if (!client) {
    console.warn('[Mail] Mailtrap client not initialized. Skipping admin alert.');
    return;
  }
  const to = (process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_FROM_EMAIL || '').toLowerCase();
  if (!to) {
    console.warn('[Mail] No ADMIN_ALERT_EMAIL or SMTP_FROM_EMAIL configured. Skipping admin alert.');
    return;
  }

  const isStale = payload.kind === 'stale-heartbeat';
  const title = isStale ? 'Compile server offline' : 'Compile job exhausted retries';
  const eyebrow = isStale ? 'Compiler alert' : 'Compiler alert';
  const intro = isStale
    ? `The Windows compile worker has not sent a heartbeat for ${payload.lastSeenAgoSeconds ?? '?'} seconds. Users cannot receive their .ex5 until the worker is restored.`
    : `Compilation job ${payload.jobId} has failed permanently after ${payload.attempts} attempts.${payload.errorMessage ? ' Last error: ' + payload.errorMessage : ''}`;
  const detailLines = isStale
    ? [
        'Check the VM: ssh alfx',
        'Service status: nssm.exe status al-ai-fx-daemon',
        'Recent logs: tail C:\\ProgramData\\al-ai-fx\\logs\\al-ai-fx-daemon.err.log',
      ]
    : [
        `Job ID: ${payload.jobId}`,
        `Total attempts: ${payload.attempts}`,
        payload.errorMessage ? `Last error: ${payload.errorMessage.slice(0, 200)}` : 'No error message recorded.',
      ];

  const { html, text } = renderEmailTemplate({
    buttonLabel: 'Open Admin Dashboard',
    buttonUrl: 'https://www.al-ai-fx.xyz/dashboard/admin',
    eyebrow,
    intro,
    title,
    detailLines,
  });

  try {
    await client.send({
      from: sender,
      to: [{ email: to }],
      subject: isStale ? '[AL-ai-FX] Compile server offline' : '[AL-ai-FX] Compile job failed (retries exhausted)',
      html,
      text,
      category: 'AdminAlert',
    });
    console.log(`[Mail] Admin alert sent (${payload.kind}) to ${to}`);
  } catch (err) {
    console.error('[Mail] Admin alert send failed:', err);
  }
}
```

Reuses the private `renderEmailTemplate`, `client`, and `sender` already at module scope. No new imports needed.

Add `ADMIN_ALERT_EMAIL` to Vercel env (Production + Preview). If the value isn't known at this task, leave the fallback to `SMTP_FROM_EMAIL` in place — the code above handles both.

2. **Extend `src/app/api/compiler/reap/route.ts`** to fire alerts. Read the existing file first (created in Plan 03), then edit:

- Add import at top: `import { sendAdminCompilerAlertEmail } from '@/lib/mail';` and `import { HEARTBEAT_DEAD_SECONDS } from '@/lib/compiler-config';`.
- Add a module-level in-memory dedup guard so the endpoint doesn't email on every 60s ping when the heartbeat has been dead for hours. Note: serverless functions cold-start between invocations so this dedup is best-effort per warm instance; that's acceptable — worst case is one duplicate email per cold start, not an email flood.

```typescript
// Dedup: don't email more than once per COOL_DOWN_MS per event kind per warm instance.
const ALERT_COOLDOWN_MS = 15 * 60_000;
const lastAlertAt: Record<'stale-heartbeat' | 'job-failed', number> = {
  'stale-heartbeat': 0,
  'job-failed': 0,
};

function tryFireAlert(kind: 'stale-heartbeat' | 'job-failed', fire: () => Promise<void>) {
  const now = Date.now();
  if (now - lastAlertAt[kind] < ALERT_COOLDOWN_MS) return;
  lastAlertAt[kind] = now;
  // Fire-and-forget; do NOT await inside the /reap handler critical path.
  fire().catch((err) => console.error('[Reap] Alert fire failed:', err));
}
```

- After the existing `for (const job of stuck)` loop, if `failed.length > 0`, call `tryFireAlert('job-failed', () => sendAdminCompilerAlertEmail({ kind: 'job-failed', jobId: failed[0], attempts: MAX_ATTEMPTS }))`. If multiple jobs failed in the same reap tick, one email covers the whole batch (use `failed[0]` and count in the body — extend `sendAdminCompilerAlertEmail` payload to accept a count if you prefer; the simple version fires one email per batch).

- After the stuck-scan block, do a heartbeat freshness check and fire the stale-heartbeat alert if past HEARTBEAT_DEAD_SECONDS:

```typescript
const hb = await prisma.workerHeartbeat.findUnique({ where: { id: 'compiler' } });
if (hb) {
  const ageSec = Math.floor((Date.now() - hb.lastSeenAt.getTime()) / 1000);
  if (ageSec > HEARTBEAT_DEAD_SECONDS) {
    tryFireAlert('stale-heartbeat', () => sendAdminCompilerAlertEmail({ kind: 'stale-heartbeat', lastSeenAgoSeconds: ageSec }));
  }
}
```

Return shape stays `{ scanned, requeued, failed, ... }`. No breaking change to callers.

Idempotency notes:
- Reaper is idempotent (Plan 03). Adding alerts does not change that — alerts are best-effort side-effects.
- Cooldown is per warm instance; on cold start the first stale poll always emails. Acceptable.
- Alerts fire outside the request-response critical path (fire-and-forget). If Mailtrap is slow or down, /reap still returns 200 promptly.
  </action>
  <verify>
`npx tsc --noEmit` passes.
`grep -c "sendAdminCompilerAlertEmail" src/lib/mail.ts` returns 1 (single export).
`grep -c "sendAdminCompilerAlertEmail" src/app/api/compiler/reap/route.ts` returns 2 (import + call).
Manual test:
  - Stop al-ai-fx-daemon on the VM. Wait for HEARTBEAT_DEAD_SECONDS + 60s. Watch Mailtrap inbox: one email with subject `[AL-ai-FX] Compile server offline`. Trigger /reap manually a few more times within 15 min — no additional emails (cooldown works).
  - Seed a Compilation with attemptCount = MAX_ATTEMPTS - 1 and status = PROCESSING w/ attemptedAt older than STUCK_JOB_MINUTES. Trigger /reap. Row transitions to FAILED. Email arrives with subject `[AL-ai-FX] Compile job failed (retries exhausted)`.
Restart al-ai-fx-daemon to restore green state before finishing.
  </verify>
  <done>Reaper fires admin alerts on stale-heartbeat and retry-exhausted jobs, deduped by a 15-min cooldown per warm instance; no email flood on repeated ticks with the same condition.</done>
</task>

<task type="auto">
  <name>Task 3: Cap LicenseManager polling with backoff + TIMED_OUT UI state</name>
  <files>src/components/dashboard/LicenseManager.tsx</files>
  <action>
Replace the polling `useEffect` block in `src/components/dashboard/LicenseManager.tsx` (currently lines 32-50). Everything outside the useEffect (props, form handling, JSX render tree) stays intact.

Changes:

1. Add import at top: `import { CLIENT_POLL_INITIAL_MS, CLIENT_POLL_MAX_MS, CLIENT_POLL_TIMEOUT_MS } from '@/lib/compiler-config';`. Note: this file is server-safe (no runtime side effects, just number constants) — Next 16 bundles it into the client build fine since it's a plain module without any server-only APIs. No 'server-only' import to worry about.

2. Add a new local state `const [timedOut, setTimedOut] = useState(false);` alongside `isPolling` / `compilation`.

3. Replace the existing useEffect with:

```tsx
useEffect(() => {
  if (!isPolling || !compilation?.id) return;

  const startedAt = Date.now();
  let delay = CLIENT_POLL_INITIAL_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  const tick = async () => {
    if (cancelled) return;
    if (Date.now() - startedAt > CLIENT_POLL_TIMEOUT_MS) {
      setIsPolling(false);
      setTimedOut(true);
      return;
    }
    try {
      const res = await fetch(`/api/licenses/status?jobId=${compilation.id}`);
      const data = await res.json();
      if (data.status === "COMPLETED" || data.status === "FAILED") {
        setCompilation(data);
        setIsPolling(false);
        router.refresh();
        return;
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
    delay = Math.min(delay * 1.5, CLIENT_POLL_MAX_MS);
    timer = setTimeout(tick, delay);
  };

  timer = setTimeout(tick, delay);
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}, [isPolling, compilation?.id, router]);
```

4. Reset `timedOut` to `false` at the start of `handleUpdateMt5` (before setIsPolling(true)) — a fresh compile attempt clears the timed-out state.

5. Add a TIMED_OUT UI branch to the download/status block. In the JSX, find the block that currently renders `{compilation?.status === "COMPLETED" ? ... : ...}` and the sibling `{compilation && (<p ...>Status: ...</p>)}`. Add a preceding conditional:

```tsx
{timedOut && (
  <p style={{ fontSize: "0.9rem", color: "#f4dca2", marginTop: "0.5rem", fontWeight: 500 }}>
    {t.has?.('timedOut') ? t('timedOut') : "Compilation is taking longer than expected — an email will be sent when it's ready."}
  </p>
)}
```

Use `t.has?.` guard because `timedOut` may not exist in every locale message file yet — the fallback English string keeps this working today. i18n backfill of `timedOut` in `src/messages/*.json` is a nice-to-have follow-up but not a blocker for this plan (translations are additive; users see the English fallback if missing).

6. Ensure the download button is disabled while `timedOut && !compilation?.downloadUrl` — user cannot click a broken button. The existing `disabled={isPolling || !mt5Account || isEditing}` on the Compile button should also OR in `timedOut` so the user can click Save & Lock again to retry (which will create a fresh Compilation row via /api/licenses/update-mt5).

Actually simpler: on `timedOut`, allow the user to click Compile again — `handleUpdateMt5` already creates a new Compilation via PUT /api/licenses/update-mt5, and step 4 resets `timedOut`. Good.

Do NOT introduce a real `CompileStatus.TIMED_OUT` enum value — that would need a schema migration for a client-only UX state. Keep it client-only.
  </action>
  <verify>
`npx tsc --noEmit` passes.
`grep -c "CLIENT_POLL_TIMEOUT_MS" src/components/dashboard/LicenseManager.tsx` returns 2 (import + use).
`grep -c "setTimedOut" src/components/dashboard/LicenseManager.tsx` returns >= 3 (state decl + reset in handleUpdateMt5 + set in tick timeout).
`grep -c "setInterval" src/components/dashboard/LicenseManager.tsx` returns 0 (replaced by setTimeout).
Runtime test (dev server):
  - Kill the daemon service on the VM (`nssm stop al-ai-fx-daemon`). As a user, click Save & Lock. Watch the status show "PENDING" then "PROCESSING" (after reaper hits a stuck row... which won't happen without daemon; will stay PENDING). At 5 minutes, UI transitions to the timed-out message. No further /api/licenses/status requests fire (verify in Network tab).
  - Restart the daemon (`nssm start al-ai-fx-daemon`). Click Compile again. Backoff resumes at 5s, doubles up to 30s cap, terminates on COMPLETED or FAILED.
  </verify>
  <done>LicenseManager polls with 5s->30s backoff, hard-caps at 5 minutes, transitions to a TIMED_OUT UI state that surfaces a helpful message, and lets the user retry without a page refresh; no infinite polling loop possible.</done>
</task>

</tasks>

<verification>
- Admin can log in and see the Compile Server tile updating live.
- Killing the daemon flips the tile to red within HEARTBEAT_DEAD_SECONDS and sends exactly one admin alert email.
- A retry-exhausted Compilation triggers one admin alert email (regardless of how many retry ticks pass with the same row's terminal FAILED status).
- Client polling loop terminates within 5 minutes even if the job never completes; UI shows a clear message; no polling requests continue after termination.
- Existing users' compile flow is unbroken: happy-path (working daemon, working reaper) still ends with a downloadable .ex5 in under a minute.
</verification>

<success_criteria>
1. CMPL-02 closed: admin dashboard shows compile-server status (green/stale/red) + admin receives email when server goes offline.
2. Phase 1 success criterion 3: client polling stops within 5 minutes; no infinite loop possible from LicenseManager.
3. Admin alert emails deduped (no flood on repeated reaper ticks with the same condition).
4. Admin status tile is ADMIN-gated (USER role gets 403).
5. Existing dashboard content (users table, orders table, SMTP config panel) untouched.
</success_criteria>

<output>
After completion, create `.planning/phases/01-restore-compile-delivery/01-04-SUMMARY.md`.
</output>
