---
phase: 01-restore-compile-delivery
plan: 02
type: execute
wave: 2
depends_on: ["01-01"]
files_modified:
  - src/app/api/compiler/complete/route.ts
  - src/app/api/compiler/download/route.ts
  - src/lib/compiler-filename.ts
  - "VM:C:\\Users\\Administrator\\Documents\\autocompiler-daemon\\daemon.js"
  - "VM:C:\\Users\\Administrator\\Documents\\autocompiler-daemon\\package.json"
  - "VM:al-ai-fx-daemon NSSM service env"
  - "Vercel env COMPILER_SECRET (rotation)"
autonomous: true

user_setup:
  - service: vercel-blob
    why: "Windows daemon needs BLOB_READ_WRITE_TOKEN to upload compiled .ex5 directly to Blob (bypasses 4.5 MB body limit)"
    env_vars:
      - name: BLOB_READ_WRITE_TOKEN
        source: "Vercel Dashboard -> Storage -> Blob -> Manage Tokens (Read/Write, unscoped, static)"
    dashboard_config:
      - task: "If any prior BLOB_READ_WRITE_TOKEN is suspected leaked, rotate before use"
        location: "Vercel Dashboard -> Storage -> al-ai-fx blob store -> Tokens"

must_haves:
  truths:
    - "Windows daemon fails fast on missing COMPILER_SECRET env var (no hardcoded fallback string in daemon.js)"
    - "Windows daemon fails fast on missing BLOB_READ_WRITE_TOKEN env var"
    - "Windows daemon uploads compiled .ex5 directly to Vercel Blob via @vercel/blob put(), then POSTs metadata-only body to /api/compiler/complete"
    - "MetaEditor success is decided by (exit code == 0) AND (.ex5 exists on disk) AND (log has no error/Error/Error: line) AND (.ex5 size > 0) — all four must be true"
    - "After successful upload, daemon deletes compiled_${id}.mq5 + compiled_${id}.ex5 + compile_${id}.log from disk"
    - "/api/compiler/complete accepts { jobId, status, blobUrl?, sha256?, sizeBytes?, errorMessage? } and no longer accepts fileDataBase64"
    - "/api/compiler/complete stores blobUrl in Compilation.downloadUrl and sha256/sizeBytes on the row"
    - "/api/compiler/complete on FAILED status decrements retry budget: if attemptCount + 1 < MAX_ATTEMPTS, reset to PENDING + increment attemptCount; else mark FAILED terminal"
    - "/api/compiler/download streams the same file the /complete route wrote (single filename source of truth via getCompiledFilename helper)"
    - "COMPILER_SECRET rotated: new value only exists in Vercel env + NSSM service env; old value revoked"
  artifacts:
    - path: "src/lib/compiler-filename.ts"
      provides: "Single source of truth for compiled filename generation"
      exports: ["getCompiledFilename"]
    - path: "src/app/api/compiler/complete/route.ts"
      provides: "Metadata-only endpoint accepting {jobId, status, blobUrl, sha256, sizeBytes, errorMessage}; no base64; bounded-retry FAILED path"
      exports: ["POST"]
    - path: "src/app/api/compiler/download/route.ts"
      provides: "Streams stored blobUrl using getCompiledFilename for Content-Disposition"
      exports: ["GET"]
    - path: "VM:C:\\Users\\Administrator\\Documents\\autocompiler-daemon\\daemon.js"
      provides: "Direct-to-Blob upload, no fallback secret, triple-check MetaEditor success, cleanup post-upload"
  key_links:
    - from: "daemon.js (VM)"
      to: "Vercel Blob store"
      via: "@vercel/blob put() with BLOB_READ_WRITE_TOKEN"
      pattern: "put\\(.*compiled/"
    - from: "daemon.js (VM)"
      to: "/api/compiler/complete"
      via: "POST metadata-only JSON body { jobId, status, blobUrl, sha256, sizeBytes }"
      pattern: "/complete.*blobUrl"
    - from: "src/app/api/compiler/complete/route.ts"
      to: "prisma.compilation.update"
      via: "downloadUrl = blobUrl on COMPLETED, PENDING requeue on FAILED w/ attempts left"
      pattern: "downloadUrl:.*blobUrl|status: 'PENDING'"
    - from: "src/app/api/compiler/download/route.ts"
      to: "getCompiledFilename helper"
      via: "import + call for Content-Disposition filename"
      pattern: "getCompiledFilename"
