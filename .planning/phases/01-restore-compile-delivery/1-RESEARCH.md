# Phase 1: Restore Compile Delivery - Research

**Researched:** 2026-07-04
**Domain:** Async compile-job pipeline: Next.js 16 App Router + Prisma/Postgres + Vercel Blob + external Windows worker (MetaEditor64 CLI via NSSM service)
**Confidence:** HIGH for Vercel/Next/Prisma patterns; MEDIUM for MetaEditor CLI edge cases (community sources only, no official CLI reference reproduced verbatim)

## Summary

Phase 1 restores the offline compile pipeline for the existing single-robot (GoldBot) flow. The work sits in three well-understood domains:

1. **Windows-side worker service** — install a Node/PowerShell poller as a Windows Service under NSSM with log rotation, auto-restart, and Defender exclusions for the MetaEditor toolchain. Health-check every poll via a new `heartbeat` field / row that the Next.js API reads.
2. **Serverless correctness** — swap `new PrismaClient()` in the two compile routes for the shared singleton from `src/lib/prisma.ts`, replace the `findFirst + update` race with an atomic `SELECT … FOR UPDATE SKIP LOCKED` via `$queryRaw` inside `$transaction`, and add a Vercel Cron-driven reaper endpoint that transitions stale `PROCESSING` rows to retry or `FAILED`.
3. **Vercel body-limit escape** — the Windows worker already runs *outside* Vercel and holds the `BLOB_READ_WRITE_TOKEN` (server-static token). It should call `@vercel/blob`'s `put()` directly from the VM and then POST *only* metadata (`{ jobId, status, blobUrl, sizeBytes, sha256 }`) back to `/api/compiler/complete`. This deletes the 4.5 MB body limit problem at the root — no serverless function ever transports the `.ex5`. This is the simplest, safest option and is explicitly what Vercel documents for "code that runs outside Vercel."

The client-side loop in `LicenseManager.tsx` should be capped at ~5 min with exponential backoff and a terminal timeout state.

**Primary recommendation:** Windows worker uses `@vercel/blob`'s `put()` with the static `BLOB_READ_WRITE_TOKEN`; the Next.js `/complete` endpoint accepts metadata only. Wire poll/complete/reaper through the shared Prisma singleton with atomic dequeue and add a `Compilation.startedAt` + `Compilation.attempts` field plus a lightweight `WorkerHeartbeat` singleton row. Vercel Cron runs the reaper every minute.

## User Constraints

No CONTEXT.md exists (`/gsd:discuss-phase` was not run). Freeform planning against project decisions from PROJECT.md + ROADMAP.md + the live operational context provided by the orchestrator:

