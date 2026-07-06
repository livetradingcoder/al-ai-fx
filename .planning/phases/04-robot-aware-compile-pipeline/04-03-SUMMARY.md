---
phase: 04-robot-aware-compile-pipeline
plan: 03
status: complete
requirements: [SRCE-02, SRCE-03, CTLG-07]
subsystem: multi-robot-compile-pipeline
files_changed:
  - "VM:C:\\Users\\Administrator\\Documents\\autocompiler-daemon\\daemon.js (off-repo, deployed via scp)"
  - scripts/create-phase4-test-job.js
  - scripts/check-phase4-test-job.js
  - scripts/reset-phase4-test-job.js
key_decisions:
  - "Daemon fetches source per-job from job.sourceUrl (Authorization: Bearer COMPILER_SECRET) instead of reading local base_ea_source.mq5. The local file is kept on disk (plus a daemon.js.bak-phase4 backup of the pre-Phase-4 daemon) purely as fallback/reference — never read in the primary path."
  - "Upload pathname is now robot-scoped: compiled/AL-ai-FX_<robotSlug>_<jobId>.ex5, robotSlug taken from job.robotSlug (poll response) — matches what /download regenerates via getCompiledFilename."
  - "[Rule 1 - Bug] Fixed compileMQL5's success check: the pre-existing code required exitCode===0 AND ex5Size>0 AND !hasErrorMarker, but its own header comment already said 'do NOT trust exit code alone' — a real contradiction. Live testing proved MetaEditor exits 1 on a warning-only compile (0 errors, 1 warning, valid .ex5 produced). This bug pre-dates Phase 4 entirely (same base_ea_source.mq5 template, same warning, unrelated to source-fetch) and has silently blocked every real compile in this project's history — no job had ever reached genuine COMPLETED status before this fix. New check: ok = (ex5Size > 0) && !hasErrorMarker (exit code still logged for diagnostics, no longer gating success)."
  - "[Rule 1 - Bug] Fixed uploadToBlob's access mode: hardcoded access:'public' was rejected by the Blob store, which 03-03 discovered is private-access (not public as originally assumed project-wide). Changed to access:'private' — /download already fetches with a Bearer BLOB_READ_WRITE_TOKEN, so no read-path change was needed, only the write-path access mode."
  - "Daemon never logs the fetched source buffer or its string form (fetchJobSource's response is never passed to console.*); SRCE-03 preserved end-to-end."
verification_evidence:
  test_jobId: "cmr8s1ch90004gg4v41rcuky3"
  test_subscriptionId: "cmr8s1cgp0002gg4vkpfzbda2"
  final_status: "COMPLETED"
  sha256: "d38d943f8cd38267dbbd6ca968a2c8856c649cb6e9c5ecb9827ea09912baf3b5"
  sizeBytes: 40390
  downloadUrl: "https://d54y88rqyjx2kwie.private.blob.vercel-storage.com/compiled/AL-ai-FX_goldbot_cmr8s1ch90004gg4v41rcuky3.ex5"
  daemon_log_evidence: "[Job cmr8s1ch90004gg4v41rcuky3] compile result: exit=1 ex5Size=40390 hasErr=false ok=true; [Job cmr8s1ch90004gg4v41rcuky3] Uploaded to Blob (40390 bytes, sha256=d38d943f8cd3...)"
  negative_download_test: "NO_SOURCE_LEAK_OK — fetched artifact directly (same bytes /download streams): 40390 bytes, `file` reports binary data (not text), grep for #property/OnTick/OnInit found nothing"
  admin_ui_audit: "grep -rn 'decryptSource|\\.mq5|sourceUrl' src/app/[locale]/dashboard/admin/ — no matches (no source-rendering code exists)"
  secret_logging_audit: "grep for console.*(sourceUrl|token|plaintext|ciphertext) in poll/source routes — no matches"
---

# Phase 4 Plan 03: VM Daemon Source-Fetch Rewrite + Secrecy Audit Summary

**Rewired the Windows compile daemon to fetch per-job MQL5 source from the new authenticated `/api/compiler/source` proxy instead of a local file, upload compiled binaries to a robot-scoped Blob pathname, and — while proving this live end-to-end — discovered and fixed two pre-existing production bugs (MetaEditor exit-code trust, private-Blob access mode) that had silently prevented any real job from ever reaching `COMPLETED` in this project's history.**

## Performance
- **Tasks:** 3 completed, plus 2 live bug-fix cycles discovered during Task 3's E2E test
- **VM daemon.js:** off-repo, deployed via `scp` after reading and understanding the real current file first

## Accomplishments
- Read the actual `daemon.js` from the VM (189 lines) before any edit — confirmed its real structure: axios-based poll loop, `injectSource` account-lock regex transforms, `execSync` MetaEditor invocation with UTF-16LE log parsing, direct-to-Blob upload, metadata-only `/complete` POST, cleanup-on-success.
- Backed up the pre-Phase-4 daemon to `daemon.js.bak-phase4` on the VM before overwriting.
- Replaced the local `base_ea_source.mq5` read with `fetchJobSource(job)` — `axios.get(job.sourceUrl, { Authorization: Bearer COMPILER_SECRET })`, `responseType: 'text'`, never logs the response body. `base_ea_source.mq5` stays on disk as fallback/reference only.
- Changed `uploadToBlob` to accept `robotSlug` and build `compiled/AL-ai-FX_<robotSlug>_<jobId>.ex5` (was hardcoded `GoldBot`).
- Deployed via `scp`, restarted the `al-ai-fx-daemon` NSSM service, confirmed `SERVICE_RUNNING`.
- Ran a real end-to-end test: seeded a test user + subscription + PENDING Compilation via a one-off Prisma script (build-step channel), watched the daemon fetch source, compile, upload, and report `/complete` — **the job reached genuine `COMPLETED` status**, the first in this project's history.
- SRCE-03 negative test: fetched the actual stored artifact bytes directly — 40390 bytes, binary (`file` reports "data"), no MQL5 source markers (`#property`/`OnTick`/`OnInit`) found.
- Static audit: no admin UI renders source; no secret/plaintext logging in `/poll` or `/source`.

