---
phase: 01-restore-compile-delivery
plan: 03
type: execute
wave: 2
depends_on: ["01-01"]
files_modified:
  - src/app/api/compiler/poll/route.ts
  - src/app/api/compiler/reap/route.ts
  - "VM:C:\\Users\\Administrator\\Documents\\autocompiler-reaper\\reaper.js"
  - "VM:C:\\Users\\Administrator\\Documents\\autocompiler-reaper\\package.json"
  - "VM:al-ai-fx-reaper NSSM service"
  - "Vercel env CRON_SECRET"
autonomous: true

user_setup:
  - service: cron
    why: "Hobby plan (confirmed) cannot use Vercel Cron sub-daily; we run a lightweight 60s pinger on the Windows VM as a second NSSM service. If/when the account moves to Pro, swap in vercel.json cron entry."
    env_vars:
      - name: CRON_SECRET
        source: "openssl rand -base64 32 output; set once, shared between /api/compiler/reap and the VM reaper service"

must_haves:
  truths:
    - "Every poll to /api/compiler/poll upserts WorkerHeartbeat.lastSeenAt so admin can see server liveness"
    - "The dequeue in /api/compiler/poll is atomic — two concurrent pollers cannot claim the same PENDING row (proven via a concurrency smoke test)"
    - "The poll response includes attemptCount (additive-only; existing fields mt5AccountNumber and expiresAt unchanged)"
    - "The reaper endpoint requires Bearer CRON_SECRET auth; unauthenticated calls return 401"
    - "Compilation rows in PROCESSING with attemptedAt older than STUCK_JOB_MINUTES are auto-transitioned by the reaper: back to PENDING w/ attemptCount++ if under MAX_ATTEMPTS, else FAILED"
    - "The Windows VM runs a second NSSM service (al-ai-fx-reaper) that hits /api/compiler/reap every 60s; if the daemon is offline the reaper stays up (independent of daemon liveness)"
  artifacts:
    - path: "src/app/api/compiler/poll/route.ts"
      provides: "Heartbeat upsert + atomic FOR UPDATE SKIP LOCKED dequeue via $queryRaw; additive attemptCount in response"
      exports: ["GET"]
    - path: "src/app/api/compiler/reap/route.ts"
      provides: "CRON_SECRET-gated reaper: PROCESSING > STUCK_JOB_MINUTES -> PENDING (attemptCount++) or FAILED (attemptCount >= MAX_ATTEMPTS); returns { scanned, requeued, failed }"
      exports: ["GET"]
    - path: "VM:C:\\Users\\Administrator\\Documents\\autocompiler-reaper\\reaper.js"
      provides: "60s-interval pinger against /api/compiler/reap"
  key_links:
    - from: "src/app/api/compiler/poll/route.ts"
      to: "prisma.workerHeartbeat.upsert"
      via: "id: 'compiler' singleton"
      pattern: "workerHeartbeat\\.upsert"
    - from: "src/app/api/compiler/poll/route.ts"
      to: "prisma.$queryRaw FOR UPDATE SKIP LOCKED"
      via: "$transaction"
      pattern: "FOR UPDATE SKIP LOCKED"
    - from: "src/app/api/compiler/reap/route.ts"
      to: "prisma.compilation.update"
      via: "conditional PENDING vs FAILED based on attemptCount vs MAX_ATTEMPTS"
      pattern: "attemptCount.*MAX_ATTEMPTS"
    - from: "VM al-ai-fx-reaper NSSM service"
      to: "/api/compiler/reap"
      via: "60s interval fetch with Bearer CRON_SECRET"
      pattern: "setInterval.*reap"
---

<objective>
Make the queue race-safe, add a real heartbeat signal, and reap stuck jobs even when Vercel Cron isn't available. Three moving parts:

1. `/api/compiler/poll` gets a heartbeat write on every call (singleton `WorkerHeartbeat` upsert) and its dequeue becomes atomic via Postgres `FOR UPDATE SKIP LOCKED` inside a `$queryRaw`-based `$transaction`.
2. New `/api/compiler/reap` endpoint (guarded by `Bearer CRON_SECRET`) implements the state-machine transition for stuck `PROCESSING` rows.
3. New standalone Node.js reaper script on the Windows VM, installed as its own NSSM service `al-ai-fx-reaper`, hits the endpoint every 60 seconds. This is the Hobby-plan-compatible cron path — architecturally identical to Vercel Cron but doesn't require Pro plan.