---

<objective>
Kill the 4.5 MB body-limit risk and the hardcoded-secret liability in the daemon at the same time. The Windows worker uploads the compiled `.ex5` directly to Vercel Blob using `@vercel/blob`'s `put()` with a static server token; only metadata (jobId, blobUrl, sha256, sizeBytes, status) is POSTed back to `/api/compiler/complete`. The Next.js side stops accepting base64 payloads. As a coordinated part of the same rewrite, we rotate `COMPILER_SECRET` (the current value is in the daemon.js hardcoded fallback + this session's transcript) and drop the fallback so a missing env var causes the daemon to exit loudly instead of silently authenticating with a leaked secret. We also consolidate `/complete` and `/download` on one filename helper so the current mismatch (`AL-ai-FX_GoldBot_...` vs `GoldBot_v2.0_...`) stops breaking downloads.

Purpose: Addresses CMPL-06 (base64 payload risk), CMPL-04 (bounded retry in /complete's FAILED path), F1 (hardcoded fallback secret), F2 (filename mismatch), F5 (MetaEditor success detection), F6 (disabled cleanup) from VM-INSPECTION.md.

Output: Rewritten daemon.js, `@vercel/blob` installed on VM, new NSSM env vars in place, new COMPILER_SECRET rotated, refactored `/complete` route, new `src/lib/compiler-filename.ts` helper, updated `/download` route.
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/01-restore-compile-delivery/1-RESEARCH.md
@.planning/phases/01-restore-compile-delivery/1-VM-INSPECTION.md
@src/app/api/compiler/complete/route.ts
@src/app/api/compiler/download/route.ts
@/tmp/al-ai-fx-vm-dump/daemon.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor /api/compiler/complete + /download + add compiler-filename helper</name>
  <files>
src/app/api/compiler/complete/route.ts
src/app/api/compiler/download/route.ts
src/lib/compiler-filename.ts
  </files>
  <action>
Three coordinated Next.js-side edits. Do them in this order so download always reads the same filename `complete` wrote.

1. **Create `src/lib/compiler-filename.ts`** — the single source of truth. Contents:

```typescript
/**
 * Compiled EA filename generation. Used by BOTH /api/compiler/complete
 * (write path — becomes the Blob pathname) AND /api/compiler/download
 * (read path — becomes Content-Disposition filename).
 *
 * Phase 1: single-robot (GoldBot). Phase 4 will thread robotSlug through.
 */
export function getCompiledFilename(jobId: string, opts?: { robotSlug?: string }): string {
  const slug = opts?.robotSlug ?? "GoldBot";
  return `AL-ai-FX_${slug}_${jobId}.ex5`;
}

/** Blob pathname (prefix + filename). */
export function getCompiledBlobPathname(jobId: string, opts?: { robotSlug?: string }): string {
  return `compiled/${getCompiledFilename(jobId, opts)}`;
}
```

The helper always returns `AL-ai-FX_GoldBot_${jobId}.ex5` for Phase 1. This matches what the current `/complete` route was already writing at `src/app/api/compiler/complete/route.ts:54`. `/download`'s incorrect `GoldBot_v2.0_${jobId}.ex5` is the one that changes.

2. **Rewrite `src/app/api/compiler/complete/route.ts`** — replace the entire file (currently 96 lines) with the metadata-only version:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MAX_ATTEMPTS } from '@/lib/compiler-config';

