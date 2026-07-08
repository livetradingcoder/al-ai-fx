# Phase 3: Multi-Robot Schema Foundation - Research

**Researched:** 2026-07-05
**Domain:** Prisma migrations (baselining a `db push`-provisioned Postgres) + schema modeling + Node crypto encryption-at-rest for Vercel Blob
**Confidence:** HIGH on migration mechanics and encryption; MEDIUM on the build-step execution channel (novel to this project, but the two prior `db push` cycles prove the channel works)

> **No CONTEXT.md exists for this phase.** Per explicit instruction ("don't ask, just implement"), this research uses Claude's discretion on all implementation choices. There are no locked user decisions beyond ROADMAP.md / PROJECT.md / STATE.md. The one hard project decision that governs this phase: **test data may be wiped — no data-migration burden** (STATE.md, PROJECT.md Key Decisions).

---

## Summary

This phase does two structurally independent things: (1) it introduces the **first formal Prisma migration boundary** into a repo that has only ever used `prisma db push`, and (2) it adds a `Robot` catalog model + threads `robotId` through `Subscription`/`Compilation` + establishes an encrypted MQL5 source-storage convention in Vercel Blob.

The single highest-risk item is **migration baselining**. The remote Postgres already has a schema that drifted through two `db push` cycles (extended `PricingTier` enum, `WebhookDelivery` table) with zero migration history. If you naively run `prisma migrate dev` or `prisma migrate deploy` against it, Prisma sees a non-empty schema with no `_prisma_migrations` table and fails with **P3005** ("database schema is not empty"). The canonical fix is to baseline: generate a `0_init` migration from the current `schema.prisma` and mark it applied without executing it. **However**, this project has a rare escape hatch that makes baselining *optional*: test data is explicitly wipeable. Given that, the simplest correct path is to **reset the remote DB and let a normal `migrate deploy` build the history from scratch** — no `migrate resolve` gymnastics, no drift risk. This research recommends the reset path as the primary strategy and documents baselining as the fallback if wiping ever becomes undesirable.

The second-highest-risk item is the **execution channel**: `DATABASE_URL` is a Vercel-Sensitive (write-only) env var, so nothing that needs a live DB connection can run from this exec environment locally. Both `prisma migrate deploy` AND `prisma migrate resolve --applied` require a live DB connection (confirmed — `resolve` writes to `_prisma_migrations`). The proven channel is a temporary `package.json` build-script edit + `vercel --prod` deploy + log confirmation + revert. This works for `migrate deploy`; whether `migrate resolve` works the same way is untested but should — it's the same connection mechanism. The reset-and-deploy path only needs `migrate deploy` in the build step, which is the better-understood channel, another reason to prefer it.