- Windows VPS at 65.21.66.43 (Hetzner), RDP :7777, SSH :22, user `root`, coming online ~15 min after orchestrator spawn.
- Existing compile worker code assumed on VM; state unknown, must be inspected.
- Toolchain: MetaEditor CLI (`metaeditor64.exe /compile`).
- Persistence: Windows Service via NSSM (user's choice).
- Auth Windows→Next.js: bearer `COMPILER_SECRET` (existing pattern).
- Single-robot (GoldBot) only in this phase — multi-robot is Phase 3/4.
- Test users may be wiped on schema changes (no migration burden), per PROJECT.md.
- `prisma/migrations/` is not committed today; STATE.md flags Phase 3 will decide migration strategy. **For Phase 1 schema tweaks (`startedAt`, `attempts`, `WorkerHeartbeat`), the safest path is `prisma db push` in this phase and defer migration-directory setup to Phase 3.** Flag if planner wants to bring migration setup forward.
- External Windows worker parser strictness unknown (STATE.md concern). **Poll response shape changes should be additive only** — do not remove `mt5AccountNumber` or `expiresAt`, do not rename `job`. Extend with new fields.

## Standard Stack

### Core (already installed; keep)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.3 | App Router + Route Handlers | Framework baseline |
| `@prisma/client` | ^6.19.3 | Postgres ORM | Already the DB layer; singleton at `src/lib/prisma.ts` |
| `@vercel/blob` | ^2.3.3 | Object storage for `.ex5` binaries | Already integrated; supports direct server-side `put()` from any Node process with `BLOB_READ_WRITE_TOKEN` — bypasses Vercel's 4.5 MB function body limit |
| `next-auth` | ^4.24.14 | Session gating for user-facing routes | Existing pattern; unchanged in Phase 1 |
| `mailtrap` | ^4.5.1 | Admin alert emails | Existing `sendResetPasswordEmail`/`sendPurchaseConfirmationEmail` templates in `src/lib/mail.ts` — add `sendAdminAlertEmail` for CMPL-02 |

### Supporting (Windows worker — new/replaced)

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| **NSSM** | 2.24 (or `nssm-2.24-101-g897c7ad` prerelease) | Wraps `node worker.js` (or existing worker exe) as an auto-restarting Windows Service with log rotation | Persistence + crash recovery on the VM. The user has already chosen this. |
| **Node.js LTS** | Node 22.x | Runtime for the poller (if the existing worker is Node; unclear until VM inspected) | Only if we control the worker code. If worker is C#/PowerShell, keep it. |
| **`@vercel/blob`** | ^2.3.3 (same as Next side) | Direct-to-blob `put()` from the Windows VM | Windows worker uploads the compiled `.ex5` straight to Vercel Blob using the read/write token — never through the Next.js function |
| **`node-fetch`** or global `fetch` (Node 22+) | — | HTTP calls to `/poll` and `/complete` | Native `fetch` in Node 22 is fine. |
| **MetaEditor64** | Bundled with MT5 installation | The compiler | Existing; called via `spawn` / `Start-Process` |
| **Vercel Cron** | Built-in | Scheduled reaper every 1 min | Replaces need for external cron. Configured via `vercel.json`. Requires Pro plan for sub-daily intervals. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| NSSM Windows Service | Windows Task Scheduler at boot, PM2, `sc.exe` native service | NSSM is the user's choice; also gives us free stdout/stderr redirect + rotation + auto-restart with backoff. `sc.exe` requires the exe to be a real Windows service. Task Scheduler has no crash recovery. |
| Direct-to-Blob `put()` from worker | `handleUpload` / client-upload token exchange | `handleUpload` is designed for browsers (issues a scoped, time-limited client token). It works, but it's more machinery for the same result. The static `BLOB_READ_WRITE_TOKEN` is officially the recommended pattern for "code that runs outside Vercel." |
| Direct-to-Blob `put()` from worker | Keep base64 through `/complete` but chunk / stream | Vercel's 4.5 MB body limit is enforced at the edge before Node code runs. Streaming does not fix incoming request body limit. Only the response side supports streaming without limits. Rejected. |
| Vercel Cron reaper | External cron (cron-job.org, EasyCron) pinging a reaper endpoint | External cron adds a third-party dependency; Vercel Cron is a first-class Vercel feature secured via `CRON_SECRET`. Downside: Hobby plan is once-per-day only; **requires Pro plan** for 1-minute reaper. Verify current plan before locking this in. |
| Vercel Cron reaper | Reaper runs on the Windows worker itself (side effect of poll) | Simpler infra but couples liveness to the very thing that might be down. If the worker is offline, no reaping happens. Rejected. |
| `WorkerHeartbeat` singleton row | Reuse latest `Compilation.updatedAt` as heartbeat proxy | Fragile — quiet queue gives no heartbeat. A dedicated single-row `WorkerHeartbeat { id: "compiler", lastSeenAt, workerVersion }` updated on every poll is the cleanest and cheapest. |
| Prisma `$queryRaw` for `FOR UPDATE SKIP LOCKED` | `updateMany` where `status=PENDING` order by createdAt limit 1 | `updateMany` is not atomic against concurrent selects and doesn't return the row (needs a follow-up `findUnique`). Confirmed race-prone by Prisma issue #8612. `FOR UPDATE SKIP LOCKED` is the industry standard queue pattern. |
| Prisma singleton | Fresh `new PrismaClient()` per route | Fresh clients leak connection pools on Vercel — CONCERNS.md flagged this as a scaling limit. Singleton is mandatory. |

**Installation (Windows VM):**

```powershell
# 1. Node.js LTS (Node 22 has global fetch)
winget install OpenJS.NodeJS.LTS

# 2. NSSM
choco install nssm    # or download from nssm.cc/download

# 3. Worker deps (in worker source directory)
npm install @vercel/blob

# 4. Windows Defender exclusions (see Common Pitfalls > Defender)
Add-MpPreference -ExclusionPath "C:\Program Files\MetaTrader 5"
Add-MpPreference -ExclusionPath "C:\Compiler\worker"
Add-MpPreference -ExclusionProcess "metaeditor64.exe"
Add-MpPreference -ExclusionProcess "terminal64.exe"
```

**Installation (Next.js side — nothing new to add; verify existing versions):**

```bash
# No new deps for Phase 1 — everything is already in package.json
# @vercel/blob is present; @prisma/client is present; next-auth is present
```

## Architecture Patterns

### Recommended Project Structure Delta (Next.js side)

```
src/
├── app/api/compiler/
│   ├── poll/route.ts          # (existing) — refactor to singleton + atomic dequeue + heartbeat write
│   ├── complete/route.ts      # (existing) — accept metadata only ({jobId, status, blobUrl, sha256}); no base64
│   ├── download/route.ts      # (existing) — unchanged in scope, but centralize filename via helper
│   └── heartbeat/route.ts     # (new)     — POST from worker, upserts WorkerHeartbeat row
├── app/api/cron/
│   └── reap-stuck-jobs/route.ts   # (new) — Vercel Cron-invoked reaper, CRON_SECRET-guarded
├── app/api/admin/
│   └── compiler-status/route.ts   # (new) — admin dashboard fetches this for green/red/stale indicator
├── lib/
│   ├── prisma.ts              # (existing) — gate `log` on NODE_ENV in this phase (bundled with CMPL-05 cleanup)
│   ├── compiler-filename.ts   # (new) — single source of filename generation used by complete + download
│   ├── compiler-config.ts     # (new) — reaper thresholds, max attempts, backoff constants (single source of truth)
│   └── mail.ts                # (existing) — add sendAdminCompilerAlertEmail template
└── config/
    └── (nothing new)

prisma/
└── schema.prisma              # add Compilation.startedAt, Compilation.attempts, WorkerHeartbeat model
                                # apply via `prisma db push` in Phase 1; formal migrations wait for Phase 3

vercel.json                    # (new or extend) — crons entry for /api/cron/reap-stuck-jobs
```

### Recommended Project Structure Delta (Windows VM)

```
C:\Compiler\worker\
├── worker.js                  # main poll → compile → put-blob → complete loop
├── metaeditor.js              # spawn wrapper: /compile /log flags, UTF-16 log parse, exit-code check
├── blob.js                    # thin wrapper around @vercel/blob put()
├── config.json                # NEXT_URL, COMPILER_SECRET, BLOB_READ_WRITE_TOKEN, POLL_INTERVAL_MS
├── logs\                      # NSSM redirects stdout/stderr here, rotated by NSSM
└── package.json

C:\Compiler\sources\           # MQL5 template + include files (populated per-robot in Phase 4)
```

### Pattern 1: Atomic Job Dequeue with `FOR UPDATE SKIP LOCKED`

**What:** Replace the racy `findFirst` + `update` in `/api/compiler/poll` with a single atomic transaction that locks and claims one row in one round-trip.

**When to use:** Any time multiple workers may poll the same queue table. Even with a single worker today, this future-proofs the pipeline for a second worker (which is a reasonable Phase 4+ ask).

**Example:**
```typescript
// src/app/api/compiler/poll/route.ts
// Source: Prisma issue #5983, Postgres SKIP LOCKED docs
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type ClaimedJob = {
  id: string;
  subscriptionId: string;
  attempts: number;
  mt5AccountNumber: string | null;
  expiresAt: Date | null;
};

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.COMPILER_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Update worker heartbeat every poll (upsert singleton row)
  await prisma.workerHeartbeat.upsert({
    where: { id: "compiler" },
    update: { lastSeenAt: new Date() },
    create: { id: "compiler", lastSeenAt: new Date() },
  });

  // Atomic claim: SELECT ... FOR UPDATE SKIP LOCKED + UPDATE in one tx.
  // Prisma has no native SKIP LOCKED support (issue #5983 open) — use $queryRaw.
  const claimed = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Compilation"
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
          "startedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE id = ${jobId}
    `;
    return tx.compilation.findUnique({
      where: { id: jobId },
      include: { subscription: true },
    });
  });

  if (!claimed || !claimed.subscription) {
    return NextResponse.json({ job: null }, { status: 200 });
  }

  return NextResponse.json({
    job: {
      id: claimed.id,
      // Additive-only fields; do not remove existing keys — worker parser may be strict
      mt5AccountNumber: claimed.subscription.mt5AccountNumber,
      expiresAt: claimed.subscription.expiresAt,
      attempts: claimed.attempts,
    },
  });
}
```

### Pattern 2: Direct-to-Blob Upload from External Worker

**What:** Windows worker calls `@vercel/blob`'s `put()` directly using `BLOB_READ_WRITE_TOKEN`. Only metadata (jobId, blobUrl, sha256, sizeBytes, status) is POSTed to `/api/compiler/complete`.

**When to use:** Whenever the client uploading is not a browser but a server-side process outside Vercel. This is Vercel's documented pattern for external workers and CI systems.

**Example (Windows worker Node.js):**
```javascript
// C:\Compiler\worker\blob.js
// Source: https://vercel.com/docs/vercel-blob/server-upload
//         https://vercel.com/docs/vercel-blob/using-blob-sdk
const { put } = require("@vercel/blob");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