type CompletePayload = {
  jobId?: string;
  status?: 'COMPLETED' | 'FAILED';
  blobUrl?: string;
  sha256?: string;
  sizeBytes?: number;
  errorMessage?: string;
};

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.COMPILER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CompletePayload;
  try {
    body = (await req.json()) as CompletePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { jobId, status, blobUrl, sha256, sizeBytes, errorMessage } = body;

  if (!jobId || (status !== 'COMPLETED' && status !== 'FAILED')) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const job = await prisma.compilation.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (status === 'COMPLETED') {
    if (!blobUrl) {
      return NextResponse.json({ error: 'Missing blobUrl' }, { status: 400 });
    }
    await prisma.compilation.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        downloadUrl: blobUrl,
        sha256: sha256 ?? null,
        sizeBytes: sizeBytes ?? null,
        errorMessage: null,
      },
    });
    return NextResponse.json({ success: true }, { status: 200 });
  }

  // FAILED path: bounded retry via attemptCount vs MAX_ATTEMPTS.
  const nextAttempt = job.attemptCount + 1;
  if (nextAttempt < MAX_ATTEMPTS) {
    await prisma.compilation.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        attemptCount: nextAttempt,
        attemptedAt: null,
        errorMessage: errorMessage ?? null,
      },
    });
    return NextResponse.json({ success: false, requeued: true, attempt: nextAttempt }, { status: 200 });
  }

  await prisma.compilation.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      attemptCount: nextAttempt,
      errorMessage: errorMessage ?? null,
    },
  });
  return NextResponse.json({ success: false, requeued: false, attempt: nextAttempt }, { status: 200 });
}
```

Deletions vs current file: remove all `fileDataBase64` handling, remove `import { put } from '@vercel/blob'`, remove `import { validateFileSize } from '@/lib/validation'` — the route no longer uploads. Keep the auth bearer pattern intact.

3. **Update `src/app/api/compiler/download/route.ts`** — replace only the filename literal and the fetched-blob header handling. Read the current file first, then:

  - Add `import { getCompiledFilename } from '@/lib/compiler-filename';` alongside existing imports.
  - Replace line 47's `const fileName = \`GoldBot_v2.0_${jobId}.ex5\`;` with `const fileName = getCompiledFilename(jobId);`.
  - Do NOT change the auth check, ownership check, or blob-fetch bearer header — those stay.

Filename now matches what the daemon uploaded and what `/complete` recorded — `AL-ai-FX_GoldBot_${jobId}.ex5`. Download works.
  </action>
  <verify>
`npx tsc --noEmit` runs cleanly (no type errors) — the Prisma client has attemptCount + sha256 + sizeBytes + errorMessage from Plan 01.
`grep -c "fileDataBase64" src/app/api/compiler/complete/route.ts` returns 0.
`grep -c "getCompiledFilename" src/app/api/compiler/download/route.ts` returns 1.
`grep -c "MAX_ATTEMPTS" src/app/api/compiler/complete/route.ts` returns 1.
`npm run build` produces no errors related to `/api/compiler/*` routes.
Unit smoke via curl (against a local dev server or preview deploy):
  - `curl -X POST http://localhost:3000/api/compiler/complete -H 'Authorization: Bearer <TEST_SECRET>' -H 'Content-Type: application/json' -d '{"jobId":"missing","status":"COMPLETED","blobUrl":"https://example.com/x"}'` returns 404 (job not found).
  - Same call with `status: "FAILED"` and no jobId returns 400.
  - Same call with a real PENDING jobId + `status: "COMPLETED"` + `blobUrl` transitions the row to COMPLETED with `downloadUrl = blobUrl`.
  </verify>
  <done>
/complete route accepts metadata-only, no longer accepts base64, correctly transitions COMPLETED and requeues/fails on retry budget; /download uses same filename as /complete's Blob key; getCompiledFilename is the single source of truth.
  </done>
</task>

<task type="auto">
  <name>Task 2: Rotate COMPILER_SECRET + provision BLOB_READ_WRITE_TOKEN on Vercel + Windows VM</name>
  <files>
