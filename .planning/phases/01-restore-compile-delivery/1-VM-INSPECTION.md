# VM Inspection — Windows Compile Server

**Date:** 2026-07-04
**Host:** `65.21.66.43` (Hetzner Windows VPS)
**SSH:** enabled during this session (was RDP-only). Key auth via `~/.ssh/al_ai_fx_ed25519` for local user `root` (maps to Administrator profile).
**Alias:** `ssh alfx`

## Environment

| Item | Value |
|------|-------|
| Windows hostname | `WIN-LIVFRVQFMKO` |
| Effective user | `Administrator` (SSH `root` → profile `C:\Users\Administrator`) |
| Node.js | v24.15.0 |
| npm | 11.12.1 |
| MetaEditor | `C:\Program Files\MetaTrader 5\metaeditor64.exe` — present |
| NSSM | **not installed** |
| OpenSSH server | installed, running, auto-start, TCP 22 open |

## Compile Worker Layout

**Location:** `C:\Users\Administrator\Documents\autocompiler-daemon\`

| File | Size | Role |
|------|-----:|------|
| `daemon.js` | 5482 B | Main polling worker |
| `package.json` | 235 B | Node deps: `axios ^1.6.0` |
| `package-lock.json` | 10 KB | Locked deps |
| `node_modules/` | dir | Deps installed |
| `base_ea_source.mq5` | 14 KB | GoldBot MQL5 source template |
| `compiled_cmo5nm7p00001l404qegomcl6.ex5` | 51 KB | Orphan from 2026-04-19 12:59 |
| `compiled_cmo5nm7p00001l404qegomcl6.mq5` | 14 KB | Orphan source |
| `compiled_cmo60fbo30001l5045dbjag44.ex5` | 51 KB | Orphan from 2026-04-19 18:58 |
| `compiled_cmo60fbo30001l5045dbjag44.mq5` | 14 KB | Orphan source |

**Last successful compile:** 2026-04-19 18:58 → nothing since (~2.5 months of downtime).

**Currently running:** no `node` process observed — daemon was manually started and has been offline since crash / reboot / logoff.

## daemon.js Analysis

Full source pulled to `/tmp/al-ai-fx-vm-dump/daemon.js`.

### Flow
1. `setInterval(checkJobs, 10000)` — polls `/api/compiler/poll` every 10s
2. If job returned: reads `base_ea_source.mq5`, regex-injects `mt5AccountNumber` + `expiresAt` + turns on `ExpiredON` / `AccountProtectON` flags
3. Writes `compiled_${id}.mq5` to daemon dir
4. Shells out to `metaeditor64.exe /compile:... /log:...` with 60s timeout
5. Reads UTF-16LE log, checks `.ex5` existence (not exit code — comment says exit 1 possible on warnings)
6. Reads `.ex5`, base64-encodes, POSTs to `/api/compiler/complete` with `{jobId, fileDataBase64, status:'COMPLETED'}`
7. On any failure, POSTs `{jobId, status:'FAILED'}` — good

### Findings — must fix

**F1. Hardcoded fallback COMPILER_SECRET** (line 14) — `vfx_sec_7x9Qk2pM4nL8vT5wH3yF6jR1dZ0cC8bA`. Anyone with read on daemon.js can poll for pending compile jobs (includes MT5 account numbers of paying customers). This value is now in this planning session's transcript as well. Rotate + drop fallback.

**F2. Filename mismatch complete ↔ download** — daemon uploads base64; `/api/compiler/complete/route.ts:56` writes Blob key `compiled/AL-ai-FX_GoldBot_${jobId}.ex5` and stores that URL. Per CONCERNS.md, `/api/compiler/download/route.ts:47` expects `GoldBot_v2.0_...`. Downloads fail even after successful compile. Consolidate into one helper (Phase 1 quick fix: unify to whatever `complete` writes, so any URL stored in `Compilation.downloadUrl` just works via redirect).

**F3. No process supervisor** — daemon runs only if manually launched. No auto-restart on crash, no auto-start on boot, no persistent stdout capture. This is the actual reason "server offline." Fix: NSSM Windows Service.

**F4. Base64 body upload** — 51 KB today, but any change to source template that ~doubles binary risks hitting Vercel's 4.5 MB body limit. Direct-to-Blob upload from worker is the research recommendation (Phase 1 wave 4 in planner scope).

**F5. `execSync` swallows exit code** — comment says "metaeditor often exits with code 1 even on success." Research says: exit 0 on silent fail is also possible. Success detection currently only checks `.ex5` existence. Needs additional log-parse for `error`/`Error` lines in UTF-16 (log parse already done, just not consulted for the pass/fail decision).

**F6. Orphan compiled files never cleaned** — cleanup block is `// Temporarily disabled for testing`. Two orphan .ex5 + .mq5 from April still present. Reactivate cleanup w/ safe fallback (only delete after successful upload).

**F7. Single robot hardcoded** — `base_ea_source.mq5` is the only template. Confirms Phase 3/4 multi-robot rework required.

**F8. No Windows Defender exclusions** — research flagged widespread AV false positives on `metaeditor64.exe` / Themida-packed `.ex5`. Add exclusions for `C:\Program Files\MetaTrader 5\` + daemon dir before promoting to service.

**F9. No log file** — everything goes to stdout. NSSM will capture via `AppStdout` / `AppStderr`.

### Findings — nice to have (Phase 5+)

- No exponential backoff on API errors — 10s hardcoded even on repeated 500s.
- No jitter — with multiple workers, all wake at same tick.
- No graceful shutdown handler — SIGINT/SIGTERM drop in-flight job.
- `httpsAgent keepAlive: true` — good.

## Immediate Recovery Path (Phase 1 execution scope)

1. Install NSSM.
2. Rotate `COMPILER_SECRET` in Vercel env + set as machine env var on VM.
3. Patch `daemon.js` — drop hardcoded fallback secret; error out if env var missing.
4. Add Defender exclusions.
5. Install daemon as NSSM service `al-ai-fx-daemon`: auto-start, restart-on-crash, log to `C:\ProgramData\al-ai-fx\logs\`.
6. Verify service survives reboot.
7. End-to-end smoke test: create test compile job in DB → verify daemon picks it up → verify Blob upload → verify download URL usable.
8. **Separately**: fix filename mismatch in Next.js repo (`complete` ↔ `download`) — deploy before smoke test would pass end-to-end.

Everything above is single-robot scope; multi-robot rework stays in Phase 3/4.
