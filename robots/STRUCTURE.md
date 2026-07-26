# Robot source structure & compilation strategy

Canonical home for every robot that ships through the platform. Lives in the
al-ai-fx repo alongside the code that serves it (moved here 2026-07-26 — the
visionfx-ea repo stays as the strategy R&D scratchpad; nothing releases from
there).

## Where source lives (and where it doesn't)

| Location | What | Why |
|---|---|---|
| `robots/<slug>/` (al-ai-fx repo, private) | editable masters + frozen release copies | dev + audit trail |
| MinIO on the Hetzner box, `sources/<slug>/v<N>.mq5.enc` | AES-256-GCM encrypted, immutable versions | what production compiles from |
| **Windows VM** | **NOTHING persistent** | stateless worker: per job it gets ONE decrypted source over a short-lived signed URL, injects the buyer's account lock, compiles, posts the .ex5 back, deletes. VM compromise ≠ library leak. Never store the library there. |

## Layout

```
robots/
  _shared/protection-block.mq5   the compile contract every robot must contain
  <slug>/
    MASTER.mq5                   the ONE editable source (hidden-values form)
    params.md                    strategy values doc (source of truth for tuning)
    variants/                    non-release forms (predefined-values, other brokers)
    releases/v<N>/               frozen copy + sha256 of every uploaded version
scripts/
  check-robot-source.js          contract validator (run before every release)
  release-robot.sh               freeze → validate → encrypt-upload → prints DB bump
compile-worker/
  daemon-v2.js                   the Windows VPS daemon (deploy target, see README)
```

## The compile contract

The daemon (compile-worker/daemon-v2.js) regex-injects per-buyer values
at compile time. Every MASTER.mq5 must contain, byte-style intact:

- `bool AccountProtectON = ...;` — flipped to true per job
- `const long allowed_accounts[] = {...};` — replaced with buyer's MT5 login
- `bool ExpiredON = ...;` + `datetime ExpiredTime = D'...';` — subscription expiry
- OnInit gates that enforce both (INIT_FAILED otherwise)
- trade-comment bases WITHOUT underscores (`_1_R`/`_2_R` suffixes are reserved)

`node scripts/check-robot-source.js robots/<slug>/MASTER.mq5` verifies all of it.
The check mirrors the daemon's regexes — if you change one, change both.

## Release lifecycle

1. Edit `MASTER.mq5` (or promote a candidate to MASTER).
2. `node scripts/check-robot-source.js robots/<slug>/MASTER.mq5`
3. `scripts/release-robot.sh <slug> <next-version>` — freezes an audit copy,
   uploads encrypted to production storage.
4. Bump `Robot.sourceVersion` in the DB (command printed by the script) —
   from that moment new compile jobs use the new version. Existing versions
   are immutable forever; never overwrite a vN.
5. Commit the frozen release dir. git history + sha256 = full audit trail of
   exactly what every customer's build came from.

## Robot status (2026-07-25)

| slug | master | contract | released |
|---|---|---|---|
| goldbot | GoldBot DoubleRange Hidden Broker1 | ✅ | v1 live (frozen copy imported) |
| goldshield | **undecided** — 2 candidates in `candidates/` (visionfx-newversion2, goldea-vision-51513-hedgi) | ✅ both | – |
| precision-range | Precision Range Trader v6 | ❌ **no protection block** | – |
| sniper-lite | Sniper Lite EA v5_5 | ❌ **no protection block** | – |

For the two ❌: paste + adapt `_shared/protection-block.mq5` (top-of-file
block + OnInit gates), pick an underscore-free print tag, re-run the checker.

## Compiler build policy (CRITICAL)

An `.ex5` runs ONLY on terminals whose build is **>= the MetaEditor build that
compiled it**. Compile with a new MetaEditor and every customer on an older
broker-pinned terminal gets:

    'AL-ai-FX_<robot>_<job>.ex5' has newer unsupported version,
    please update your client terminal        → loading failed [560]

Brokers pin terminal builds and many lag by years (The KF Market shipped 3550
with 3661 available while MetaQuotes was on 5833). Customers usually CANNOT
update past what their broker serves.

**Policy: the compile VPS must run the OLDEST MetaEditor build we support.**
Compiling old is free; compiling new silently breaks paying customers whose
only symptom is an error inside their own terminal.

- VPS `46.105.41.30` shipped with MetaEditor **5833** — too new, replace.
- Install a broker-supplied MT5 (e.g. the target broker's own installer) into
  its own directory, e.g. `C:\MT5-Compiler\`, and point the daemon at it:
  `nssm set al-ai-fx-daemon AppEnvironmentExtra "COMPILER_SECRET=..." "METAEDITOR_PATH=C:\MT5-Compiler\MetaEditor64.exe"`
- Do NOT launch `terminal64.exe` from that install — connecting to a broker
  server triggers an auto-update and silently raises the build again.
  MetaEditor compiles standalone; it does not need the terminal to run.
- Publish the resulting minimum build as a support requirement, and re-test
  after any deliberate compiler upgrade.

## Broker variants

`Broker1` files differ in broker-specific details (symbol naming / comment
base). Strategy: keep ONE master per robot; when a second broker target
becomes real, express the difference as a variant file in `variants/` and
release it as its own version — the platform's Robot.sourceVersion always
points at exactly one source, so per-broker robots would need either separate
slugs or a daemon-side symbol map (decide when it actually happens).