Vercel project env (COMPILER_SECRET, BLOB_READ_WRITE_TOKEN)
VM NSSM service env (COMPILER_SECRET, BLOB_READ_WRITE_TOKEN, API_URL)
  </files>
  <action>
Coordinated env rotation. Old `COMPILER_SECRET` (`vfx_sec_7x9Qk2pM4nL8vT5wH3yF6jR1dZ0cC8bA`) is compromised — it's hardcoded in daemon.js line 14 and now appears in this planning session's transcripts. Rotate BEFORE Task 3 patches daemon.js so the daemon never runs with the old value.

1. **Generate a new secret** locally: `NEW_COMPILER_SECRET=$(openssl rand -base64 48 | tr -d '=+/' | cut -c1-40)`. Prefix with `vfx_sec_` for parity with the old format: `NEW_COMPILER_SECRET="vfx_sec_$NEW_COMPILER_SECRET"`. Store the value only in this task's tool output — do not `echo` it, do not commit it.

2. **Confirm `BLOB_READ_WRITE_TOKEN` exists** in Vercel env. Per orchestrator's live-state note it is currently NOT set (listed under "Env vars STILL MISSING"). Get it from Vercel Dashboard -> Storage -> al-ai-fx blob store -> Tokens -> Read/Write (static). Copy value.

3. **Update Vercel env vars** via CLI (all three envs: Production, Preview, Development):
```bash
vercel env rm COMPILER_SECRET production --yes 2>/dev/null || true
vercel env rm COMPILER_SECRET preview --yes 2>/dev/null || true
vercel env rm COMPILER_SECRET development --yes 2>/dev/null || true
echo "$NEW_COMPILER_SECRET" | vercel env add COMPILER_SECRET production
echo "$NEW_COMPILER_SECRET" | vercel env add COMPILER_SECRET preview
echo "$NEW_COMPILER_SECRET" | vercel env add COMPILER_SECRET development

# BLOB_READ_WRITE_TOKEN: only server-side needs it. Production is what serves
# /api/compiler/download; preview is useful for testing. NOT dev.
echo "$BLOB_READ_WRITE_TOKEN_VALUE" | vercel env add BLOB_READ_WRITE_TOKEN production
echo "$BLOB_READ_WRITE_TOKEN_VALUE" | vercel env add BLOB_READ_WRITE_TOKEN preview
```

4. **Trigger a Vercel deploy** so the new secret propagates: `vercel --prod` (or `git push` if auto-deploy is wired — check orchestrator context; deploy `dpl_5hPmR7d8jm84ShsX9SQ17ouF7nh1` was healthy at plan time). Wait for the deploy to reach Ready state.

5. **Push new env vars to the Windows VM via SSH** (`ssh alfx` alias exists per VM-INSPECTION.md):

```bash
ssh alfx 'nssm.exe stop al-ai-fx-daemon'
ssh alfx "nssm.exe set al-ai-fx-daemon AppEnvironmentExtra \
  \"COMPILER_SECRET=$NEW_COMPILER_SECRET\" \
  \"BLOB_READ_WRITE_TOKEN=$BLOB_READ_WRITE_TOKEN_VALUE\" \
  \"API_URL=https://www.al-ai-fx.xyz/api/compiler\""
# Do NOT start yet — Task 3 patches daemon.js first, then starts the service.
```

Note: `nssm set AppEnvironmentExtra` fully REPLACES the previous env-extras list. If any other env-extras are already configured on the service, list them all in one command (query first via `nssm get al-ai-fx-daemon AppEnvironmentExtra`, merge, then set). VM-INSPECTION reports no other env-extras yet, so this is safe as written.

6. **Verify Vercel picked up the new secret**: from your dev shell,
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.al-ai-fx.xyz/api/compiler/poll \
  -H "Authorization: Bearer vfx_sec_7x9Qk2pM4nL8vT5wH3yF6jR1dZ0cC8bA"
