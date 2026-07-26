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

### 1. Prepare the source (visionfx-ea repo)

```
robots/<slug>/MASTER.mq5          # the editable master
robots/<slug>/params.md           # strategy values (optional but do it)
```

The source MUST contain the compile contract (account lock, expiry flags,
OnInit gates, no underscores in trade-comment bases). Copy from
`robots/_shared/protection-block.mq5` if the EA doesn't have it yet.

Verify:
```bash
node tools/check-source.js robots/<slug>/MASTER.mq5
```
Do not skip this. Without the contract the daemon's injection silently misses
and you ship an EA that runs on ANY account.

### 2. Upload the encrypted source

```bash
tools/release-robot.sh <slug> 1
```
Freezes an audit copy + sha256 under `releases/v1/`, encrypts, uploads to
`sources/<slug>/v1.mq5.enc` on MinIO, and prints the SQL for step 3.

### 3. Create the catalog rows (DB)

`Robot` row — slug (must match the upload), name, descriptions, artworkUrl,
sortOrder, `sourceVersion` = the version you just uploaded, `active` = true.

`RobotPrice` rows — one per tier you want to sell (FREE_TRIAL / 1-month /
3-month / 6-month / LIFETIME…), each with `amount` and `active`.

**Coming-soon pattern:** create the Robot with `active=true` but leave every
RobotPrice `active=false` — the catalog shows the card with a "coming soon"
badge and checkout excludes it. Flip prices active when you're ready to sell.

`scripts/setup-launch-catalog.js` is the idempotent example to copy from.

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

1. Edit `robots/<slug>/MASTER.mq5`, run `check-source.js`.
2. `tools/release-robot.sh <slug> <N+1>` — versions are immutable, never
   overwrite an existing one.
3. `UPDATE "Robot" SET "sourceVersion"=<N+1> WHERE slug='<slug>';`
4. New compile jobs use the new version. Existing customers keep their current
   .ex5 until they request a rebuild — there is no forced re-issue.