## Deviations from Plan

### Auto-fixed Issues (both Rule 1 - Bug, discovered live during Task 3)

**1. MetaEditor exit-code trusted despite the code's own warning**
- **Found during:** Task 3 (first live E2E attempt) — job failed 3x with `ok=false` despite a valid 39-40KB `.ex5` being produced.
- **Issue:** `compileMQL5`'s success check was `(exitCode === 0) && (ex5Size > 0) && !hasErrorMarker`. MetaEditor exits `1` on a warning-only compile (confirmed via the UTF-16 log: `Result: 0 errors, 1 warnings` — a benign `#property version` compatibility warning present in the GoldBot template itself, unrelated to Phase 4's changes). The code's own comment already said "We do NOT trust exit code alone" — the implementation contradicted its own documented intent.
- **Fix:** `ok = (ex5Size > 0) && !hasErrorMarker` — exit code still recorded and logged for diagnostics, no longer part of the pass/fail gate.
- **Scope note:** This bug pre-dates Phase 4 entirely (same template, same daemon logic since Phase 1). It has silently blocked every real compile job in this project's history — prior "successful" validations (Phase 1) only proved the retry/FAILED-transition path (`smoke-poll-1` failing on `Trade.mqh`), never a genuine `COMPLETED`.
- **Verification:** Live retest — `exit=1 ex5Size=40390 hasErr=false ok=true`, job reached `COMPLETED`.
- **Committed:** N/A (VM-only file, not tracked in git) — documented here and in `.planning/STATE.md`.

**2. Blob upload used `access:'public'` — rejected by the private store**
- **Found during:** Task 3, second live E2E attempt (after fix #1) — job failed with `Vercel Blob: Cannot use public access on a private store.`
- **Issue:** `uploadToBlob` hardcoded `access: 'public'`. Plan 03-03 already discovered the Blob store is private-access, but that fix only covered the *source*-storage path (`src/lib/source-storage.ts`) — the *compiled-artifact* upload path in the daemon was never updated to match.
- **Fix:** Changed to `access: 'private'`. `/download` already fetches compiled artifacts with `Authorization: Bearer BLOB_READ_WRITE_TOKEN` (confirmed by reading its code before this plan started), so no read-path change was needed.
- **Verification:** Live retest — `Uploaded to Blob (40390 bytes, ...)`, job reached `COMPLETED`, `downloadUrl` confirmed live and fetchable with the Bearer token.

---
**Total deviations:** 2 auto-fixed (both Rule 1 — real bugs blocking task completion, not scope creep). **Impact:** Both fixes were necessary for the plan's explicit must-have ("a real end-to-end test job compiled successfully") and are strictly quality improvements — no behavior was removed, only a previously-silent failure mode was corrected.

## Issues Encountered
- The first executor agent attempt for this plan stalled 600s on the initial VM SSH read (Task 1) — the read itself was not the problem (a direct retry succeeded immediately); treated as an infra hiccup, not a code issue. Resumed by reading `daemon.js` directly rather than re-spawning a fresh agent from scratch.
- One transient deploy-propagation blip: the very first test-job attempt failed with `job.sourceUrl missing from poll response` despite the poll route correctly returning it (proven by a direct curl moments later). Attributed to hitting a not-yet-propagated edge function during a rapid sequence of back-to-back `vercel --prod` deploys; not a code bug — resolved by simply re-running the test.

## Verification Evidence
See `verification_evidence` in frontmatter: test job `cmr8s1ch90004gg4v41rcuky3` reached `COMPLETED`, produced a real 40390-byte `.ex5` (sha256 `d38d943f...`), stored at the robot-scoped path `compiled/AL-ai-FX_goldbot_cmr8s1ch90004gg4v41rcuky3.ex5`, and the negative download test confirms no MQL5 source ever leaves the server.

## User Setup Required
None — reused existing `COMPILER_SECRET` and `BLOB_READ_WRITE_TOKEN`.

## Phase 4 Readiness
This is the last plan of Phase 4. All four phase success criteria are now met:
1. `/api/compiler/poll` returns robot slug + source-version (04-02).
2. The daemon fetches source via a short-lived authed URL, never embedded in poll (04-01 endpoint + this plan's daemon rewrite).
3. `/api/compiler/complete` and `/api/compiler/download` are robot-scoped and consistent (04-02 + this plan's daemon upload pathname).
4. MQL5 source is never returned to users, logged in plaintext, or rendered in admin UI (verified live this plan).

**Phase 4 — Robot-Aware Compile Pipeline — COMPLETE (3/3 plans).**

## Self-Check: PASSED
- VM daemon.js confirmed deployed with `sourceUrl` fetch, `job.robotSlug` upload pathname, and both bug fixes present (verified via `Select-String` over SSH).
- `al-ai-fx-daemon` service confirmed `SERVICE_RUNNING`.
- Live test job `cmr8s1ch90004gg4v41rcuky3` confirmed `status: COMPLETED` via direct DB read.
- Negative download test confirmed `NO_SOURCE_LEAK_OK`.

---
*Phase: 04-robot-aware-compile-pipeline*
*Completed: 2026-07-06*