# expect 401 (old secret rejected)
curl -s -o /dev/null -w "%{http_code}\n" https://www.al-ai-fx.xyz/api/compiler/poll \
  -H "Authorization: Bearer $NEW_COMPILER_SECRET"
# expect 200 (new secret accepted) — response body will be {"job":null} if queue empty
```

Do NOT log `$NEW_COMPILER_SECRET` or `$BLOB_READ_WRITE_TOKEN_VALUE` at any point. If either value ends up in stdout captured by tooling, rotate again immediately.
  </action>
  <verify>
`curl -s -H "Authorization: Bearer <OLD>" https://www.al-ai-fx.xyz/api/compiler/poll` returns 401.
`curl -s -H "Authorization: Bearer <NEW>" https://www.al-ai-fx.xyz/api/compiler/poll` returns 200.
`ssh alfx 'nssm.exe get al-ai-fx-daemon AppEnvironmentExtra'` output contains `COMPILER_SECRET=vfx_sec_...` (new value) and `BLOB_READ_WRITE_TOKEN=...`.
`ssh alfx 'nssm.exe status al-ai-fx-daemon'` returns SERVICE_STOPPED (Task 3 will restart it).
  </verify>
  <done>Old COMPILER_SECRET rejected by production; new secret accepted; Windows VM NSSM service has new secret + blob token in AppEnvironmentExtra; service is stopped and ready for Task 3's daemon patch.</done>
</task>

<task type="auto">
  <name>Task 3: Rewrite daemon.js — direct-to-Blob upload, fail-fast on env, triple-check MetaEditor, cleanup</name>
  <files>
VM:C:\Users\Administrator\Documents\autocompiler-daemon\daemon.js
VM:C:\Users\Administrator\Documents\autocompiler-daemon\package.json
VM:C:\Users\Administrator\Documents\autocompiler-daemon\node_modules (via npm install)
  </files>
  <action>
Full daemon rewrite. Do NOT patch line-by-line — replace the file wholesale. Reference: current daemon at `/tmp/al-ai-fx-vm-dump/daemon.js` (Node.js CommonJS, uses axios). VM has Node 24.15.0 which supports global `fetch`, but keeping axios for parity with current package.json keeps this diff smaller.

1. **Install `@vercel/blob`** on the VM (add to package.json + node_modules):
```bash
ssh alfx 'cd C:\Users\Administrator\Documents\autocompiler-daemon && npm install @vercel/blob@^2.3.3'
```

2. **Write the new daemon.js** to the VM. Approach: write the file locally to `/tmp/daemon.js.new`, then `scp` to VM, then verify.

The new daemon.js (write this content — no hardcoded secret, direct-to-Blob upload, triple-check success detection, cleanup):