Purpose: Addresses CMPL-01 (heartbeat surface), CMPL-03 (stuck-job reaper), CMPL-04 (bounded retry from the reaper side; /complete handles the direct-failure side in Plan 02). Also fixes the racy `findFirst + update` dequeue flagged in ARCHITECTURE.md and CONCERNS.md.

Output: Patched poll route, new reap route, VM has second NSSM service hitting reap every 60s.
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/01-restore-compile-delivery/1-RESEARCH.md
@.planning/phases/01-restore-compile-delivery/1-VM-INSPECTION.md
@src/app/api/compiler/poll/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor /api/compiler/poll — heartbeat upsert + atomic FOR UPDATE SKIP LOCKED dequeue</name>
  <files>src/app/api/compiler/poll/route.ts</files>
  <action>
Replace the entire file (currently 36 lines). Two behaviors:

- Every request, whether or not there is a job, writes `WorkerHeartbeat.lastSeenAt = NOW()` (singleton row keyed `"compiler"`, seeded in Plan 01).
- Dequeue is a single `prisma.$transaction` running two raw queries — `SELECT ... FOR UPDATE SKIP LOCKED` picks one PENDING row and immediately `UPDATE`s it to PROCESSING + `attemptedAt = NOW()`. Prisma does not natively support SKIP LOCKED (issue #5983), so `$queryRaw` is the only path.

New file contents:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type ClaimedJob = {
  id: string;
  subscriptionId: string;
  attemptCount: number;
};

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.COMPILER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Heartbeat — always, even on empty poll.
  //    Failure to write must not fail the poll (heartbeat is best-effort).
  try {
    await prisma.workerHeartbeat.upsert({
      where: { id: 'compiler' },
      update: { lastSeenAt: new Date() },
      create: { id: 'compiler', lastSeenAt: new Date() },
    });
  } catch (err) {
    console.error('[Compiler Poll] Heartbeat upsert failed (non-fatal):', err);
  }

  // 2. Atomic dequeue.
  //    Postgres FOR UPDATE SKIP LOCKED locks a single PENDING row and
  //    returns it; concurrent pollers get different rows or none.
  //    Both statements share the same transaction => atomic claim.
  let claimed: (ClaimedJob & { subscription: { mt5AccountNumber: string | null; expiresAt: Date | null } }) | null = null;
  try {
    claimed = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "Compilation"
        WHERE status = 'PENDING'
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
      if (rows.length === 0) return null;
      const jobId = rows[0].id;

      await tx.$executeRaw`
        UPDATE "Compilation"
        SET status = 'PROCESSING',
            "attemptedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE id = ${jobId}
      `;

      // Fetch the row + subscription for the response shape.
      const job = await tx.compilation.findUnique({
        where: { id: jobId },
        include: { subscription: { select: { mt5AccountNumber: true, expiresAt: true } } },
      });
      if (!job || !job.subscription) return null;
      return {
        id: job.id,
        subscriptionId: job.subscriptionId,
        attemptCount: job.attemptCount,
        subscription: job.subscription,
      };
    });
  } catch (err) {
    console.error('[Compiler Poll] Dequeue failed:', err);
    return NextResponse.json({ error: 'Database fail' }, { status: 500 });
  }

  if (!claimed) {
    return NextResponse.json({ job: null }, { status: 200 });
  }

  // 3. Response shape — ADDITIVE ONLY. Existing worker (daemon.js) reads
  //    job.id, job.mt5AccountNumber, job.expiresAt. attemptCount is new;
  //    daemon.js reads it as `job.attemptCount ?? 0`.
  return NextResponse.json({
    job: {
      id: claimed.id,
      mt5AccountNumber: claimed.subscription.mt5AccountNumber,
      expiresAt: claimed.subscription.expiresAt,
      attemptCount: claimed.attemptCount,
    },
  });
}
```

Notes on Prisma raw SQL:
- Table and column names are double-quoted (Postgres identifier folding). `"Compilation"`, `"createdAt"`, `"attemptedAt"`, `"updatedAt"`.
- Prisma's tagged-template `$queryRaw` interpolates parameters safely — the `${jobId}` in the UPDATE is a bind parameter, not a string concat. Do not switch to `$queryRawUnsafe`.
- `$queryRaw` returns raw shapes; type parameter `<Array<{ id: string }>>` gives us row typing.
- The `tx.compilation.findUnique` inside the transaction reads the row we just updated — safe because we're inside the same transaction so we see our own write.

Note on Next 16 caching:
- Route handlers with request access are dynamic by default in Next 16. No `export const dynamic` needed. Do NOT add `revalidate = 0` or `dynamic = 'force-dynamic'`; the app router already treats routes reading `req.headers` as dynamic.

Do NOT touch the auth header check. Do NOT change the URL, HTTP method, or error status codes.
  </action>
  <verify>
`npx tsc --noEmit` produces no errors involving poll/route.ts.
`grep -c "FOR UPDATE SKIP LOCKED" src/app/api/compiler/poll/route.ts` returns 1.
`grep -c "workerHeartbeat.upsert" src/app/api/compiler/poll/route.ts` returns 1.
`grep -c "attemptedAt" src/app/api/compiler/poll/route.ts` returns 1.
Existing daemon.js compat: after deploy, watch daemon log — polls should return `.` (empty queue) then eventually claim a real job with `attemptCount` field present.
Concurrency smoke test: seed 3 PENDING rows; fire 3 concurrent curl requests. Result: 3 different `job.id`s, or up to 3 with some `{"job":null}` if rows get locked between requests. Zero rows should be double-claimed.
```bash
# Seed:
npx prisma db execute --stdin <<'SQL'
INSERT INTO "Compilation" (id, "subscriptionId", status, "createdAt", "updatedAt")
VALUES ('smoke-1', '<real-sub-id>', 'PENDING', NOW(), NOW()),
       ('smoke-2', '<real-sub-id>', 'PENDING', NOW(), NOW()),
       ('smoke-3', '<real-sub-id>', 'PENDING', NOW(), NOW());