**Primary recommendation:** Wipe the remote DB and adopt formal migrations from a clean baseline via `prisma migrate deploy` in the temporary build step. Add `Robot` with all CTLG-01 fields, make `robotId` NON-NULL FKs on `Subscription`+`Compilation` (safe precisely because data is wiped), seed GoldBot as the first `Robot` row, and build an AES-256-GCM encrypt-on-upload helper keyed by a single `SOURCE_ENCRYPTION_KEY` env var writing to `sources/<robotSlug>/v<N>.mq5.enc`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `prisma` (CLI) | ^6.19.3 (installed) | `migrate diff`, `migrate deploy`, `migrate resolve` | Already the project's ORM; `prisma.config.ts` already declares `migrations.path = "prisma/migrations"` |
| `@prisma/client` | ^6.19.3 (installed) | Generated client with new `Robot` model + relations | In use throughout `src/lib`, API routes |
| Node `crypto` (built-in) | Node built-in | AES-256-GCM encrypt/decrypt of `.mq5` source before Blob upload | Zero-dependency, FIPS-grade AEAD; no KMS needed for a solo-founder Vercel project |
| `@vercel/blob` | ^2.3.3 (installed) | `put()` encrypted source to `sources/` prefix | Already used for `compiled/` artifacts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` (via `prisma.config.ts` `import "dotenv/config"`) | present | Loads `DATABASE_URL` for local Prisma commands | Only relevant IF a local DB connection existed — it does not here (write-only sensitive var) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Baseline (`migrate diff` + `resolve --applied`) | **Reset + fresh `migrate deploy`** (RECOMMENDED) | Reset wipes data — normally unacceptable, but this project explicitly permits it. Eliminates all drift/P3005 risk and the untested `resolve`-via-build-step channel. |
| Single env-var key (AES-256-GCM) | Vercel KMS / AWS KMS / envelope encryption | KMS is overkill for a solo-founder pre-launch app with no paid KMS integration; adds infra + latency. Env-var key is the pragmatic standard here. |
| `robotId` NON-NULL now | Nullable `robotId` + backfill + tighten later | Nullable is the *standard* migration-safety pattern for a DB with real data — but here data is wiped, so NON-NULL immediately (per Success Criterion 2) is both simpler and correct. |
| Store source in Blob | Store `.mq5.enc` bytes in Postgres `Bytea` | Success Criterion 4 + SRCE-01 explicitly forbid Postgres/repo storage. Blob is mandated. |

**Installation:** No new npm packages required. Everything is Node built-in or already installed.

---

## Architecture Patterns

### Recommended Migration Strategy (the crux of this phase)

**PRIMARY: Reset + clean baseline (recommended — data is wipeable)**

Because test data may be wiped, skip baselining entirely and establish a clean migration history:

1. Locally (no DB needed) author the full new `schema.prisma` (adds `Robot`, `robotId` FKs).
2. Generate migration SQL *offline* without a DB using `migrate diff` (does not require a connection when both sides are files/schema):
   ```bash
   # produces the CREATE statements for the ENTIRE schema as the first migration
   npx prisma migrate diff \
     --from-empty \
     --to-schema-datamodel prisma/schema.prisma \
     --script > prisma/migrations/0_init/migration.sql
   ```
   Commit `prisma/migrations/0_init/migration.sql` to the repo (this is the "checked-in migration" the roadmap asked for).
3. Through the temporary build-step channel, run `prisma migrate reset --force` (drops everything) **then** `prisma migrate deploy` — OR simpler, run `db push --force-reset` to wipe, then let `migrate deploy` apply `0_init` cleanly against the now-empty DB. `migrate deploy` on an empty DB creates `_prisma_migrations` and applies `0_init` with NO P3005.
4. Run the GoldBot seed (see below).

This gives a real, checked-in migration history from `0_init` forward with zero drift, and only uses `migrate deploy` (the channel proven twice already via `db push`).

**FALLBACK: Baseline the existing DB without wiping (if data preservation ever matters)**

Only if wiping becomes undesirable. Per Prisma's official baselining workflow:

1. `mkdir -p prisma/migrations/0_init`
2. Generate the baseline SQL from current schema (offline, no DB):
   ```bash
   npx prisma migrate diff \
     --from-empty \
     --to-schema-datamodel prisma/schema.prisma \
     --script > prisma/migrations/0_init/migration.sql
   ```
   **CRITICAL:** `schema.prisma` MUST exactly match the live DB before this step. Since the live DB was built entirely by `db push` from this same `schema.prisma`, they already match — but the *new* Phase 3 additions (`Robot`, `robotId`) must NOT be in the baseline; the baseline captures only what's *already deployed*. Do `Robot`/`robotId` as a **second** migration (`migrate dev --create-only` or a hand-written second `migrate diff --from-schema-datamodel <old> --to-schema-datamodel <new>`).
3. Mark baseline applied WITHOUT executing (requires live DB — see execution-channel note):
   ```bash
   npx prisma migrate resolve --applied 0_init
   ```
4. Then `prisma migrate deploy` applies only the second (Robot) migration.

The `0_` prefix is load-bearing — Prisma applies migrations in lexicographic directory order.

**Why PRIMARY is preferred:** the fallback requires two migrations, exact schema/DB parity, AND `migrate resolve --applied` running through the build-step channel (untested — see Open Questions). The reset path is one migration, no parity requirement, and only `migrate deploy`.

### Execution Channel (the operational constraint)

`DATABASE_URL` is Vercel-Sensitive / write-only → `vercel env pull` returns it empty → NO Prisma command needing a live connection can run locally in this exec env. Proven channel (used for both prior `db push` cycles, STATE.md):

1. Temporarily edit `package.json` `build` script, e.g.:
   ```json
   "build": "prisma generate && prisma migrate deploy && next build"
   ```
   (for the reset path, prepend a reset: `prisma db push --force-reset --accept-data-loss && prisma migrate deploy && ...` — note: use `db push --force-reset` to wipe since `migrate reset` is interactive/non-CI-friendly; verify `--force-reset` flag availability for the installed CLI version).
2. `vercel --prod --yes`
3. Confirm via `vercel inspect <url> --logs` — look for the "migrations applied" / "database is now in sync" success line against `db.prisma.io:5432`.
4. **Revert** the build script in a follow-up commit (leave build as `prisma generate && next build`).

Commands that are file-only (`prisma migrate diff --from-empty --to-schema-datamodel ... --script`, `prisma generate`, `prisma validate`, `prisma format`) run fine locally — no DB needed. Author and commit the migration SQL locally; only *apply* via the build channel.

### `Robot` Model (CTLG-01 — all fields mandated by Success Criterion 1)

```prisma
model Robot {
  id               String         @id @default(cuid())
  slug             String         @unique          // "goldbot" — used in Blob paths + filenames
  name             String                           // "GoldBot"
  shortDescription String                           // catalog card copy
  longDescription  String         @db.Text          // detail-page copy (avoid varchar cap)
  active           Boolean        @default(true)     // catalog visibility flag
  artworkUrl       String?                           // catalog image; nullable until art exists
  sortOrder        Int            @default(0)        // catalog ordering
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  subscriptions   Subscription[]
  compilations    Compilation[]

  @@index([active, sortOrder])                       // catalog list query (Phase 4+)
}
```

Decisions embedded above (Claude's discretion, no CONTEXT.md):
- `slug @unique` and canonical-lowercase (`"goldbot"`) — it's the join key between DB, Blob path (`sources/<robotSlug>/`), and compiled filename (`getCompiledFilename(jobId, {robotSlug})`). **Watch:** current default in `compiler-filename.ts` is `"GoldBot"` (capital G). Decide one canonical casing and make the seed + filename helper agree. Recommend lowercase slug `goldbot` for URLs/paths, with `name = "GoldBot"` for display.
- `longDescription @db.Text` — Postgres `text`, avoids the default `varchar(191)`-style caps for long marketing copy.
- `artworkUrl` nullable — no artwork asset guaranteed at seed time.
- `active` + `sortOrder` indexed together — the obvious catalog query is `where active=true order by sortOrder`.

### `robotId` FK Threading (CTLG-04, Success Criterion 2)

```prisma
model Subscription {
  // ...existing...
  robotId String
  robot   Robot  @relation(fields: [robotId], references: [id])
  // Do NOT cascade-delete a Subscription when a Robot is removed — use Restrict (default)
  // so you can't orphan/void a paying user's license by deleting a catalog entry.
}