```javascript
const axios = require('axios');
const fs = require('fs');
const fsp = require('fs').promises;
const crypto = require('crypto');
const { execSync } = require('child_process');
const path = require('path');
const https = require('https');
const { put } = require('@vercel/blob');

// ---------- Env: fail fast on missing critical values ----------
const API_URL = process.env.API_URL;
const API_SECRET = process.env.COMPILER_SECRET;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 10000);

const missing = [];
if (!API_URL) missing.push('API_URL');
if (!API_SECRET) missing.push('COMPILER_SECRET');
if (!BLOB_TOKEN) missing.push('BLOB_READ_WRITE_TOKEN');
if (missing.length) {
  console.error(`[FATAL] Missing required env vars: ${missing.join(', ')}. Exiting.`);
  process.exit(1);
}

const httpsAgent = new https.Agent({ keepAlive: true });
const MQ5_TEMPLATE = path.join(__dirname, 'base_ea_source.mq5');
const METAEDITOR_EXE = '"C:\\Program Files\\MetaTrader 5\\metaeditor64.exe"';

console.log(`[Config] Polling API: ${API_URL}  (interval ${POLL_INTERVAL_MS}ms)`);

// ---------- Polling loop ----------
async function checkJobs() {
  try {
    const res = await axios.get(`${API_URL}/poll`, {
      headers: { 'Authorization': `Bearer ${API_SECRET}` },
      httpsAgent,
      validateStatus: () => true,
    });
    if (res.status === 401) {
      console.error('[Error] Unauthorized on /poll. COMPILER_SECRET mismatch between VM and Vercel.');
      return;
    }
    if (res.status !== 200) {
      console.error(`[Error] /poll returned ${res.status}: ${JSON.stringify(res.data)}`);
      return;
    }
    if (res.data.job) {
      console.log(`[Job ${res.data.job.id}] Received. MT5=${res.data.job.mt5AccountNumber} attempt=${res.data.job.attemptCount ?? 0}`);
      await processJob(res.data.job);
    } else {
      process.stdout.write('.');
    }
  } catch (err) {
    console.error('\n[Error] Polling failed:', err.message);
  }
}

// ---------- Injection: MT5 account + expiry into MQL5 source ----------
function injectSource(sourceCode, { mt5AccountNumber, expiresAt }) {
  if (mt5AccountNumber || expiresAt) {
    sourceCode = sourceCode.replace(/bool\s+ExpiredON\s*=\s*(false|true)\s*;/g, 'bool ExpiredON=true;');
    sourceCode = sourceCode.replace(/bool\s+AccountProtectON\s*=\s*(false|true)\s*;/g, 'bool AccountProtectON=true;');
  }
  if (expiresAt) {
    const d = new Date(expiresAt);
    const mql5Date = `D'${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()} 23:59:59'`;
    sourceCode = sourceCode.replace(/datetime\s+ExpiredTime\s*=\s*D\s*'[^']+'\s*;/g, `datetime ExpiredTime=${mql5Date};`);
  }
  if (mt5AccountNumber) {
    sourceCode = sourceCode.replace(
      /const\s+long\s+allowed_accounts\s*\[\]\s*=\s*\{[\s\S]*?\};/m,
      `const long allowed_accounts[]=\n  {\n   ${mt5AccountNumber}\n  };`,
    );
  }
  return sourceCode;
}

// ---------- MetaEditor: triple-check success ----------
async function compileMQL5(id, mq5Path, logPath) {
  let exitCode = 0;
  try {
    execSync(`${METAEDITOR_EXE} /compile:"${mq5Path}" /log:"${logPath}"`, { timeout: 60000 });
  } catch (e) {
    // MetaEditor may exit non-zero on warnings; and may exit 0 on silent
    // failures (community reports). We do NOT trust exit code alone — but we
    // do record it. status.code is null if killed (timeout).
    exitCode = e.status ?? null;
  }

  // Read log as UTF-16 LE (MetaEditor writes UTF-16). Strip BOM. Search for error markers.
  let logText = '';
  try {
    const buf = await fsp.readFile(logPath);
    logText = buf.toString('utf16le').replace(/^﻿/, '');
  } catch { /* no log file — treat as failure below */ }
  const hasErrorMarker = /\b(error|Error)\b/.test(logText);

  // Verify .ex5 exists and is non-empty on disk.
  const ex5Path = mq5Path.replace(/\.mq5$/i, '.ex5');
  let ex5Size = 0;
  try {
    const st = await fsp.stat(ex5Path);
    if (st.isFile()) ex5Size = st.size;
  } catch { /* no ex5 */ }

  const ok = (exitCode === 0) && (ex5Size > 0) && !hasErrorMarker;
  console.log(`[Job ${id}] compile result: exit=${exitCode} ex5Size=${ex5Size} hasErr=${hasErrorMarker} ok=${ok}`);
  return { ok, ex5Path, ex5Size, logText };
}

// ---------- Direct-to-Blob upload ----------
async function uploadToBlob(id, ex5Path) {
  const buf = await fsp.readFile(ex5Path);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const fileName = `AL-ai-FX_GoldBot_${id}.ex5`;   // MUST match src/lib/compiler-filename.ts
  const pathname = `compiled/${fileName}`;
  const blob = await put(pathname, buf, {
    access: 'public',   // NOTE: private access is planned for Phase 4 source hardening; Phase 1 keeps parity with what the /download route currently proxies. Adjust to 'private' if the download route expects it.
    contentType: 'application/octet-stream',
    token: BLOB_TOKEN,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { blobUrl: blob.url, sha256, sizeBytes: buf.length };
}

// ---------- Complete: metadata-only POST ----------
async function reportComplete(id, payload) {
  await axios.post(`${API_URL}/complete`, { jobId: id, ...payload }, {
    headers: { 'Authorization': `Bearer ${API_SECRET}` },
    httpsAgent,
  });
}

// ---------- Cleanup: only after successful upload ----------
async function cleanup(id) {
  const files = [
    path.join(__dirname, `compiled_${id}.mq5`),
    path.join(__dirname, `compiled_${id}.ex5`),
    path.join(__dirname, `compile_${id}.log`),
  ];
  for (const f of files) {
    try { await fsp.unlink(f); } catch { /* absent — fine */ }
  }
}

// ---------- Main job driver ----------
async function processJob(job) {
  const { id, mt5AccountNumber, expiresAt } = job;
  let uploadedOk = false;
  try {
    if (!fs.existsSync(MQ5_TEMPLATE)) {
      throw new Error('base_ea_source.mq5 template missing on VM');
    }
    let source = await fsp.readFile(MQ5_TEMPLATE, 'utf8');
    source = injectSource(source, { mt5AccountNumber, expiresAt });

    const mq5Path = path.join(__dirname, `compiled_${id}.mq5`);
    const logPath = path.join(__dirname, `compile_${id}.log`);
    await fsp.writeFile(mq5Path, source);

    const result = await compileMQL5(id, mq5Path, logPath);
    if (!result.ok) {
      const truncatedLog = result.logText.slice(0, 500);
      throw new Error(`MetaEditor failed. Log excerpt: ${truncatedLog}`);
    }

    const { blobUrl, sha256, sizeBytes } = await uploadToBlob(id, result.ex5Path);
    console.log(`[Job ${id}] Uploaded to Blob (${sizeBytes} bytes, sha256=${sha256.slice(0, 12)}...)`);

    await reportComplete(id, { status: 'COMPLETED', blobUrl, sha256, sizeBytes });
    uploadedOk = true;
  } catch (err) {
    console.error(`[Job ${job.id}] Failed:`, err.message);
    try {
      await reportComplete(job.id, { status: 'FAILED', errorMessage: err.message?.slice(0, 500) ?? String(err) });
    } catch (e) {
      console.error(`[Job ${job.id}] Also failed to POST FAILED status:`, e.message);
    }
  } finally {
    // Cleanup only after a fully-successful upload — otherwise keep artifacts
    // for post-mortem inspection.
    if (uploadedOk) await cleanup(job.id);
  }
}

setInterval(checkJobs, POLL_INTERVAL_MS);
console.log('AL AI FX Autocompiler Daemon Started.');
```