SQL
# Race:
for i in 1 2 3; do
  curl -s -H "Authorization: Bearer $COMPILER_SECRET" https://www.al-ai-fx.xyz/api/compiler/poll &
done
wait
# Then cleanup:
npx prisma db execute --stdin <<'SQL'
DELETE FROM "Compilation" WHERE id LIKE 'smoke-%';
SQL
```
No two responses should have the same `job.id`.
Heartbeat check: `SELECT id, "lastSeenAt" FROM "WorkerHeartbeat";` shows lastSeenAt within seconds of the last poll.
  </verify>
  <done>
Poll route atomically dequeues one row per call with no double-claim under concurrency; every call updates the singleton WorkerHeartbeat; response is additive (existing worker parser sees no removed/renamed fields).
  </done>
</task>

<task type="auto">
  <name>Task 2: Create /api/compiler/reap route (CRON_SECRET-gated stuck-job reaper)</name>
  <files>
src/app/api/compiler/reap/route.ts
Vercel env CRON_SECRET
  </files>
  <action>
1. **Provision `CRON_SECRET` in Vercel** if it doesn't already exist:

```bash
if ! vercel env ls production | grep -q '^CRON_SECRET'; then
  NEW_CRON_SECRET=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)
  echo "$NEW_CRON_SECRET" | vercel env add CRON_SECRET production
  echo "$NEW_CRON_SECRET" | vercel env add CRON_SECRET preview