model Compilation {
  // ...existing...
  robotId String
  robot   Robot  @relation(fields: [robotId], references: [id])
}
```

- NON-NULL is safe here ONLY because data is wiped. (In a live-data world you'd add nullable → backfill → tighten.)
- **Default `onDelete` is `Restrict`** — keep it. A `Robot` referenced by any subscription/compilation cannot be deleted; use the `active=false` flag to retire a robot instead. Do NOT set `onDelete: Cascade` on these relations.
- Denormalizing `robotId` onto `Compilation` (rather than deriving it via `Compilation → Subscription → robotId`) is correct: the compile worker's poll response and filename generation need the slug directly, and a compilation's robot is immutable once created even if the subscription is later re-pointed. Populate `Compilation.robotId` from `subscription.robotId` at creation time in `update-mt5/route.ts`.

### Wiring Points (exact files — verified in codebase)

| File | Current behavior | Phase 3 change |
|------|------------------|----------------|
| `src/lib/subscriptions.ts` `provisionSubscription()` | `prisma.subscription.create({ data: { userId, tier, expiresAt, status }})` (line ~96) | Add `robotId`. Signature currently `(email, tierRaw, paygateId?, amount?, currency?)` — add a `robotId` (or `robotSlug`) param; resolve slug→id. For single-robot Phase 3, default to the GoldBot row. |
| `src/app/api/licenses/update-mt5/route.ts` | `prisma.compilation.create({ data: { subscriptionId, status }})` (line ~47) | Include `robotId: subscription.robotId` (fetch it in the `findUnique` `select`/`include`). |
| `src/app/api/compiler/poll/route.ts` | `select: { mt5AccountNumber, expiresAt }` on subscription (line ~62) | Optionally include robot slug so the worker filename uses the real slug. Poll response is additive-only per 01-03 decision — safe to add a field the daemon ignores until Phase 4. |
| `src/lib/compiler-filename.ts` | `getCompiledFilename(jobId, {robotSlug?})` defaults `"GoldBot"` | Slug source becomes the DB `Robot.slug`; reconcile casing with seed. |
| `src/app/api/checkout/free-trial/route.ts` | calls `provisionSubscription(email, "free-trial")` | Pass the GoldBot robot id/slug (single-robot default for now). |
| `src/app/api/webhooks/paygate/route.ts` | calls `provisionSubscription(...)` | Same — thread GoldBot default. |

### Seed Script (CTLG-05, Success Criterion 3)

The project has NO seed configured (`package.json` has no `prisma.seed`, `prisma.config.ts` has no `migrations.seed`). Scripts in `scripts/` are plain `node` files using `require('@prisma/client')` (see `create-admin.js`). Follow that established convention.

Two viable wirings:
1. **Prisma-native seed** — add to `prisma.config.ts` (Prisma 6 moved `seed` config out of `package.json` into the config file's `migrations.seed`), run automatically after `migrate reset`/`deploy`. Verify exact key name for 6.19 (`migrations: { seed: "node prisma/seed.js" }`).
2. **Standalone script** — `scripts/seed-goldbot.js` in the existing `create-admin.js` style, invoked manually in the build step after `migrate deploy`. Simpler, matches existing convention, no config-key uncertainty. **Recommended.**

```js
// scripts/seed-goldbot.js  (mirrors create-admin.js conventions)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.robot.upsert({
    where: { slug: 'goldbot' },
    update: {},                        // idempotent — safe to re-run
    create: {
      slug: 'goldbot',
      name: 'GoldBot',
      shortDescription: '...',
      longDescription: '...',
      active: true,
      sortOrder: 0,
    },
  });
}
main().finally(() => prisma.$disconnect());
```

`upsert` on the unique `slug` makes it idempotent (rerunnable safely) — same pattern as `create-admin.js`.

### Encrypted Source Storage (SRCE-01, Success Criterion 4)

Convention: `sources/<robotSlug>/v<N>.mq5.enc` in Vercel Blob, AES-256-GCM, versioned, never in repo/Postgres.

```ts
// src/lib/source-encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
function getKey(): Buffer {
  const hex = process.env.SOURCE_ENCRYPTION_KEY;      // 64 hex chars = 32 bytes
  if (!hex) throw new Error("SOURCE_ENCRYPTION_KEY missing");   // fail-closed
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) throw new Error("SOURCE_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return key;
}

