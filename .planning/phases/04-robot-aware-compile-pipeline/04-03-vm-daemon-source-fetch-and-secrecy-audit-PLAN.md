---
phase: 04-robot-aware-compile-pipeline
plan: 03
type: execute
wave: 3
depends_on: [04-01, 04-02]
files_modified:
  - "VM:C:\\Users\\Administrator\\Documents\\autocompiler-daemon\\daemon.js"
autonomous: true

must_haves:
  truths:
    - "The VM daemon.js was READ from the VM FIRST (its real current shape confirmed, not assumed) before any edit"
    - "The daemon fetches per-job source from job.sourceUrl with Authorization: Bearer COMPILER_SECRET, writes it to a temp .mq5 file, compiles THAT file, and no longer reads its local base_ea_source.mq5 as the primary source"
    - "The daemon uploads the compiled .ex5 to the robot-scoped Blob pathname compiled/AL-ai-FX_<robotSlug>_<jobId>.ex5 (robotSlug from the poll response), consistent with what /download regenerates"
    - "The daemon's existing retry / triple-check MetaEditor success detection / cleanup-on-success logic is PRESERVED — only the source-acquisition and upload-pathname steps changed"
    - "The daemon never writes MQL5 source contents to its logs; the temp .mq5 is deleted after compile (on success per existing cleanup policy)"
    - "The al-ai-fx-daemon NSSM service was restarted and stays RUNNING after the deploy"
    - "A real end-to-end test job compiled successfully through the new source-fetch path, and /api/compiler/download for that job returns application/octet-stream whose body is NOT MQL5 text (no #property / OnTick) — the SRCE-03 negative test"
    - "No admin UI renders MQL5 source (confirmed still true — no source view exists under src/app/[locale]/dashboard/admin)"
  artifacts:
    - path: "VM:C:\\Users\\Administrator\\Documents\\autocompiler-daemon\\daemon.js"
      provides: "Robot-aware source-fetch compile daemon"
      contains: "sourceUrl"
  key_links:
    - from: "daemon.js"
      to: "/api/compiler/source"
      via: "fetch(job.sourceUrl, { headers: { Authorization: Bearer COMPILER_SECRET } })"
      pattern: "sourceUrl"
    - from: "daemon.js .ex5 upload"
      to: "/api/compiler/download disposition name"
      via: "compiled/AL-ai-FX_<robotSlug>_<jobId>.ex5 robot-scoped pathname"
      pattern: "robotSlug"
---

<objective>
Deploy the robot-aware compile daemon to the Windows VM. Today the daemon (`daemon.js`, NSSM service `al-ai-fx-daemon`, LocalSystem) reads a LOCAL `base_ea_source.mq5` and compiles it — hardcoded to GoldBot. This plan rewires it to fetch each job's source at job time from the new `/api/compiler/source` endpoint (via the `sourceUrl` in the poll response), compile the fetched source, and upload the `.ex5` to the robot-scoped Blob pathname — while preserving every existing reliability behavior (bounded retry, triple-check MetaEditor success detection, cleanup-on-success). Then close SRCE-03 with a source-secrecy audit + a live negative download test.

This plan runs LAST (Wave 3) because the daemon calls the REAL, deployed Next.js endpoints — Plans 04-01 (`/source` + `sourceVersion`) and 04-02 (poll `sourceUrl` + robot-scoped filename) must already be live in production.

Purpose: Satisfy SRCE-02 (daemon fetches source via authed URL at job time, not local disk), CTLG-07 (robot-scoped compiled binary written), and SRCE-03 (source never on VM disk permanently, never logged, never in admin UI, download serves only compiled binary).

Output:
- Updated `daemon.js` on the VM (fetch-source + robot-scoped upload; existing logic preserved)
- `al-ai-fx-daemon` NSSM service restarted and stable
- A live end-to-end test job proving the new path works + a passing SRCE-03 negative download test
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-robot-aware-compile-pipeline/4-RESEARCH.md
@.planning/phases/04-robot-aware-compile-pipeline/04-01-SUMMARY.md
@.planning/phases/04-robot-aware-compile-pipeline/04-02-SUMMARY.md
@src/lib/compiler-filename.ts
@src/app/api/compiler/download/route.ts
</context>