fi
```

Do not log the value. Task 3 needs the same value for the VM reaper — capture it once here for use there.

2. **Create `src/app/api/compiler/reap/route.ts`**:

```typescript
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STUCK_JOB_MINUTES, MAX_ATTEMPTS } from '@/lib/compiler-config';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const cutoff = new Date(Date.now() - STUCK_JOB_MINUTES * 60_000);

  const stuck = await prisma.compilation.findMany({
    where: {
      status: 'PROCESSING',
      attemptedAt: { lt: cutoff },
    },
    select: { id: true, attemptCount: true },
  });

  const requeued: string[] = [];
  const failed: string[] = [];

  for (const job of stuck) {
    const nextAttempt = job.attemptCount + 1;
    if (nextAttempt < MAX_ATTEMPTS) {
      await prisma.compilation.update({
        where: { id: job.id },
        data: {
          status: 'PENDING',
          attemptCount: nextAttempt,
          attemptedAt: null,
          errorMessage: `reaped: stuck in PROCESSING > ${STUCK_JOB_MINUTES}m`,
        },
      });
      requeued.push(job.id);
    } else {
      await prisma.compilation.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          attemptCount: nextAttempt,
          errorMessage: `reaped: exhausted ${MAX_ATTEMPTS} attempts`,
        },
      });
      failed.push(job.id);
    }
  }

  return Response.json({
    scanned: stuck.length,
    requeued: requeued.length,
    failed: failed.length,
    stuckJobMinutes: STUCK_JOB_MINUTES,
    maxAttempts: MAX_ATTEMPTS,
  });
}
```

3. **`vercel.json` — do NOT add a cron entry.** Per orchestrator's live state, the Vercel plan is Hobby. Vercel Cron sub-daily requires Pro. External cron on the Windows VM (Task 3) is the ship path. Leave a comment in Plan 04's summary noting: "when this account moves to Pro, add `{ crons: [{ path: '/api/compiler/reap', schedule: '* * * * *' }] }` to vercel.json and the al-ai-fx-reaper NSSM service can be stopped."

Idempotency: the reaper is idempotent because state transitions are gated on `status = 'PROCESSING' AND attemptedAt < cutoff`. Running it twice in quick succession is safe — the second run finds no matching rows.

Missed runs: the reaper always considers ALL rows past the cutoff, not just those that crossed the cutoff in the last interval. So a missed 60s tick loses at most 60s of latency — no work is lost.
  </action>
  <verify>
`test -f src/app/api/compiler/reap/route.ts && echo OK`.
`grep -c "STUCK_JOB_MINUTES" src/app/api/compiler/reap/route.ts` returns 2 (import + use).
`grep -c "MAX_ATTEMPTS" src/app/api/compiler/reap/route.ts` returns 2.
`vercel env ls production | grep '^CRON_SECRET'` shows the var exists.
After deploy:
  - `curl -s -o /dev/null -w "%{http_code}\n" https://www.al-ai-fx.xyz/api/compiler/reap` returns 401.
  - `curl -s -H "Authorization: Bearer $CRON_SECRET" https://www.al-ai-fx.xyz/api/compiler/reap` returns 200 with body `{"scanned":0,"requeued":0,"failed":0,"stuckJobMinutes":10,"maxAttempts":3}` on a clean queue.
State-machine test:
  - Manually insert a PROCESSING row with attemptedAt = NOW() - '15 minutes' and attemptCount = 0. Hit /reap. Row transitions to PENDING, attemptCount = 1, attemptedAt = NULL.
  - Repeat until attemptCount = 2 (one under MAX_ATTEMPTS = 3). Hit /reap once more with attemptedAt back-dated. Row transitions to FAILED, attemptCount = 3.
Do not skip the state-machine test — it validates the two branches of the reaper's decision.
  </verify>
  <done>/api/compiler/reap rejects unauthenticated calls; on authenticated calls, transitions all PROCESSING rows past STUCK_JOB_MINUTES to PENDING (attemptCount++) or FAILED (if next attempt >= MAX_ATTEMPTS); returns scan/requeue/fail counts.</done>
</task>

<task type="auto">
  <name>Task 3: Install al-ai-fx-reaper NSSM service on Windows VM (60s external cron)</name>
  <files>
VM:C:\Users\Administrator\Documents\autocompiler-reaper\reaper.js
VM:C:\Users\Administrator\Documents\autocompiler-reaper\package.json
VM:NSSM service al-ai-fx-reaper
  </files>
  <action>
Ship the external cron as a second NSSM service on the same VM. This is intentionally independent from the daemon: if the compile daemon dies, the reaper keeps hitting /reap and clears stuck rows. If the reaper dies, jobs still succeed, just no stuck-job recovery until it comes back.

1. **Provision reaper source directory on VM**:
```bash
ssh alfx 'mkdir -p /c/Users/Administrator/Documents/autocompiler-reaper'
```

2. **Write reaper.js locally** and scp it up. Contents:

```javascript
// Simple external cron: ping /api/compiler/reap every REAP_INTERVAL_MS.
// Runs as NSSM service al-ai-fx-reaper. Independent from the compile daemon.
const https = require('https');

const REAP_URL = process.env.REAP_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const INTERVAL_MS = Number(process.env.REAP_INTERVAL_MS || 60000);

const missing = [];
if (!REAP_URL) missing.push('REAP_URL');
if (!CRON_SECRET) missing.push('CRON_SECRET');
if (missing.length) {
  console.error(`[FATAL] Missing required env vars: ${missing.join(', ')}. Exiting.`);
  process.exit(1);
}

const agent = new https.Agent({ keepAlive: true });

async function ping() {
  try {
    const res = await fetch(REAP_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      // Node 22+ global fetch — no agent option; keepAlive is default.
    });
    const body = await res.text();
    if (res.status !== 200) {
      console.error(`[Reap] ${res.status}: ${body.slice(0, 200)}`);
      return;
    }
    // Only log non-empty scans to keep logs quiet.
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    if (parsed && (parsed.scanned > 0 || parsed.requeued > 0 || parsed.failed > 0)) {
      console.log(`[Reap] scanned=${parsed.scanned} requeued=${parsed.requeued} failed=${parsed.failed}`);
    } else {
      process.stdout.write('.');
    }
  } catch (err) {
    console.error('[Reap] Ping failed:', err.message);
  }
}

setInterval(ping, INTERVAL_MS);
console.log(`[Reaper] Started; interval=${INTERVAL_MS}ms url=${REAP_URL}`);
// Immediate first ping so we don't wait a full interval on startup.
ping();
```

3. **Provision a trivial package.json** on VM (no deps needed — global fetch on Node 22+):
```bash
ssh alfx 'echo "{\"name\":\"al-ai-fx-reaper\",\"version\":\"1.0.0\",\"main\":\"reaper.js\"}" > /c/Users/Administrator/Documents/autocompiler-reaper/package.json'
```

4. **scp reaper.js** to the VM:
```bash
scp /tmp/reaper.js alfx:/c/Users/Administrator/Documents/autocompiler-reaper/reaper.js
ssh alfx 'cd C:\Users\Administrator\Documents\autocompiler-reaper && node -c reaper.js && echo OK'
```

5. **Install as NSSM service**:
```bash
ssh alfx 'C:\Tools\nssm\nssm.exe install al-ai-fx-reaper "C:\Program Files\nodejs\node.exe" "C:\Users\Administrator\Documents\autocompiler-reaper\reaper.js"'
ssh alfx 'C:\Tools\nssm\nssm.exe set al-ai-fx-reaper AppDirectory "C:\Users\Administrator\Documents\autocompiler-reaper"'
ssh alfx 'C:\Tools\nssm\nssm.exe set al-ai-fx-reaper AppExit Default Restart'
ssh alfx 'C:\Tools\nssm\nssm.exe set al-ai-fx-reaper AppRestartDelay 5000'
ssh alfx 'C:\Tools\nssm\nssm.exe set al-ai-fx-reaper AppThrottle 10000'
ssh alfx 'C:\Tools\nssm\nssm.exe set al-ai-fx-reaper Start SERVICE_DELAYED_AUTO_START'
ssh alfx 'mkdir -p /c/ProgramData/al-ai-fx/logs'
ssh alfx 'C:\Tools\nssm\nssm.exe set al-ai-fx-reaper AppStdout "C:\ProgramData\al-ai-fx\logs\al-ai-fx-reaper.out.log"'
ssh alfx 'C:\Tools\nssm\nssm.exe set al-ai-fx-reaper AppStderr "C:\ProgramData\al-ai-fx\logs\al-ai-fx-reaper.err.log"'
ssh alfx 'C:\Tools\nssm\nssm.exe set al-ai-fx-reaper AppRotateFiles 1'
ssh alfx 'C:\Tools\nssm\nssm.exe set al-ai-fx-reaper AppRotateBytes 10485760'
ssh alfx "C:\Tools\nssm\nssm.exe set al-ai-fx-reaper AppEnvironmentExtra \
  \"REAP_URL=https://www.al-ai-fx.xyz/api/compiler/reap\" \
  \"CRON_SECRET=$CRON_SECRET_VALUE\" \
  \"REAP_INTERVAL_MS=60000\""
ssh alfx 'C:\Tools\nssm\nssm.exe start al-ai-fx-reaper'
sleep 5
ssh alfx 'C:\Tools\nssm\nssm.exe status al-ai-fx-reaper'
ssh alfx 'tail -n 30 C:\ProgramData\al-ai-fx\logs\al-ai-fx-reaper.out.log'
```

Where `$CRON_SECRET_VALUE` is the same value provisioned in Vercel in Task 2.