async function uploadCompiledEA(jobId, filePath) {
  const buffer = await fs.readFile(filePath);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const fileName = `AL-ai-FX_GoldBot_${jobId}.ex5`;

  const blob = await put(`compiled/${fileName}`, buffer, {
    access: "private",
    contentType: "application/octet-stream",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,        // deterministic pathname for support / logs
  });

  return { blobUrl: blob.url, sha256, sizeBytes: buffer.length };
}

module.exports = { uploadCompiledEA };
```

**Example (Next.js `/complete` — now metadata-only):**
```typescript
// src/app/api/compiler/complete/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getExpectedCompiledFilename } from "@/lib/compiler-filename";

const MAX_ATTEMPTS = 3;

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.COMPILER_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId, status, blobUrl, sha256, sizeBytes, errorMessage } =
    (await req.json()) as {
      jobId: string;
      status: "COMPLETED" | "FAILED";
      blobUrl?: string;
      sha256?: string;
      sizeBytes?: number;
      errorMessage?: string;
    };

  if (!jobId || !status) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const job = await prisma.compilation.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (status === "COMPLETED") {
    if (!blobUrl) {
      return NextResponse.json({ error: "Missing blobUrl" }, { status: 400 });
    }
    // Optional but recommended: HEAD the blob URL to verify it exists & matches sha256
    // (adds one Vercel Blob API call — cheap and worth the confidence)
    await prisma.compilation.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        downloadUrl: blobUrl,
        // startedAt already set on poll; add completedAt if planner wants observability
      },
    });
    return NextResponse.json({ success: true });
  }

  // FAILED path: bounded retry
  if (job.attempts + 1 < MAX_ATTEMPTS) {
    await prisma.compilation.update({
      where: { id: jobId },
      data: {
        status: "PENDING",
        attempts: job.attempts + 1,
        startedAt: null,
      },
    });
  } else {
    await prisma.compilation.update({
      where: { id: jobId },
      data: { status: "FAILED", attempts: job.attempts + 1 },
    });
    // fire admin alert (async, don't block response)
  }
  return NextResponse.json({ success: false, retried: job.attempts + 1 < MAX_ATTEMPTS });
}
```

### Pattern 3: Vercel Cron-Driven Reaper

**What:** A GET route at `/api/cron/reap-stuck-jobs` that Vercel Cron invokes every minute. It flips `PROCESSING` rows whose `startedAt` is older than N minutes back to `PENDING` (bumping `attempts`) or `FAILED` (if attempts already exhausted).

**When to use:** Any long-running async pipeline on serverless. Vercel Cron only runs on production deployments, secured by `CRON_SECRET` in the `Authorization: Bearer` header. Delivery is best-effort — the reaper *must* be idempotent (it is: state transitions are conditional).

**Example:**
```typescript
// src/app/api/cron/reap-stuck-jobs/route.ts
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STUCK_JOB_MINUTES, MAX_ATTEMPTS } from "@/lib/compiler-config";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - STUCK_JOB_MINUTES * 60_000);

  const stuck = await prisma.compilation.findMany({
    where: { status: "PROCESSING", startedAt: { lt: cutoff } },
    select: { id: true, attempts: true },
  });

  const retried: string[] = [];
  const failed: string[] = [];
  for (const job of stuck) {
    if (job.attempts + 1 < MAX_ATTEMPTS) {
      await prisma.compilation.update({
        where: { id: job.id },
        data: { status: "PENDING", attempts: job.attempts + 1, startedAt: null },
      });
      retried.push(job.id);
    } else {
      await prisma.compilation.update({
        where: { id: job.id },
        data: { status: "FAILED", attempts: job.attempts + 1 },
      });
      failed.push(job.id);
    }
  }

  return Response.json({
    scanned: stuck.length,
    retried: retried.length,
    failed: failed.length,
  });
}
```

**`vercel.json`:**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/reap-stuck-jobs", "schedule": "* * * * *" }
  ]
}
```
Every minute. **On Hobby plan this fails deployment — Hobby is capped at once/day.** Verify plan before merging.

### Pattern 4: Admin Health Endpoint (Compile-Server Status)

**What:** Server-only route the admin dashboard fetches. Returns `{ status: 'green' | 'stale' | 'red', lastSeenAgoSeconds, oldestPendingAgeSeconds, stuckCount, failedLast24h }`.

**When to use:** Once for the admin page's "Compile Server" tile (CMPL-02).

**Example:**
```typescript
// src/app/api/admin/compiler-status/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HEARTBEAT_STALE_SECONDS, HEARTBEAT_DEAD_SECONDS } from "@/lib/compiler-config";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const [heartbeat, oldestPending, stuckCount, failedLast24h] = await Promise.all([
    prisma.workerHeartbeat.findUnique({ where: { id: "compiler" } }),
    prisma.compilation.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.compilation.count({
      where: {
        status: "PROCESSING",
        startedAt: { lt: new Date(Date.now() - 10 * 60_000) },
      },
    }),
    prisma.compilation.count({
      where: {
        status: "FAILED",
        updatedAt: { gt: new Date(Date.now() - 24 * 3600_000) },
      },
    }),
  ]);

  const now = Date.now();
  const lastSeenAgoSeconds = heartbeat
    ? Math.floor((now - heartbeat.lastSeenAt.getTime()) / 1000)
    : Infinity;

  let status: "green" | "stale" | "red";
  if (lastSeenAgoSeconds > HEARTBEAT_DEAD_SECONDS) status = "red";
  else if (lastSeenAgoSeconds > HEARTBEAT_STALE_SECONDS) status = "stale";
  else status = "green";

  return Response.json({
    status,
    lastSeenAgoSeconds: lastSeenAgoSeconds === Infinity ? null : lastSeenAgoSeconds,
    oldestPendingAgeSeconds: oldestPending
      ? Math.floor((now - oldestPending.createdAt.getTime()) / 1000)
      : null,
    stuckCount,
    failedLast24h,
  });
}
```