<critical_environment_notes>
- **VM access:** SSH alias `alfx` (key-based, `65.21.66.43`). Password fallback:
  `sshpass -p 'ZS177LG85Ks3' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/tmp/known_hosts_alaifx root@65.21.66.43 <cmd>`
  (`sshpass` at `/usr/local/bin/sshpass`).
- **Remote shell is PowerShell** — chain with `;` NOT `&&`.
- **Daemon:** `C:\Users\Administrator\Documents\autocompiler-daemon\daemon.js`, NSSM service `al-ai-fx-daemon` (LocalSystem). Restart via `nssm restart al-ai-fx-daemon` (or `nssm stop` then `nssm start`).
- **daemon.js is NOT in the repo** and was NOT read this session — research flagged it LOW-MEDIUM confidence. You MUST read the current file from the VM FIRST and build the edit against its real shape. Do not assume field names, the poll-parse code, the MetaEditor invocation, or the upload call from phase descriptions alone.
- **The local backup `base_ea_source.mq5` stays in place** as a fallback/reference — just stop using it as the primary source. Do not delete it.
- Node/local commands (for the negative download test tooling) still need `export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"`.
</critical_environment_notes>

<tasks>

<task type="auto">
  <name>Task 1: Read current daemon.js from the VM and confirm its real structure</name>
  <files>(read-only — VM daemon.js)</files>
  <action>
Before editing anything, pull the ACTUAL current daemon and its neighbors from the VM and understand its real control flow:
```bash
ssh alfx "Get-Content 'C:\Users\Administrator\Documents\autocompiler-daemon\daemon.js' -Raw"
ssh alfx "Get-ChildItem 'C:\Users\Administrator\Documents\autocompiler-daemon\' | Select-Object Name,Length"
ssh alfx "nssm status al-ai-fx-daemon"
```
(If the key-based `ssh alfx` fails, use the `sshpass` fallback from the environment notes.)

Identify and note, from the REAL file:
  1. How it polls (`fetch(API_URL/api/compiler/poll)`, headers) and how it parses the job object — the exact variable it stores the job in and how it reads `job.id`, `job.mt5AccountNumber`, `job.expiresAt`.
  2. Where it currently obtains the source (the `base_ea_source.mq5` read) and what temp/working paths it uses.
  3. How it injects the MT5 account number into the source (the account-lock step) — this must be preserved and now applied to the FETCHED source.
  4. The MetaEditor compile invocation + the triple-check success detection (exit==0 AND .ex5 size>0 AND no error marker in UTF-16 log).
  5. The `.ex5` upload call (`put`/Blob API, the pathname it uses) and where it reports back to `/api/compiler/complete`.
  6. The retry and cleanup-on-success logic.
  7. The env vars it reads (`API_URL`, `COMPILER_SECRET`, `BLOB_READ_WRITE_TOKEN`).

Write these findings into the plan's working notes — Task 2's edit is built against THESE real names, not assumptions.
  </action>
  <verify>The full current daemon.js content has been retrieved and its poll-parse, source-read, account-lock, compile, success-check, upload, and cleanup sections are identified by real line/variable names. `nssm status` returns `SERVICE_RUNNING`.</verify>
  <done>Real daemon structure confirmed; the exact code locations for the source-acquisition swap and upload-pathname change are known.</done>
</task>

<task type="auto">
  <name>Task 2: Rewrite the source-acquisition + upload-pathname steps; deploy and restart the service</name>
  <files>VM: C:\Users\Administrator\Documents\autocompiler-daemon\daemon.js</files>
  <action>
Produce an updated `daemon.js` that changes ONLY the source-acquisition and upload-pathname steps; preserve all polling, account-lock, MetaEditor invocation, triple-check success detection, retry, and cleanup logic verbatim from Task 1's findings.