// Encrypted blob layout: [12-byte IV][16-byte authTag][ciphertext]
export function encryptSource(plaintext: Buffer): Buffer {
  const iv = randomBytes(12);                          // 96-bit IV — GCM standard
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();                     // 16 bytes
  return Buffer.concat([iv, tag, ct]);
}

export function decryptSource(blob: Buffer): Buffer {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);  // throws if tampered
}
```

Upload helper (mirrors existing `@vercel/blob` `put()` usage from Phase 1):
```ts
import { put } from "@vercel/blob";
export async function uploadEncryptedSource(robotSlug: string, version: number, mq5: Buffer) {
  const enc = encryptSource(mq5);
  return put(`sources/${robotSlug}/v${version}.mq5.enc`, enc, {
    access: "public",              // MATCH Phase 1 decision; content is encrypted so public URL is opaque bytes
    addRandomSuffix: false,        // deterministic path — matches 01-02 daemon convention
    allowOverwrite: false,         // versioned: never overwrite an existing vN; bump N instead
    contentType: "application/octet-stream",
  });
}
```

Key-management decisions (Claude's discretion):
- **Single 32-byte key in `SOURCE_ENCRYPTION_KEY`** (Vercel env var, all scopes). Generate: `openssl rand -hex 32` — same provisioning pattern as `PAYGATE_WEBHOOK_SECRET` (02-02). No KMS.
- **Fail-closed** on missing/wrong-length key (matches project's fail-closed norm: webhook signature 02-02, daemon env checks 01-02).
- **IV is 12 bytes, random per encryption**, prepended to the blob — never reuse. **authTag** (16 bytes) prepended, verified on decrypt (tamper detection).
- **Versioning is explicit `vN`** in the path with `allowOverwrite:false` — a new source version = new file, old versions retained (immutable history). This satisfies "versioned."
- `access:'public'` is acceptable *because the bytes are ciphertext* — matches the deferred-hardening posture (01-02: signed URLs are a Phase 4 item). The encryption *is* the access control for source; the Blob URL leaking only exposes AEAD ciphertext.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Initial migration SQL | Hand-write CREATE TABLE statements | `prisma migrate diff --from-empty --to-schema-datamodel --script` | Generates exact, dialect-correct SQL incl. enums, indexes, FKs; hand-writing drifts from schema |
| Marking a migration applied | Manual `INSERT INTO _prisma_migrations` | `prisma migrate resolve --applied` | Correct checksum/rolled_back_at/logs columns; manual insert corrupts history |
| AEAD encryption | Custom CBC + separate HMAC | Node `crypto` `aes-256-gcm` | GCM is authenticated encryption in one primitive; DIY encrypt-then-MAC invites padding-oracle / MAC-mismatch bugs |
| Random IV | `Date.now()` / counter | `crypto.randomBytes(12)` | Predictable IVs break GCM confidentiality guarantees |
| Idempotent seed | `findFirst` then `create` | `prisma.robot.upsert({ where: { slug } })` | Race-free + rerunnable; matches project pattern (create-admin.js upsert, 02-03 unique-index idempotency) |

**Key insight:** every "custom" solution here has a first-party Prisma command or a Node built-in that is more correct. The only genuinely novel decision surface is the *strategy* (reset vs baseline) and the *channel* (build-step), not the primitives.

---

## Common Pitfalls

### Pitfall 1: P3005 "database schema is not empty"
**What goes wrong:** Running `migrate deploy`/`migrate dev` against the already-populated remote DB with no `_prisma_migrations` table.
**Why:** Prisma refuses to apply migrations onto a non-empty schema it has no history for.
**How to avoid:** Either wipe first (PRIMARY path — deploy then hits an empty DB) or baseline with `migrate resolve --applied 0_init` (FALLBACK). Never point `migrate deploy` at the drifted DB without one of these.
**Warning sign:** Build log shows `P3005` / "The database schema is not empty".

### Pitfall 2: `migrate resolve` needs a live DB — can't run locally here
**What goes wrong:** Assuming `resolve --applied` is a local bookkeeping op; it writes to `_prisma_migrations` in the live DB and needs `DATABASE_URL`, which is write-only/unreachable locally.
**Why:** `resolve` reads the datasource URL from `prisma.config.ts` and connects.
**How to avoid:** If using the baseline fallback, run `resolve` through the build-step channel (UNTESTED — see Open Questions). This is a second reason to prefer the reset path (only needs `migrate deploy`).
**Warning sign:** Local `resolve` hangs or errors with an empty/placeholder connection string (`prisma.config.ts` falls back to `postgresql://postgres:postgres@localhost:5432/postgres` — it would try localhost and fail).