3. **Push and verify** on the VM:
```bash
scp /tmp/daemon.js.new alfx:/c/Users/Administrator/Documents/autocompiler-daemon/daemon.js
ssh alfx 'cd C:\Users\Administrator\Documents\autocompiler-daemon && node -c daemon.js && echo OK'
```

4. **Start the NSSM service**:
```bash
ssh alfx 'nssm.exe start al-ai-fx-daemon'
sleep 3
ssh alfx 'nssm.exe status al-ai-fx-daemon'
ssh alfx 'tail -n 40 C:\ProgramData\al-ai-fx\logs\al-ai-fx-daemon.out.log'
```

The daemon should log `[Config] Polling API: https://www.al-ai-fx.xyz/api/compiler  (interval 10000ms)` and `AL AI FX Autocompiler Daemon Started.` and start emitting `.` heartbeats.

5. **Prove failure mode** — temporarily remove `COMPILER_SECRET` from the service env, restart it, watch stderr log show `[FATAL] Missing required env vars: COMPILER_SECRET. Exiting.`, then restore the env var and start again. This proves the fail-fast path (F1 fixed). Keep this test brief — restore within one minute.

6. **End-to-end smoke test**: from a dev shell, insert a test compile row directly into the DB (or trigger via `/api/licenses/update-mt5` if you have a test user with an active subscription), and watch the daemon logs pick it up, compile, upload, POST to /complete. Verify the row transitions to `COMPLETED` and `downloadUrl` is a `blob.vercel-storage.com` URL.