### Pattern 5: NSSM Windows Service Install

**What:** Wrap `node worker.js` as an auto-restarting Windows service with log rotation.

**When to use:** For persistence + crash recovery on the compile VPS. User has already picked this.

**Example (PowerShell as Administrator):**
```powershell
# Source: https://nssm.cc/usage , https://nssm.cc/commands
$svc = "ALaiFXCompiler"
$node = "C:\Program Files\nodejs\node.exe"
$workDir = "C:\Compiler\worker"
$script = "$workDir\worker.js"
$logDir = "$workDir\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# 1. Create the service
nssm install $svc $node $script

# 2. Working directory (so relative requires resolve)
nssm set $svc AppDirectory $workDir

# 3. Auto-restart tuning: wait 5 s between attempts, throttle if crash-loop
nssm set $svc AppExit Default Restart
nssm set $svc AppRestartDelay 5000
nssm set $svc AppThrottle 10000

# 4. Log to files, rotate at 10 MB or daily
nssm set $svc AppStdout "$logDir\worker.out.log"
nssm set $svc AppStderr "$logDir\worker.err.log"
nssm set $svc AppRotateFiles 1
nssm set $svc AppRotateOnline 1
nssm set $svc AppRotateSeconds 86400
nssm set $svc AppRotateBytes 10485760

# 5. Run as LocalSystem by default (default). If MetaEditor needs a real
#    user profile (registry hive, MT5 data folder), run as a domain/local
#    user instead:
# nssm set $svc ObjectName ".\CompilerUser" "PASSWORD"

# 6. Env vars — pass secrets in (or set them at the machine level in Windows)
nssm set $svc AppEnvironmentExtra `
  "NEXT_URL=https://al-ai-fx.xyz" `
  "COMPILER_SECRET=..." `
  "BLOB_READ_WRITE_TOKEN=..." `
  "POLL_INTERVAL_MS=5000"

# 7. Start it
nssm set $svc Start SERVICE_AUTO_START
nssm start $svc
```

### Anti-Patterns to Avoid

- **Multiple `new PrismaClient()` per route file** — CONCERNS.md item; exhausts Postgres pool on Vercel. Always import `{ prisma } from "@/lib/prisma"`.
- **`findFirst` + `update` as the dequeue** — race-prone; two workers can each claim the same PENDING row. Use `FOR UPDATE SKIP LOCKED`.
- **Passing the compiled `.ex5` through `/complete` as base64** — hits Vercel's 4.5 MB body limit at the edge before Node runs. Response streaming does not fix incoming request bodies.
- **Client polling with no timeout** — `LicenseManager.tsx` currently polls every 5 s forever. Cap at N attempts, back off, and surface a terminal timeout state.
- **Trusting `Compilation.updatedAt` as heartbeat proxy** — a quiet queue has no updates. Use a dedicated `WorkerHeartbeat` row updated on every poll (even null-result polls).
- **Running the reaper from the Windows worker itself** — if the worker is down, reaping doesn't happen. Reaper must be independent of worker liveness (Vercel Cron is that layer).
- **`updateMany` as an atomic dequeue** — Prisma issue #8612 confirms `updateMany` is not atomic against concurrent selects and does not return the row.
- **Leaving `middleware.ts` alongside `proxy.ts`** — Next.js 16 silently ignores `middleware.ts`; the file exists as `src/proxy.ts` already in this repo, so this is only a warning to future authors. AGENTS.md flags Next 16 differences.
- **Assuming `MetaEditor64.exe` returns a useful exit code** — community reports it exits `0` even on silent failures (bogus paths, invalid include dirs, missing DLLs). Must parse the log file. Log encoding is UTF-16.
- **Storing `BLOB_READ_WRITE_TOKEN` in the worker log or committing it to the worker repo** — this is a long-lived, unscoped read/write token. Store it in NSSM `AppEnvironmentExtra` or Windows machine-scoped env vars, never in a checked-in `config.json`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Windows service persistence | Custom Task Scheduler XML, PM2 configs, custom `sc.exe` wrapper | **NSSM** | User's choice; free auto-restart + log rotation + throttle + env inheritance |
| Job-queue atomic dequeue | Manual advisory locks in Postgres, per-worker `LISTEN`/`NOTIFY`, Redis SETNX | **Postgres `FOR UPDATE SKIP LOCKED` via `$queryRaw`** | Battle-tested; native to the DB we already have; no new dependency; industry-standard for lightweight queues |
| Sub-daily cron on Vercel | External cron-job.org / EasyCron / GitHub Actions cron | **Vercel Cron** (with Pro plan) | First-party, secured by `CRON_SECRET`, deployed with the app, visible in Vercel dashboard. If Hobby plan → use GitHub Actions or an external pinger. |
| Large-file upload to Vercel Blob from outside Vercel | Base64 body through serverless function, multipart chunking through function, custom pre-signed URL scheme | **Server-side `put()` with `BLOB_READ_WRITE_TOKEN` from the worker itself** | Officially recommended by Vercel Blob docs; bypasses 4.5 MB body limit at the source; no new endpoint required |
| MetaEditor CLI wrapper | Screen-scraping UI with AutoHotkey (community workaround) | `metaeditor64.exe /compile:... /log:... /inc:...` + UTF-16 log parse | The CLI works — just needs the right flags and log-based error detection |
| Admin email alert transport | Raw Nodemailer / SES SDK | Existing `mailtrap` client in `src/lib/mail.ts` | Already integrated; template pattern is set |
| Prisma singleton | Fresh `new PrismaClient()` per file | `import { prisma } from "@/lib/prisma"` | Already exists in `src/lib/prisma.ts`. Just use it. |
| Filename generation | Ad-hoc string literals in complete & download routes | `getCompiledFilename({ robotSlug = "GoldBot", jobId, version = "v2.0" })` helper | Fixes the current `AL-ai-FX_GoldBot_<jobId>.ex5` vs `GoldBot_v2.0_<jobId>.ex5` mismatch; sets up Phase 4 multi-robot naming |