### Pitfall 3: Baseline must exactly match the deployed DB (fallback path only)
**What goes wrong:** Baseline `0_init` includes the NEW `Robot`/`robotId` additions, so it no longer matches what's actually deployed → drift on next `migrate deploy`.
**Why:** Baseline captures *current deployed* state; new schema changes are a *separate* migration.
**How to avoid:** In the fallback path, generate `0_init` from the OLD schema (pre-Robot), then a second migration for the Robot additions. The PRIMARY reset path sidesteps this entirely — one `0_init` with the full schema against an empty DB.

### Pitfall 4: Forgetting to revert the build-script edit
**What goes wrong:** `build` stays as `... migrate deploy ...` (or worse `db push --force-reset`), so every future deploy re-runs migrations or re-wipes.
**Why:** The build-step channel is a temporary hack.
**How to avoid:** Same discipline as 02-01/02-03 — apply in one commit, revert in the immediate follow-up commit. `--force-reset` in a persistent build script would wipe prod on every deploy — catastrophic; revert is mandatory.
**Warning sign:** `package.json` `build` still contains `migrate`/`--force-reset` after the phase.

### Pitfall 5: GCM IV/tag layout mismatch on decrypt
**What goes wrong:** Encrypt writes `[iv][tag][ct]` but decrypt slices assuming `[iv][ct][tag]` → auth failure or garbage.
**Why:** GCM tag placement is a convention you define; both sides must agree.
**How to avoid:** One module (`source-encryption.ts`) owns both directions with a documented layout comment (as in the code example). Unit-test round-trip encrypt→decrypt.