If the daemon reports upload success but the Compilation row does not transition, check /complete route Vercel logs — likely a Prisma type mismatch from Plan 01 not applying.
  </action>
  <verify>
`ssh alfx 'nssm.exe status al-ai-fx-daemon'` returns SERVICE_RUNNING.
`ssh alfx 'tail -n 100 C:\ProgramData\al-ai-fx\logs\al-ai-fx-daemon.out.log'` shows heartbeat dots + no [FATAL].
`ssh alfx 'grep -c "vfx_sec_7x9Qk2pM4nL8vT5wH3yF6jR1dZ0cC8bA" C:\Users\Administrator\Documents\autocompiler-daemon\daemon.js'` returns 0 (fallback removed).
`ssh alfx 'grep -c "@vercel/blob" C:\Users\Administrator\Documents\autocompiler-daemon\daemon.js'` returns 1.
`ssh alfx 'grep -c "process.exit(1)" C:\Users\Administrator\Documents\autocompiler-daemon\daemon.js'` returns 1.
End-to-end: seeded test Compilation row transitions PENDING -> PROCESSING -> COMPLETED with downloadUrl = https://<store>.public.blob.vercel-storage.com/compiled/AL-ai-FX_GoldBot_<jobId>.ex5, sha256 populated, sizeBytes populated.
`curl -L "https://www.al-ai-fx.xyz/api/compiler/download?jobId=<id>"` (authenticated) returns the .ex5 bytes and Content-Disposition: attachment; filename="AL-ai-FX_GoldBot_<id>.ex5".
  </verify>
  <done>
Daemon is running as a Windows service, uses env-only secrets, uploads directly to Blob, POSTs metadata to /complete, triple-checks MetaEditor success, cleans up files after successful upload, and a real end-to-end job path (PENDING -> COMPLETED -> downloadable .ex5) works.
  </done>
</task>

</tasks>

<verification>
- No file in the Next.js repo contains `fileDataBase64`.
- No file in the Next.js repo contains the old COMPILER_SECRET string.
- Daemon.js on the VM has no hardcoded secret fallback and imports @vercel/blob.
- Compilation.downloadUrl on a fresh COMPLETED row is a blob.vercel-storage.com URL.
- `/api/compiler/download?jobId=<id>` streams the exact bytes uploaded by the daemon, and the Content-Disposition filename matches the Blob pathname.
- MetaEditor triple-check: an intentionally broken MQ5 source produces status = FAILED (not COMPLETED) even if metaeditor64.exe exits 0.
</verification>

<success_criteria>
1. CMPL-06 closed: `.ex5` payloads bypass the /complete route entirely — no 4.5 MB body limit exposure.
2. CMPL-04 partially closed: /complete route implements bounded retry via attemptCount vs MAX_ATTEMPTS (reaper in Plan 03 handles the stuck-job side).
3. F1 closed: daemon exits fatally on missing COMPILER_SECRET; no hardcoded fallback anywhere in the codebase.
4. F2 closed: /complete write path and /download read path share getCompiledFilename.
5. F5 closed: MetaEditor success is (exit == 0) AND (.ex5 size > 0) AND (no error marker in UTF-16 log).
6. F6 closed: cleanup runs after successful upload only; orphaned files removed.
7. Successful end-to-end run: seeded PENDING row goes through daemon and comes out as COMPLETED with a real downloadable .ex5 in the user's dashboard.
</success_criteria>

<output>
After completion, create `.planning/phases/01-restore-compile-delivery/01-02-SUMMARY.md`.
</output>