**Key insight:** Every "custom" bit of this pipeline has a boring, well-known solution — NSSM for persistence, SKIP LOCKED for queues, Vercel Cron for scheduling, direct-to-Blob `put()` for uploads. Do not invent anything. The value in Phase 1 is *plumbing the boring parts together*, not designing a new queue.

## Common Pitfalls

### Pitfall 1: Vercel 4.5 MB Body Limit Applies to Incoming Requests Only
**What goes wrong:** Developers try to "stream" the base64 payload or set `maxDuration` and expect the body limit to relax. It doesn't. The 4.5 MB is enforced at the platform edge before your function code runs, and only applies to the *incoming request body*. Outgoing responses can stream freely.
**Why it happens:** Confusion between "function body limit" (incoming) and "response streaming" (outgoing).
**How to avoid:** Do not pass the `.ex5` through the function at all. Upload directly from the Windows worker to Vercel Blob using the static `BLOB_READ_WRITE_TOKEN`.
**Warning signs:** `413 FUNCTION_PAYLOAD_TOO_LARGE` in Vercel logs before the function's own logs. Any base64 field larger than ~3.3 MB (which decodes to 2.5 MB raw) is at risk.
Source: https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions

### Pitfall 2: MetaEditor64 Returns Exit Code 0 On Silent Failures
**What goes wrong:** `metaeditor64.exe` may exit successfully even when compilation produces no `.ex5` — e.g., bogus paths, wrong `/inc` directory, missing DLL, syntax error in included file. Community reports: *"metaeditor.exe just exits without doing anything"* even with bogus arguments.
**Why it happens:** MetaEditor is primarily a GUI tool; the CLI path is not exit-code-friendly.
**How to avoid:** After every compile, (a) verify the expected `.ex5` file exists on disk, (b) parse the `/log` file (UTF-16 encoded) for `Error` / `Warning` lines, (c) treat "log contains errors" or "no `.ex5` produced" as failure regardless of exit code.
**Warning signs:** Jobs marked COMPLETED with a `.ex5` that's actually an old cached build, or PROCESSING → COMPLETED transitions with no new file on disk.
Source: https://www.mql5.com/en/forum/367908 , https://www.mql5.com/en/forum/491543 , https://www.mql5.com/en/forum/367482

### Pitfall 3: MetaEditor Log Files Are UTF-16 LE
**What goes wrong:** Default `fs.readFile(path, "utf8")` reads UTF-16 as garbage bytes; error detection silently misses everything.
**Why it happens:** MetaEditor writes logs in UTF-16 LE, not UTF-8.
**How to avoid:** Read log with `fs.readFile(path)` (no encoding) then `buffer.toString("utf16le")`. Strip BOM if present.
**Warning signs:** Log-based error detection never triggers even when compile visibly fails.
Source: https://www.mql5.com/en/forum/234780 , https://www.mql5.com/en/forum/367482

### Pitfall 4: Windows Defender Deletes MetaEditor Under Themida Protection
**What goes wrong:** MT5 binaries are packed with Themida code protection; Defender / Kaspersky / Bitdefender flag them as malware. `terminal64.exe` and `metaeditor64.exe` can be quarantined mid-compile, appearing to the worker as random compilation failures.
**Why it happens:** Themida obfuscation is indistinguishable from packers used by real malware. It's a well-known industry issue.
**How to avoid:** Add Defender exclusions for the MT5 install directory, worker directory, and both `metaeditor64.exe` and `terminal64.exe` processes.
**Warning signs:** Intermittent compile failures with no MQL5-level error in the log; missing binaries after Windows Update runs a Defender scan.
Source: https://www.mql5.com/en/forum/462628/page2 , https://www.mql5.com/en/forum/346504 , https://learn.microsoft.com/en-us/defender-endpoint/navigate-defender-endpoint-antivirus-exclusions

### Pitfall 5: Vercel Cron Requires Pro Plan for Sub-Daily Intervals
**What goes wrong:** Hobby users can only schedule cron jobs *once per day*. Any expression more frequent than daily "will fail deployment." The reaper strategy assumes a 1-minute cron.
**Why it happens:** Vercel intentionally rate-limits cron on Hobby.
**How to avoid:** Verify the account is on Pro before locking in Vercel Cron. Fallback if Hobby: external cron pinger (cron-job.org) or GitHub Actions on a schedule pinging the same endpoint. All still use the same `CRON_SECRET` bearer-token pattern.
**Warning signs:** `vercel deploy` fails at build time with a cron-schedule error.
Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs (Cron jobs accuracy section)

### Pitfall 6: Vercel Cron Best-Effort Delivery + No Retry
**What goes wrong:** Vercel Cron will occasionally *miss* a scheduled run entirely (transient network error) or *invoke it twice*. Neither case is retried automatically.
**Why it happens:** Cron delivery is explicitly documented as best-effort. Failed invocations are not retried.
**How to avoid:** The reaper is naturally idempotent (state transitions gated by current status + startedAt threshold), so double-invocation is safe. To handle *missed* invocations, always reap all rows past threshold — not just those crossed threshold in the last minute.
**Warning signs:** A stuck job survives longer than the threshold suggests it should. Check runtime logs for gaps.
Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs (Cron job delivery and idempotency section)