**2a. Source acquisition (replace the local `base_ea_source.mq5` read).** After a job is claimed from `/poll`, fetch the source from the URL the poll now returns:
```js
// job.sourceUrl comes from /api/compiler/poll (Plan 04-02); it is a ready-to-fetch
// URL at THIS deployment's /api/compiler/source with an embedded short-TTL HMAC token.
// The endpoint still requires the bearer secret too.
const srcRes = await fetch(job.sourceUrl, {
  headers: { Authorization: `Bearer ${COMPILER_SECRET}` },
});
if (!srcRes.ok) {
  throw new Error(`source fetch failed: ${srcRes.status}`);
}
const mq5 = Buffer.from(await srcRes.arrayBuffer());
// Write to a per-job temp .mq5 (use the same working dir the old code used).
fs.writeFileSync(tmpSourcePath, mq5);
// NEVER console.log(mq5) or its string — source stays out of logs.
```
Then apply the SAME account-lock transformation the old code applied (from Task 1 finding #3) to `tmpSourcePath` instead of the local base source, and compile `tmpSourcePath`. If the daemon previously copied `base_ea_source.mq5` to a working file and edited it, keep that mechanism but seed the working file from the fetched bytes. Keep `base_ea_source.mq5` on disk as a fallback/reference — just don't read it in the primary path.

**2b. Robot-scoped upload pathname.** The daemon must upload the `.ex5` to `compiled/AL-ai-FX_<robotSlug>_<jobId>.ex5` where `robotSlug` is `job.robotSlug` from the poll response (matches `getCompiledBlobPathname` / what `/download` regenerates in Plan 04-02). Replace any hardcoded `goldbot`/`GoldBot` in the upload pathname with `job.robotSlug`:
```js
const robotSlug = job.robotSlug; // from /poll (Phase 3+4)
const blobPathname = `compiled/AL-ai-FX_${robotSlug}_${job.id}.ex5`;
// ... existing put()/upload call, using blobPathname; addRandomSuffix:false, allowOverwrite:true as before
```
Keep the exact `put` options and the subsequent `/complete` report call from Task 1's findings.

**2c. Secrecy guardrails in the daemon (SRCE-03):** ensure NO `console.log`/`console.error` prints the fetched source buffer, its string form, or the account-locked source. The temp `.mq5` is deleted by the existing cleanup-on-success step (leave failed-artifact retention as-is for post-mortem). If the old code logged the source anywhere, remove that log line.

**2d. Deploy + restart.** Write the updated file to the VM (e.g. stage locally then `scp`/`Set-Content`, or write via a here-string over SSH — whichever matches how the file was retrieved). Then restart and confirm the service stays up:
```bash
ssh alfx "nssm restart al-ai-fx-daemon; Start-Sleep -Seconds 3; nssm status al-ai-fx-daemon"
# tail the service log if one exists to confirm a clean start (path found in Task 1)
```
`nssm status` must return `SERVICE_RUNNING` after the restart (not `SERVICE_PAUSED`/stopped).
  </action>
  <verify>
- `ssh alfx "Select-String -Path 'C:\Users\Administrator\Documents\autocompiler-daemon\daemon.js' -Pattern 'sourceUrl'"` finds the fetch.
- `ssh alfx "Select-String ... -Pattern 'job.robotSlug'"` finds the robot-scoped pathname.
- `ssh alfx "Select-String ... -Pattern 'base_ea_source'"` shows it is no longer the PRIMARY read (present only as fallback/comment, if at all).
- `ssh alfx "nssm status al-ai-fx-daemon"` → `SERVICE_RUNNING`.
- Service log shows a clean start with no unhandled exception.
  </verify>
  <done>Daemon fetches+compiles per-job source, uploads to robot-scoped pathname, preserves all reliability logic, logs no source; service running.</done>
</task>

<task type="auto">
  <name>Task 3: Live end-to-end smoke test + SRCE-03 source-secrecy audit</name>
  <files>(verification only)</files>
  <action>
Prove the whole path works and source stays secret.

**3a. Generate a real test job.** The simplest verifiable path (no local DB access): trigger a real MT5-account update through the existing free-trial/checkout flow so `update-mt5` creates a PENDING `Compilation` (now carrying `sourceVersion`). Use an existing test user's active free-trial subscription and `PUT /api/compiler/download`-adjacent flow, OR mint a free trial then set the MT5 account. If a synthetic route is easier, create one PENDING Compilation via a one-off Prisma script run through the build-step channel (precedent exists) — but prefer the real UI/API flow. Capture the resulting `jobId`.

**3b. Watch it compile.** Poll the job's status (admin compiler-status endpoint or the client flow) until it reaches `COMPLETED`. Confirm on the VM (service log from Task 1) that the daemon fetched the source (a `/api/compiler/source` call happened) and produced the `.ex5`. Confirm the daemon did NOT fall back to `base_ea_source.mq5`.

**3c. SRCE-03 negative download test.** As the owning user, hit `GET /api/compiler/download?jobId=<jobId>` and assert:
  - `Content-Type: application/octet-stream`
  - `Content-Disposition` filename is `AL-ai-FX_<robotSlug>_<jobId>.ex5` (robot-scoped, matches the uploaded pathname)
  - the body is a compiled binary, NOT MQL5 text — it must NOT contain `#property`, `OnTick`, `OnInit`, or other MQL5 source markers.
  Example check (adjust auth/cookie as needed):
  ```bash
  curl -s -D - -o /tmp/dl.ex5 "<APP_URL>/api/compiler/download?jobId=<jobId>" -H "Cookie: <session>"
  grep -aqE "#property|OnTick|OnInit" /tmp/dl.ex5 && echo "LEAK" || echo "NO_SOURCE_LEAK_OK"
  ```

**3d. Audit inspection (SRCE-03 static checks):**
  - Confirm NO admin UI renders source: `grep -rn "decryptSource\|\.mq5\|sourceUrl" src/app/[locale]/dashboard/admin/` returns nothing source-rendering (a source VIEW must not exist). Confirm no source view was added.
  - Confirm the `/source` endpoint and poll route do not log plaintext/token (already asserted in 04-01/04-02, re-confirm by grep).
  - Confirm daemon logs (from the test run) contain no MQL5 source text.
  Record the audit result (all green) in the SUMMARY.
  </action>
  <verify>
- A real Compilation job reached `COMPLETED` via the new source-fetch path (daemon log shows the `/api/compiler/source` fetch, not a `base_ea_source.mq5` read).
- `GET /api/compiler/download?jobId=<jobId>` returns `application/octet-stream`, robot-scoped filename, and body has NO MQL5 markers → `NO_SOURCE_LEAK_OK`.
- `grep -rn "decryptSource\|\.mq5" src/app/[locale]/dashboard/admin/` finds no source-rendering code.
- Daemon logs from the test run contain no source text.
  </verify>
  <done>End-to-end compile via fetched source verified live; download serves only the compiled binary under the robot-scoped name; source-secrecy audit passes on all fronts.</done>
</task>

</tasks>

<verification>
- The VM daemon fetches per-job source from `job.sourceUrl` (Bearer COMPILER_SECRET), compiles it, and uploads the `.ex5` to `compiled/AL-ai-FX_<robotSlug>_<jobId>.ex5`.
- All pre-existing daemon reliability logic (retry, triple-check success, cleanup) is preserved.
- `al-ai-fx-daemon` service is `SERVICE_RUNNING` after the deploy.
- A live test job compiled end-to-end via the fetched source and downloaded as a compiled binary under the robot-scoped filename.
- SRCE-03 audit green: no source in daemon logs, no source in admin UI, download body contains no MQL5 markers, `/source` decrypts server-side with the key never on the VM.
</verification>

<success_criteria>
- SRCE-02: source is fetched at job time via the authed short-TTL URL; the VM no longer relies on its local source for the primary path; the encryption key is never on the VM.
- CTLG-07: the compiled binary is written to a robot-scoped Blob pathname consistent with `/download`.
- SRCE-03: MQL5 source is never returned to users, never logged in plaintext (server or daemon), and never rendered in any admin UI — verified by the live negative download test and the audit.
</success_criteria>

<output>
After completion, create `.planning/phases/04-robot-aware-compile-pipeline/04-03-SUMMARY.md` with frontmatter fields: `phase`, `plan`, `status: complete`, `requirements: [SRCE-02, SRCE-03, CTLG-07]`, `files_changed` (note the VM daemon.js is off-repo), `key_decisions` (fetched source vs local base; base_ea_source.mq5 kept as fallback; robot-scoped upload pathname from job.robotSlug; daemon logs scrubbed of source), and `verification_evidence` — the test `jobId`, the `COMPLETED` transition, the daemon `/source` fetch log line (redacted), and the `NO_SOURCE_LEAK_OK` download-test result. Record the final daemon.js content location on the VM (it is not committed to the repo).
</output>
