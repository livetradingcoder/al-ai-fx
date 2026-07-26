# AL-ai-FX autocompiler daemon

`daemon-v2.js` is the CURRENT daemon, deployed to the Windows compile VPS.
(The pre-Phase-4 `daemon.js` relic was left behind in the visionfx-ea repo.)

## Live deployment (2026-07-25)

Windows VPS **46.105.41.30** (Windows Server 2019, RDP :7777, SSH :22),
NSSM service `al-ai-fx-daemon`, working dir `C:\autocompiler`.

Install/refresh:
```
scp compile-worker/daemon-v2.js root@46.105.41.30:C:/autocompiler/daemon.js
ssh root@46.105.41.30 "C:\autocompiler\nssm.exe restart al-ai-fx-daemon"
```

Service config that matters:
- `ObjectName = .\root` + password — **NOT LocalSystem**. MetaEditor is a GUI
  binary; under LocalSystem (session 0) it silently no-ops and every job fails
  with `ex5Size=0`. This cost an evening; do not "clean it up" back.
- `AppEnvironmentExtra`: `COMPILER_SECRET` (must match Coolify app env),
  `METAEDITOR_PATH=C:\Program Files\MetaTrader 5\MetaEditor64.exe`
- Logs: `C:\autocompiler\daemon.log` / `daemon.err.log`

## Behaviour notes

- MetaEditor exits **1 on successful compiles with warnings** — exit code is
  untrusted. Success = `.ex5` produced AND log's `Result: 0 errors`.
- MetaEditor detaches: the daemon polls the log for the terminal Result line
  (up to 120s) before checking the artifact.
- The daemon holds NO robot source. Each job fetches one decrypted source over
  a short-TTL signed URL and deletes its temp files afterwards.
- `sourceUrl` comes from the platform's `NEXTAUTH_URL` (public origin). If it
  ever points at localhost again, that env is wrong on the server.
