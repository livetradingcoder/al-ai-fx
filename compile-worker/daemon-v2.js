/**
 * AL AI FX Autocompiler Daemon v2 — self-hosted (Coolify/MinIO) edition.
 *
 * Changes vs the Phase-4 daemon on the VM:
 *  - /complete: POSTs the compiled binary INLINE as fileDataBase64.
 *    The server stores it in MinIO — the daemon no longer holds any
 *    storage credentials (BLOB_READ_WRITE_TOKEN is gone entirely).
 *  - API_URL points at the Coolify deployment, override via env.
 *  - Poll interval env-tunable (POLL_INTERVAL_MS, default 10000).
 *
 * Kept from Phase-4:
 *  - Per-job source fetch from job.sourceUrl (Bearer COMPILER_SECRET);
 *    never reads a local base_ea_source.mq5 in the primary path.
 *  - Account-lock + expiry regex injection.
 *  - MetaEditor success check: .ex5 exists && no error marker in the
 *    UTF-16LE log (exit code deliberately untrusted — warning-only
 *    compiles exit 1).
 *
 * Deploy: copy to C:\Users\Administrator\Documents\autocompiler-daemon\daemon.js
 * (back up the old one first), set env, restart the NSSM service:
 *   nssm stop al-ai-fx-daemon & nssm start al-ai-fx-daemon
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_URL = process.env.API_URL || 'https://www.al-ai-fx.xyz/api/compiler';
const API_SECRET = process.env.COMPILER_SECRET;
const METAEDITOR = process.env.METAEDITOR_PATH || 'C:\\Program Files\\MetaTrader 5\\metaeditor64.exe';
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 10000);

if (!API_SECRET) {
  console.error('COMPILER_SECRET env var is required — refusing to start.');
  process.exit(1);
}

const AUTH = { headers: { Authorization: `Bearer ${API_SECRET}` } };
let busy = false;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

async function fetchJobSource(job) {
  // Short-TTL HMAC-signed URL from /poll; needs the bearer secret too.
  // NEVER log the response body (SRCE-03).
  const res = await axios.get(job.sourceUrl, { ...AUTH, responseType: 'text', timeout: 30000 });
  if (typeof res.data !== 'string' || res.data.length === 0) {
    throw new Error('empty source payload');
  }
  return res.data;
}

function injectSource(source, job) {
  let out = source;
  if (job.mt5AccountNumber || job.expiresAt) {
    out = out.replace(/bool\s+ExpiredON\s*=\s*\w+\s*;/, 'bool ExpiredON = true;');
    out = out.replace(/bool\s+AccountProtectON\s*=\s*\w+\s*;/, 'bool AccountProtectON = true;');
  }
  if (job.expiresAt) {
    const d = new Date(job.expiresAt);
    const lit = `D'${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()} 23:59:59'`;
    out = out.replace(/datetime\s+ExpiredTime\s*=\s*D'[^']*'\s*;/, `datetime ExpiredTime = ${lit};`);
  }
  if (job.mt5AccountNumber) {
    out = out.replace(
      /const\s+long\s+allowed_accounts\[\]\s*=\s*\{[^}]*\}\s*;/,
      `const long allowed_accounts[] = {${job.mt5AccountNumber}};`,
    );
  }
  return out;
}

function compile(jobId, source) {
  const src = path.join(__dirname, `compiled_${jobId}.mq5`);
  const ex5 = path.join(__dirname, `compiled_${jobId}.ex5`);
  const logFile = path.join(__dirname, `compiled_${jobId}.log`);
  fs.writeFileSync(src, source, 'utf8');

  let exitCode = 0;
  try {
    execSync(`"${METAEDITOR}" /compile:"${src}" /log:"${logFile}"`, { timeout: 120000 });
  } catch (e) {
    exitCode = e.status ?? -1; // MetaEditor exits 1 on warning-only compiles — untrusted.
  }

  // MetaEditor64.exe is a GUI binary: it DETACHES and compiles asynchronously,
  // so execSync returns in ~200ms while the .ex5 does not exist yet. Wait for
  // the log's terminal "Result: N errors" line (or the timeout) before judging.
  const deadline = Date.now() + 120000;
  let logText = '';
  while (Date.now() < deadline) {
    try {
      logText = fs.readFileSync(logFile, 'utf16le');
    } catch { /* not written yet */ }
    if (/Result:\s*\d+\s+errors?/i.test(logText)) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  try { fs.unlinkSync(logFile); } catch { /* already gone */ }

  const result = logText.match(/Result:\s*(\d+)\s+errors?/i);
  const hasErr = result ? Number(result[1]) > 0 : true; // no Result line = treat as failure
  const ex5Size = fs.existsSync(ex5) ? fs.statSync(ex5).size : 0;
  const ok = ex5Size > 0 && !hasErr;
  log(`[Job ${jobId}] compile result: exit=${exitCode} ex5Size=${ex5Size} hasErr=${hasErr} ok=${ok}`);

  const bytes = ok ? fs.readFileSync(ex5) : null;
  // Cleanup temp files either way.
  for (const f of [src, ex5]) {
    try { fs.unlinkSync(f); } catch { /* already gone */ }
  }
  if (!ok) throw new Error(`compile failed (exit=${exitCode}, ex5Size=${ex5Size}, hasErr=${hasErr})`);
  return bytes;
}

async function processJob(job) {
  log(`[Job ${job.id}] robot=${job.robotSlug} v${job.sourceVersion} account=${job.mt5AccountNumber}`);
  try {
    const source = await fetchJobSource(job);
    const injected = injectSource(source, job);
    const binary = compile(job.id, injected);
    await axios.post(`${API_URL}/complete`, {
      jobId: job.id,
      status: 'COMPLETED',
      fileDataBase64: binary.toString('base64'),
    }, { ...AUTH, timeout: 60000, maxBodyLength: 20 * 1024 * 1024 });
    log(`[Job ${job.id}] COMPLETED (${binary.length} bytes uploaded inline)`);
  } catch (err) {
    const msg = err?.message || String(err);
    log(`[Job ${job.id}] FAILED: ${msg}`);
    try {
      await axios.post(`${API_URL}/complete`, {
        jobId: job.id,
        status: 'FAILED',
        errorMessage: msg.slice(0, 500),
      }, { ...AUTH, timeout: 30000 });
    } catch (postErr) {
      log(`[Job ${job.id}] could not report failure: ${postErr?.message}`);
    }
  }
}

async function checkJobs() {
  if (busy) return;
  busy = true;
  try {
    const res = await axios.get(`${API_URL}/poll`, { ...AUTH, timeout: 15000 });
    const job = res.data?.job;
    if (job) {
      await processJob(job);
    } else {
      process.stdout.write('.');
    }
  } catch (err) {
    log(`poll error: ${err?.message}`);
  } finally {
    busy = false;
  }
}

log(`AL AI FX Autocompiler Daemon v2 started (api=${API_URL}, poll=${POLL_INTERVAL_MS}ms)`);
setInterval(checkJobs, POLL_INTERVAL_MS);
checkJobs();
