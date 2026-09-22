# Operations runbook — what happens on a sale, and how to launch a new robot

Companion to HANDOFF-2026-07-21.md (infrastructure). This file answers two
questions: what the system does when someone buys, and what YOU do when a new
robot is ready to sell.

---

## A. What happens when a customer buys a robot

Fully automatic. No human step anywhere in this chain.

1. **Checkout** — customer picks robot + tier on the site, pays via Paygate.to
   (crypto). Price is resolved SERVER-side (`resolveRobotPrice`, fail-closed) —
   the amount in the URL is never trusted.
2. **Callback** — Paygate calls `GET /api/webhooks/paygate` with our own HMAC
   `signature` param (their callback has no signature of its own). Verified
   fail-closed before anything is provisioned. Replays are idempotent: an
   existing `Order.paygateId` short-circuits.
3. **Provisioning** (`provisionSubscription`) — creates the User if new, creates
   `Subscription` (tier, `expiresAt` from tier duration, status ACTIVE) and the
   `Order`. Duplicate active tier for the same robot = no-op.
4. **Purchase email** — sent immediately, contains a magic dashboard link
   (30-min JWT). Mailgun `mg.al-ai-fx.xyz`.
5. **Customer locks an MT5 account** — dashboard → My Licenses → enters their
   MT5 login. One-time and permanent per license. Creates a `Compilation` row
   with status PENDING (`[pipeline] JOB CREATED`).
6. **Compile** — the Windows daemon (46.105.41.30, NSSM service
   `al-ai-fx-daemon`) polls every 10s, claims the job atomically, fetches the
   decrypted source over a short-TTL signed URL, regex-injects the account lock
   + expiry, compiles with MetaEditor, POSTs the binary back inline.
   Typical end-to-end: **~2 seconds**.
7. **Storage + delivery email** — server stores the .ex5 in MinIO at
   `compiled/AL-ai-FX_<slug>_<jobId>.ex5`, records sha256 + size, emails the
   customer that the build is ready.
8. **Download** — dashboard → Download Build. Auth-checked: a user can only
   download builds belonging to their own subscription.

Failure handling: a job retries up to 3 attempts, then sits FAILED with
`errorMessage`. The reap cron (`/etc/cron.d/al-ai-fx-reap`, every 5 min)
releases jobs stuck in progress. If the daemon is down the app emails an
admin alert ("[AL-ai-FX] Compile server offline").

**Watch a live sale:** `scripts/watch-pipeline.sh` (or `... status` for a
snapshot).

---

## B. Launching a NEW robot — the complete checklist

### 1. Prepare the source (this repo)

```
robots/<slug>/MASTER.mq5          # the editable master
robots/<slug>/params.md           # strategy values (optional but do it)
```

The source MUST contain the compile contract (account lock, expiry flags,
OnInit gates, no underscores in trade-comment bases). Copy from
`robots/_shared/protection-block.mq5` if the EA doesn't have it yet.

Verify:
```bash
node scripts/check-robot-source.js robots/<slug>/MASTER.mq5
```
Do not skip this. Without the contract the daemon's injection silently misses
and you ship an EA that runs on ANY account.

A `WARN no runtime licence check` line means the EA only checks its expiry
when it is attached: a terminal left running keeps trading after the licence
ends. Add `IsLicenceExpired()` from `robots/_shared/protection-block.mq5`
before the code that opens new trades (every robot released since
2026-09-22 has it).

Then prove it compiles before any price goes live: stage the robot hidden,
queue a probe compile, activate only after it completes — the pattern in
`scripts/onboard-robots-2026-09.js` (use `--only=<slug>` so re-running it
never resets prices edited in the admin).

### 2. Upload the encrypted source

```bash
scripts/release-robot.sh <slug> 1
```
Freezes an audit copy + sha256 under `releases/v1/`, encrypts, uploads to
`sources/<slug>/v1.mq5.enc` on MinIO, and prints the SQL for step 3.

### 3. Create the catalog rows — admin UI (no SQL needed)

`/dashboard/admin/robots` → **Add robot**: slug (must match the upload), name,
short + long description, artwork URL, sort order. Then **Edit** → prices: one
row per tier you want to sell, each with an amount and an active flag.

Then **Upload source** on that row if you did not use `release-robot.sh` — it
encrypts, stores the next immutable version, and bumps `sourceVersion` itself.
Either path is fine; never both for the same version number.

The row's "On the catalog" column tells you the state you actually shipped:

| State | Means |
|---|---|
| **Selling** | listed AND a public tier has an active price |
| **Coming soon** | listed, no active price — the card shows, checkout refuses |
| **Hidden** | `active=false`, not on the catalog at all |

**Coming-soon pattern:** create the robot, leave every price inactive. Flip
prices active when you are ready to sell.

(SQL equivalents still work — `scripts/setup-launch-catalog.js` and
`scripts/onboard-precision-trader.js` are idempotent examples — but the UI is
the supported path now.)

### 4. Windows VM — **NOTHING TO DO**

This is the part people expect to be work and isn't. The compile worker is
stateless: it holds no robot sources and no per-robot configuration. It fetches
whatever source the job points at. A new robot needs zero VM changes.

(The only VM-side work ever needed: MetaEditor build changes — see
`robots/STRUCTURE.md` → Compiler build policy.)

### 5. Dashboard / site — **NOTHING TO DO**

The catalog, checkout picker, tier chips and dashboard all read from
`/api/robots`, which is driven by the DB rows from step 3. A new robot appears
automatically once its rows exist.

### 6. Verify before announcing

- Robot card visible in the catalog, correct price chips.
- Buy it (or temporarily re-enable the test bypass — see HANDOFF "Testing the
  funnel"), lock an MT5 account, confirm the job goes COMPLETED and the .ex5
  downloads.
- Load the .ex5 in MT5 on the locked account (works) and on a different
  account (must refuse with "Unauthorized account").

---

## C. Shipping a NEW VERSION of an existing robot

1. Edit `robots/<slug>/MASTER.mq5`, run `check-robot-source.js`.
2. `scripts/release-robot.sh <slug> <N+1>` — versions are immutable, never
   overwrite an existing one.
3. Bump the version so new jobs use it — either the SQL the script prints
   (`UPDATE "Robot" SET "sourceVersion"=<N+1> WHERE slug='<slug>';`) or, if you
   uploaded through `/dashboard/admin/robots` → **Upload source**, nothing: that
   button bumps it for you.
4. New compile jobs use the new version. Existing customers keep their current
   .ex5 until they request a rebuild — there is no forced re-issue.