### Pitfall 7: Prisma `updateMany` Is Not Atomic
**What goes wrong:** Under concurrent load, `updateMany({ where: { status: 'PENDING' }, data: { status: 'PROCESSING' } })` can update the same row twice (issue #8612 for MySQL specifically; also weaker guarantees than `FOR UPDATE SKIP LOCKED` on Postgres because it doesn't return the row and requires a follow-up `findFirst`).
**Why it happens:** `updateMany` emits SELECT then UPDATE as separate operations; and even with a single-worker deployment today, a second worker in Phase 4+ triggers the race.
**How to avoid:** Use `$queryRaw` with `FOR UPDATE SKIP LOCKED` inside `$transaction`. Prisma issue #5983 tracks native support; still open as of 2026-07.
**Warning signs:** Two `PROCESSING` rows created from what should be one `PENDING`; duplicate `.ex5` uploads.
Source: https://github.com/prisma/prisma/issues/5983 , https://github.com/prisma/prisma/issues/8612

### Pitfall 8: NSSM Suicide Requirement for Pre-Vista + Windows Reporting Confusion
**What goes wrong:** By default NSSM restarts crashed apps *itself*. If the user wants Windows Service Control Manager to see the failure (and trigger native recovery actions), NSSM must be told to exit rather than restart.
**Why it happens:** NSSM shields the underlying app from SCM by default — a good default, but hides the failure from Windows.
**How to avoid:** For the compile worker, keep the default (NSSM restarts). If we want SCM-level recovery + email-on-crash via Windows Event Log, set `AppExit Default Exit` (not `Suicide` — Suicide is only for pre-Vista compatibility).
**Warning signs:** Windows Server Manager shows the service as "Running" even during a crash loop.
Source: https://nssm.cc/scenarios , https://nssm.cc/commands

### Pitfall 9: Static `BLOB_READ_WRITE_TOKEN` Is Long-Lived and Unscoped
**What goes wrong:** The token is a *bearer* credential with full read+write to the entire Blob store. If it leaks (logs, git, RDP screenshot), an attacker can read every compiled `.ex5` and overwrite them.
**Why it happens:** Static server tokens are unscoped by design — the tradeoff for not needing a token-exchange handshake.
**How to avoid:** Store only in NSSM `AppEnvironmentExtra` or Windows machine-scoped env vars. Never log its value. Never commit `config.json` with it. Rotate on any suspected exposure (Vercel dashboard → Blob store → Manage tokens).
**Warning signs:** Presence of `BLOB_READ_WRITE_TOKEN` in worker stdout/stderr logs, in RDP screen shares, or in any git history.
Source: https://vercel.com/docs/vercel-blob/using-blob-sdk

### Pitfall 10: `next-intl` + `next-auth` Middleware Both Live in `proxy.ts` (Next 16)
**What goes wrong:** In Next.js 16, `middleware.ts` was renamed to `proxy.ts`. A leftover `middleware.ts` file is *silently ignored* — auth/CSRF/i18n stops running, and protected routes go public.
**Why it happens:** Silent deprecation to reduce Express-middleware confusion.
**How to avoid:** This repo already uses `src/proxy.ts` — verify no stray `middleware.ts` gets introduced. Any new middleware logic goes into `proxy.ts`. Cron and compile endpoints are already listed correctly in the matcher.
**Warning signs:** CSRF errors disappear, `/dashboard` becomes accessible without a session — usually only visible in staging where a `middleware.ts` file was accidentally committed.
Source: https://nextjs.org/docs/messages/middleware-to-proxy

### Pitfall 11: `prisma db push` Diverges Schema Between Environments
**What goes wrong:** `prisma/migrations/` is not in the repo (STATE.md blocker). `db push` on one env silently diverges from another — Phase 3 will formalize migrations, but Phase 1 schema changes could get lost.
**Why it happens:** `db push` doesn't record a migration file; only `prisma migrate dev` does.
**How to avoid:** Document the Phase 1 schema deltas (`startedAt`, `attempts`, `WorkerHeartbeat`) in the plan as SQL snippets *even though* we apply them via `db push`. Phase 3 formalizes them via `migrate diff` or a fresh baseline migration. The Windows VPS DB and the Coolify prod DB must both receive the `db push` at the same time — do it as a coordinated step in the plan.
**Warning signs:** Phase 2 or later dev on a fresh laptop fails with "column does not exist" errors.

### Pitfall 12: Client Polling Never Terminates
**What goes wrong:** `LicenseManager.tsx:32-50` polls `/api/licenses/status` every 5 s while `isPolling` is true. If a job stays PROCESSING (bug fixed by reaper, but client is upstream of it), the tab hits the API forever.
**Why it happens:** No max attempts, no timeout, no backoff, no terminal error state.
**How to avoid:** Cap at ~60 attempts (5 min) or use exponential backoff (5→10→20→30 s capped). After cap, set a terminal `TIMED_OUT` UI state that says "Compilation is taking longer than expected — an email will be sent when ready." Client-side polling is a fallback; the reaper + admin alert handle the hard cases.
**Warning signs:** Postgres CPU pinned on `Compilation` reads; runtime logs full of the same jobId at 5 s intervals for hours.

## Code Examples

Verified patterns from official sources:

### Prisma Singleton (Next.js 16 App Router)
```typescript
// src/lib/prisma.ts — corrected version
// Source: https://vercel.com/kb/guide/nextjs-prisma-postgres (Next.js 16 guide)
//         https://www.prisma.io/docs/guides/frameworks/nextjs
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error", "warn"] : ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```
(Note: current `src/lib/prisma.ts` uses `global` cast; `globalThis` is safer and TS-canonical. Also gates `log: "query"` on env — fixes CONCERNS.md item.)

### Vercel Cron Secret Verification
```typescript
// src/app/api/cron/reap-stuck-jobs/route.ts (auth prelude)
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs
import type { NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ... reaper logic
}
```

### `@vercel/blob` Server-Side `put()` from External Host
```javascript
// C:\Compiler\worker\blob.js
// Source: https://vercel.com/docs/vercel-blob/server-upload
//         https://vercel.com/docs/vercel-blob/using-blob-sdk
const { put } = require("@vercel/blob");

const blob = await put(pathname, fileBuffer, {
  access: "private",            // or "public"; keep "private" for .ex5 IP
  contentType: "application/octet-stream",
  token: process.env.BLOB_READ_WRITE_TOKEN,
  addRandomSuffix: false,        // deterministic path for support
});
// blob.url is the URL to store in Compilation.downloadUrl
```

### MetaEditor64 CLI Invocation with UTF-16 Log Parse
```javascript
// C:\Compiler\worker\metaeditor.js
// Source: https://www.mql5.com/en/forum/394405/30324400 , https://www.mql5.com/en/forum/367908
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

async function compileMQL5({ metaEditorPath, sourceFile, includeDir, logFile }) {
  await new Promise((resolve, reject) => {
    const child = spawn(metaEditorPath, [
      `/compile:${sourceFile}`,
      `/inc:${includeDir}`,
      `/log:${logFile}`,
    ]);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Exit ${code}`)));
  });

  // Log is UTF-16 LE — read as buffer then decode
  const logBuf = await fs.readFile(logFile);
  const logText = logBuf.toString("utf16le").replace(/^﻿/, "");
  const errorLine = logText.match(/^.*(error|Error).*$/m);
  const warningLine = logText.match(/^.*(warning|Warning).*$/m);

  // Also verify the .ex5 exists on disk — exit code + log both lie sometimes
  const expectedEx5 = sourceFile.replace(/\.mq5$/i, ".ex5");
  let ex5Exists = false;
  try {
    const st = await fs.stat(expectedEx5);
    ex5Exists = st.isFile() && st.size > 0;
  } catch { /* not there */ }

  if (errorLine || !ex5Exists) {
    return { ok: false, error: errorLine?.[0] ?? "No .ex5 produced", log: logText };
  }
  return { ok: true, ex5Path: expectedEx5, warning: warningLine?.[0] };
}
module.exports = { compileMQL5 };
```

### Schema Delta (Phase 1)
```prisma
// prisma/schema.prisma additions
model Compilation {
  id             String        @id @default(cuid())
  subscriptionId String
  subscription   Subscription  @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  status         CompileStatus @default(PENDING)
  downloadUrl    String?
  startedAt      DateTime?                       // NEW — set on POLL, cleared on retry
  attempts       Int           @default(0)       // NEW — incremented per retry
  errorMessage   String?                         // NEW — last failure reason (optional; helps admin)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@index([status, createdAt])                   // NEW — speeds up FOR UPDATE SKIP LOCKED scan
  @@index([status, startedAt])                   // NEW — reaper scan
}