### Pitfall 6: Slug casing drift between seed, Blob path, and filename
**What goes wrong:** Seed writes `slug: "goldbot"` but `compiler-filename.ts` defaults `"GoldBot"`, so Blob source path (`sources/goldbot/`) and compiled filename (`AL-ai-FX_GoldBot_...`) disagree.
**Why:** The `robotSlug?` hook in `compiler-filename.ts` was added speculatively in Phase 1 with a capital-G default.
**How to avoid:** Pick canonical lowercase `goldbot` for slug/paths, keep `GoldBot` only as display `name`; when threading real slug through, ensure the filename helper receives the DB slug. Reconcile the default.

---

## Code Examples

Verified against official Prisma baselining docs and Node crypto docs. See Sources.

### Generate first migration offline (no DB connection)
```bash
mkdir -p prisma/migrations/0_init
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
# commit prisma/migrations/0_init/migration.sql
```
Source: https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining

### Apply via temporary build step (reset path)
```jsonc
// package.json (TEMPORARY — revert after)
"build": "prisma generate && prisma db push --force-reset --accept-data-loss && prisma migrate deploy && node scripts/seed-goldbot.js && next build"
```
Then `vercel --prod --yes`, confirm in logs, revert to `"prisma generate && next build"`.

### AES-256-GCM round-trip — see `src/lib/source-encryption.ts` example above.
Source: https://nodejs.org/api/crypto.html (createCipheriv / getAuthTag / setAuthTag)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `prisma db push` (no history) — Phase 1/2 stopgap | Formal `prisma migrate` with checked-in `prisma/migrations/` | This phase (03) | First real migration boundary; all future schema changes go through migrations, not `db push` |
| Prisma `package.json` `"prisma": { "seed": ... }` | `prisma.config.ts` `migrations.seed` (Prisma 6+) | Prisma 6 | If using Prisma-native seed, config lives in `prisma.config.ts`, not `package.json`. Standalone `scripts/*.js` seed avoids this entirely (recommended). |

**Deprecated/outdated:**
- `crypto.createCipher()` (no IV) — deprecated since Node 10; MUST use `createCipheriv`. (Confirmed, Node docs.)
- Relying on `db push` for schema evolution — explicitly ends this phase per STATE.md decision.

---

## Open Questions

1. **Does `prisma migrate resolve --applied` work through the Vercel build-step channel?**
   - What we know: `resolve` needs a live DB connection (writes `_prisma_migrations`). `migrate deploy` has been proven twice via the build step (`db push`). The connection mechanism is identical (reads `prisma.config.ts` datasource URL).
   - What's unclear: `resolve` in a non-interactive CI build context — untested in this project. It should work since it's a one-shot connect-and-insert.
   - Recommendation: **Avoid needing it** by taking the reset path (only `migrate deploy` required). Only reach for `resolve` if data preservation becomes a requirement, and test it on a throwaway deploy first.