6. **Verify** the reaper is hitting /reap:
- On the VM: `tail -f C:\ProgramData\al-ai-fx\logs\al-ai-fx-reaper.out.log` should show `[Reaper] Started` + a stream of `.` heartbeats (one per minute; noisy scans logged as `[Reap] scanned=N ...`).
- On Vercel: Vercel Functions dashboard should show requests to `/api/compiler/reap` roughly every 60s, all returning 200.

7. **Prove reaper does work** — insert a fake stuck row and watch it get requeued:
```bash
npx prisma db execute --stdin <<'SQL'
-- pick a real existing subscription id
INSERT INTO "Compilation" (id, "subscriptionId", status, "attemptedAt", "attemptCount", "createdAt", "updatedAt")
VALUES ('reaper-smoke-1', '<real-sub-id>', 'PROCESSING', NOW() - INTERVAL '15 minutes', 0, NOW(), NOW());
SQL
sleep 65
npx prisma db execute --stdin <<'SQL'
SELECT id, status, "attemptCount", "errorMessage" FROM "Compilation" WHERE id = 'reaper-smoke-1';
-- expect: status = PENDING, attemptCount = 1, errorMessage = "reaped: ..."
DELETE FROM "Compilation" WHERE id = 'reaper-smoke-1';
SQL
```

On Pro-plan upgrade: switch to Vercel Cron by adding `vercel.json` with the crons entry (see comment in Task 2) and stopping this NSSM service (`nssm.exe stop al-ai-fx-reaper`). No code change required.
  </action>
  <verify>
`ssh alfx 'C:\Tools\nssm\nssm.exe status al-ai-fx-reaper'` returns SERVICE_RUNNING.
`ssh alfx 'tail -n 20 C:\ProgramData\al-ai-fx\logs\al-ai-fx-reaper.out.log'` shows `[Reaper] Started` and periodic dots (or scan log lines when non-empty).
Vercel logs (or `curl -s -H "Authorization: Bearer $CRON_SECRET" ...`) confirm the endpoint is being hit at ~60s intervals with 200 responses.
Fake stuck row (`reaper-smoke-1`) transitions PROCESSING -> PENDING within ~65s of insert.
Kill the reaper (`nssm.exe stop al-ai-fx-reaper`), insert another stuck row, wait 65s — row stays PROCESSING (proves reaper is doing the work, not some other pathway). Restart, wait 65s — row transitions. Clean up.
  </verify>
  <done>al-ai-fx-reaper NSSM service is Running with delayed-auto start + restart-on-crash; hits /api/compiler/reap every 60s; requeue/fail state transitions observable on a seeded stuck row; runs independently of al-ai-fx-daemon.</done>
</task>

</tasks>

<verification>
- Poll route: two concurrent pollers cannot claim the same PENDING row (SKIP LOCKED guarantee).
- Poll route: every call touches WorkerHeartbeat.lastSeenAt (observable via SELECT after any poll).
- Reap route: 401 without CRON_SECRET, 200 with; scanned/requeued/failed counts match rows manipulated in the smoke test.
- Reap route: PROCESSING > STUCK_JOB_MINUTES transitions to PENDING (attempt < MAX) or FAILED (attempt >= MAX).
- NSSM al-ai-fx-reaper: Running, auto-start delayed, restart-on-crash 5s, logs rotate at 10 MB.
- Daemon (from Plan 02) is unaffected — its poll response still has `id`, `mt5AccountNumber`, `expiresAt` (attemptCount added but daemon reads it optionally).
</verification>

<success_criteria>
1. CMPL-03 closed: any Compilation stuck past STUCK_JOB_MINUTES is auto-transitioned by the reaper.
2. CMPL-04 fully closed: bounded retry works from both the /complete side (Plan 02) and the reaper side (this plan).
3. CMPL-01 partial (heartbeat surface): WorkerHeartbeat singleton is written on every poll — admin visibility layer in Plan 04 will read it.
4. Atomic dequeue: no double-claim under simulated concurrency (3-way race test).
5. Hobby-plan-safe: no Vercel Cron dependency; reaper runs from the Windows VM as al-ai-fx-reaper NSSM service.
6. Additive-only poll response shape: existing daemon parser continues to work.
</success_criteria>

<output>
After completion, create `.planning/phases/01-restore-compile-delivery/01-03-SUMMARY.md`.
</output>