model WorkerHeartbeat {                          // NEW — single-row singleton keyed "compiler"
  id           String   @id                      // always "compiler"
  lastSeenAt   DateTime
  workerVersion String? // optional — bump on worker deploys
  updatedAt    DateTime @updatedAt
}
```

### Client Polling Cap (bounded backoff)
```typescript
// src/components/dashboard/LicenseManager.tsx — replace the useEffect
// Source: existing code + CONCERNS.md pattern recommendation
const POLL_INITIAL_MS = 5_000;
const POLL_MAX_MS = 30_000;
const POLL_TIMEOUT_MS = 5 * 60_000; // 5 min

useEffect(() => {
  if (!isPolling || !compilation?.id) return;
  const started = Date.now();
  let delay = POLL_INITIAL_MS;
  let timer: NodeJS.Timeout;

  const tick = async () => {
    if (Date.now() - started > POLL_TIMEOUT_MS) {
      setIsPolling(false);
      setCompilation((c) => c && ({ ...c, status: "TIMED_OUT" } as typeof c));
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
    delay = Math.min(delay * 1.5, POLL_MAX_MS);
    timer = setTimeout(tick, delay);
  };
  timer = setTimeout(tick, delay);
  return () => clearTimeout(timer);
}, [isPolling, compilation?.id, router]);
```
(`TIMED_OUT` is a client-only UI state, not a `CompileStatus` enum value. If planner wants a real terminal state, add `TIMED_OUT` to the enum — coordinate with the reaper's failure path.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js `middleware.ts` | Next.js 16 `proxy.ts` | Next 16 release (2025-Q4) | Silent breakage if not renamed; this repo is already correct |
| Base64 through serverless function body | Direct-to-blob upload with server-side `put()` from external process | Vercel Blob 2.x (2025) | Deletes 4.5 MB body limit; simpler pipeline |
| External cron for scheduled jobs | Vercel Cron (built-in, `CRON_SECRET`-secured) | GA'd 2024 | First-party, deploys with the app; still needs Pro plan for sub-daily |
| Fresh `PrismaClient` per file | Global singleton on `globalThis` | Long-standing Prisma guidance | Only pattern that survives Vercel serverless connection pool exhaustion |
| Prisma `findFirst` + `update` | Postgres `FOR UPDATE SKIP LOCKED` via `$queryRaw` | N/A — this is the standard pattern; Prisma native support still pending (#5983) | Multi-worker safety; industry standard |
| `console.log`-only observability | (out of Phase 1 scope but noted) structured logging + Sentry | Sentry Next.js 16 SDK GA'd 2025 | Better error tracking; deferred per PROJECT.md scope |

**Deprecated/outdated:**
- `middleware.ts` in Next.js 16 — renamed to `proxy.ts` (silent deprecation, high risk).
- `prisma db push` for production schema — Phase 3 will introduce checked-in migrations; used in Phase 1 as a stopgap.
- Prisma `log: ["query"]` unconditionally — fix in Phase 1 as part of CMPL-05.

## Open Questions

1. **Is the Vercel account on Hobby or Pro?**
   - What we know: Vercel Cron sub-daily requires Pro. Reaper design depends on 1-minute cron.
   - What's unclear: Not stated in project docs. Fallback: external cron (cron-job.org / GitHub Actions cron) pinging the same endpoint with the same `CRON_SECRET` bearer token — architecturally identical.
   - Recommendation: Planner should surface this as an early task ("Verify Vercel plan; if Hobby, add external cron pinger instead of `vercel.json` cron entry"). No design change either way.

2. **What language/runtime does the existing Windows worker use?**
   - What we know: Not visible from the repo. The Next.js side treats it as a black box.
   - What's unclear: Whether the worker is Node.js, PowerShell, C#, or something else. This affects whether we can drop `@vercel/blob` in directly, or whether we need a language-specific Blob upload path.
   - Recommendation: **First plan task must SSH/RDP the VM and inspect worker source before locking in language.** If not Node, either rewrite the worker in Node (small, ~150 LOC) or call Blob via the raw REST API (`PUT https://<store>.public.blob.vercel-storage.com/<path>` with bearer token — works from any language).

3. **Does the existing worker parser tolerate additive fields on `/api/compiler/poll`?**
   - What we know: STATE.md flags this as a Phase 4 concern. Any field renames could break it.
   - What's unclear: Whether adding `attempts` to the poll response body will break the current worker.
   - Recommendation: Keep the response shape backwards-compatible in Phase 1 (do not remove `mt5AccountNumber`, `expiresAt`; only add). If the worker parser is truly strict, versioning (`/api/compiler/v2/poll`) waits for Phase 4 — Phase 1 sticks with additive extension.

4. **Should the reaper send a per-job email to the user on retry-exhausted `FAILED`?**
   - What we know: Phase 5 (DLVR-03) covers user failure emails. CMPL-04 (this phase) only requires bounded retry.
   - What's unclear: Whether "bounded retry" implies user notification, or just DB state.
   - Recommendation: In Phase 1, reaper sends **admin** alert only (CMPL-02, DLVR-04 is Phase 5). User-facing failure email lives in Phase 5. Coordinate with roadmapper if this seems wrong.

5. **What is the acceptable stuck-job threshold?**
   - What we know: Not stated in requirements. Typical MQL5 compile completes in 10–30 seconds.
   - What's unclear: 5 min? 10 min? 15 min?
   - Recommendation: Start conservative — `STUCK_JOB_MINUTES = 10`, `HEARTBEAT_STALE_SECONDS = 90` (2 polls at 30 s), `HEARTBEAT_DEAD_SECONDS = 300` (5 min). Put these in `src/lib/compiler-config.ts` so they're easy to tune post-launch.

6. **`WorkerHeartbeat` in `Compilation` table or its own model?**
   - What we know: Both work. Options provided by orchestrator.
   - What's unclear: Preference.
   - Recommendation: **Dedicated `WorkerHeartbeat` model with `id = "compiler"` as singleton row** — cleaner semantically, avoids abusing the `Compilation` model, one row forever. Multi-worker future can key by workerId. Trade-off: adds one small table. Worth it.

7. **NSSM run-as-user: LocalSystem vs a dedicated user?**
   - What we know: LocalSystem is the default and simplest.
   - What's unclear: Whether MetaEditor needs a real user profile (its data folder is under `%APPDATA%\MetaQuotes`; LocalSystem's APPDATA is `C:\Windows\System32\config\systemprofile\AppData\Roaming` — often fine, but MT5 sometimes doesn't like it).
   - Recommendation: **Start with LocalSystem; if MetaEditor complains about profile/data folder, switch to a dedicated local user account with `nssm set $svc ObjectName`.** Flag as a possible re-work in the plan.

## Sources

### Primary (HIGH confidence)
- https://vercel.com/docs/vercel-blob/server-upload — 4.5 MB limit warning + server-side `put()` with static `BLOB_READ_WRITE_TOKEN` for code running outside Vercel (last updated 2026-05-19)
- https://vercel.com/docs/vercel-blob/client-upload — client-upload token exchange (alternative, but overkill for our use case) (last updated 2026-03-27)
- https://vercel.com/docs/cron-jobs — cron expression format, invocation via GET, `x-vercel-cron-schedule` header (last updated 2026-06-16)
- https://vercel.com/docs/cron-jobs/manage-cron-jobs — `CRON_SECRET` bearer verification, best-effort delivery, Hobby vs Pro limits, idempotency guidance (last updated 2026-06-02)
- https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions — official confirmation of the 4.5 MB body limit + workarounds
- https://nextjs.org/docs/messages/middleware-to-proxy — Next.js 16 middleware→proxy migration (silent deprecation warning)
- https://vercel.com/kb/guide/nextjs-prisma-postgres — Next.js 16 + Prisma singleton pattern
- https://www.prisma.io/docs/guides/frameworks/nextjs — Prisma + Next.js singleton, connection pooling
- https://github.com/prisma/prisma/issues/5983 — confirmation Prisma has no native `FOR UPDATE SKIP LOCKED` support (still open in 2026-07); recommends `$queryRaw`
- https://nssm.cc/usage , https://nssm.cc/commands , https://nssm.cc/scenarios — official NSSM docs

### Secondary (MEDIUM confidence — WebSearch or forum, cross-verified with at least one credible source)
- https://www.mql5.com/en/forum/367908 — MetaEditor64 CLI flags `/compile`, `/inc`, `/log`; silent failure warning (multiple contributors confirm)
- https://www.mql5.com/en/forum/491543 — silent failures on large modular MQL5 projects
- https://www.mql5.com/en/forum/394405/30324400 — explicit CLI example with `/inc:` and `/log:`; verifies syntax used
- https://www.mql5.com/en/forum/367482 — UTF-16 log encoding and `/log` parameter behavior
- https://github.com/prisma/prisma/issues/8612 — `updateMany` not atomic under concurrency; MySQL-focused but Postgres has similar semantics
- https://nerdleveltech.com/pg-boss-postgres-job-queue-node-typescript-production-tutorial — pg-boss uses same `FOR UPDATE SKIP LOCKED` pattern; production-tested reference

### Tertiary (LOW confidence — single source, flag for validation)
- https://www.mql5.com/en/forum/462628/page2 , https://www.mql5.com/en/forum/346504 — Windows Defender / Bitdefender flagging MetaEditor/Terminal64 as malware. Community-reported false positives around Themida packer; cross-verified as a widespread issue but no Microsoft source directly confirming MetaEditor specifically.
- https://medium.com/@connect.hashblock/10-prisma-transaction-patterns-that-avoid-deadlocks-4f52a174760b — extra deadlock-avoidance patterns; useful but supplemental.

## Metadata

**Confidence breakdown:**
- Standard stack (Prisma, Vercel Blob, Next 16, NSSM): **HIGH** — all verified against official docs and used in current Vercel/Next patterns as of 2026-07.
- Architecture patterns (atomic dequeue, direct-to-blob, cron reaper, heartbeat table): **HIGH** — every pattern has an official recommendation or a canonical community reference.
- Pitfalls: **HIGH** for Vercel/Next/Prisma pitfalls (all sourced from official docs); **MEDIUM** for MetaEditor-specific pitfalls (community forums only, but multiple corroborating threads).
- MetaEditor CLI exit codes and log format: **MEDIUM** — MQL5's official CLI reference wasn't reproduced verbatim in the fetched forum threads. Recommendation for planner: first Windows worker plan task should include a "smoke test on the VPS" that verifies the exact behavior against the installed MT5 version.
- Windows Defender exclusion effectiveness: **LOW-MEDIUM** — well-documented community issue; the specific exclusion syntax is Microsoft-official.

**Research date:** 2026-07-04
**Valid until:** 2026-08-04 (30 days — Vercel and Next.js APIs are relatively stable; if this phase slips more than 30 days, re-verify Vercel Cron plan limits and `@vercel/blob` API for any breaking changes).