2. **Exact `--force-reset` flag support in prisma 6.19 CLI + does `migrate reset` work non-interactively in the build step?**
   - What we know: `db push --force-reset` and `migrate reset --force` both exist historically; `--accept-data-loss` is confirmed used in this project's prior build steps.
   - What's unclear: whether the installed 6.19 CLI's `migrate reset --force` prompts in Vercel's non-TTY build. `db push --force-reset --accept-data-loss` is the safer non-interactive wipe.
   - Recommendation: use `db push --force-reset --accept-data-loss` to wipe, then `migrate deploy` on the empty DB. Verify flags with `npx prisma db push --help` locally (help is offline-safe) during planning.

3. **Prisma 6.19 seed config key name (`migrations.seed` in `prisma.config.ts`).**
   - What we know: Prisma 6 moved seed config out of `package.json`.
   - What's unclear: exact key/shape for 6.19.
   - Recommendation: Sidestep with a standalone `scripts/seed-goldbot.js` invoked explicitly in the build step (matches existing `scripts/create-admin.js` convention). No config-key risk.

4. **Should Phase 3 seed >1 robot?**
   - Success Criterion 3 requires GoldBot as "the first catalog entry" — singular. Roadmap says "no user-facing UX yet." Seed ONLY GoldBot. Additional robots are Phase 4+ catalog work.

5. **Where does the actual GoldBot `.mq5` source get uploaded from?**
   - SRCE-01 defines the *storage convention* and helper. The source file today lives on the Windows VM (`base_ea_source.mq5`, per STATE.md). Phase 3's SRCE-01 deliverable is the encrypt+upload *helper* + convention, plus (recommended) a one-time upload of GoldBot's current source as `sources/goldbot/v1.mq5.enc`. Whether the compile worker *reads* from Blob (vs. its local `base_ea_source.mq5`) is a Phase 4 pipeline-threading concern, not required by Phase 3 success criteria. Plan SRCE-01 as: build helper + upload v1 + document convention; do NOT rewire the worker's source resolution in this phase.

---

## Sources

### Primary (HIGH confidence)
- https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining — exact `migrate diff --from-empty --to-schema-datamodel --script` + `migrate resolve --applied 0_init` commands; `0_` prefix requirement
- https://www.prisma.io/docs/cli/migrate/resolve — `resolve --applied` writes to `_prisma_migrations`, requires DB connection
- https://www.prisma.io/docs/orm/prisma-migrate/workflows/troubleshooting — P3005 non-empty-schema, drift-after-db-push behavior
- https://nodejs.org/api/crypto.html — `createCipheriv`/`createDecipheriv`/`getAuthTag`/`setAuthTag`; `createCipher` deprecation
- Codebase (HIGH — direct read): `prisma/schema.prisma`, `prisma.config.ts` (migrations.path already set), `package.json` (build script, deps), `src/lib/subscriptions.ts`, `src/app/api/licenses/update-mt5/route.ts`, `src/app/api/compiler/poll/route.ts`, `src/lib/compiler-filename.ts`, `scripts/create-admin.js`, `scripts/test-blob.js`, `.planning/STATE.md`

### Secondary (MEDIUM confidence)
- https://www.prisma.io/docs/cli/migrate/diff — `migrate diff` runs offline for file-to-file/schema comparisons
- Node AES-256-GCM community references (12-byte IV, 16-byte tag, no IV reuse) — cross-verified against nodejs.org

### Tertiary (LOW confidence — flagged in Open Questions)
- `migrate resolve` behavior specifically through a Vercel non-TTY build step — inferred, not tested in this project

## Metadata

**Confidence breakdown:**
- Migration mechanics (baseline/reset/deploy commands): HIGH — official Prisma docs + `prisma.config.ts` already migration-ready
- Schema modeling (`Robot` fields, FK nullability/onDelete): HIGH — Success Criteria are explicit; NON-NULL safe because data is wipeable
- Encryption (AES-256-GCM helper): HIGH — Node built-in, standard AEAD pattern
- Execution channel (`resolve` via build step): MEDIUM — `deploy` proven twice; `resolve` inferred (Open Q 1). Reset path avoids the uncertainty.
- Wiring points: HIGH — exact files/line numbers verified by direct read

**Research date:** 2026-07-05
**Valid until:** ~2026-08-05 (stable domain; Prisma minor releases could adjust CLI flags — re-verify `db push --help` at plan time)
