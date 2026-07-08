# Phase 6: Public Catalog, Per-Robot Pricing, Free Trials - Research

**Researched:** 2026-07-06
**Domain:** Next.js 16 App Router (per-robot data modeling, server-side price/tier enforcement, HMAC-bound checkout, Prisma incremental migration)
**Confidence:** HIGH (codebase-verified) / MEDIUM (Paygate signature-binding attack surface — reasoned, not externally verified)

> No CONTEXT.md exists for this phase (user: "don't ask, just implement"). Full discretion on implementation choices. This RESEARCH is grounded in the **actual codebase** (all files read this session), not training assumptions. The single hard external unknown (Next 16 API drift) is mitigated by `AGENTS.md`'s standing rule: read `node_modules/next/dist/docs/` before writing Next-specific code.

---

## Summary

This phase converts a single-robot (GoldBot-hardcoded) purchase funnel into a **multi-robot catalog with per-robot pricing**. Four pieces of work interlock:

1. **A new pricing data model.** Today pricing is a static global map in `src/config/pricing.ts` (`PRICING_TIERS`) mirrored in `src/lib/pricing-tiers.ts` (`TIER_METADATA` — the SSoT that maps `TierId` → `PricingTier` enum + amount + duration). Phase 6 must add a **per-robot pricing table** (`RobotPrice`) so each robot has its own tier rows with independent prices, editable by admin without deploy (PRIC-04). The existing `TIER_METADATA` should be **retained as the tier catalog / duration source of truth** (it already owns `durationDays` and the `TierId ↔ PricingTier` mapping via an exhaustive, fail-closed switch) and the new table should carry only per-robot **price** overrides — do NOT duplicate duration logic into the DB.

2. **Threading `robotSlug` end-to-end.** `robotSlug` must flow: catalog → checkout UI → `create-session` → **into the HMAC-signed Paygate callback URL** → webhook → `provisionSubscription(email, tier, …, robotSlug)`. Today `provisionSubscription` resolves a hardcoded `GOLDBOT_SLUG` internally (`src/lib/subscriptions.ts:32`). The free-trial route (`src/app/api/checkout/free-trial/route.ts`) is likewise single-robot.

3. **Server-side tier + price enforcement with no client-side bypass.** The existing fail-closed discipline (`UnknownTierError`, `verifyPaygateSignature`) must extend to: (a) refuse unknown `robotSlug`, (b) refuse a `tier` not priced for that robot, (c) **compute `amount` server-side from the `RobotPrice` row — never trust a client-supplied amount** (already true today: `create-session` reads `PRICING_TIERS[tier].amount`, client sends no amount). The signature currently binds `${orderRef}${email}${tier}${amount}` — this phase should **add `robotSlug` to the signed payload** to prevent a robot-swap replay (see Pitfall 1).

4. **One free trial per robot, DB-enforced (TRIL-01/02).** Add a partial unique index on `(userId, robotId)` where `tier = FREE_TRIAL`. The current "no ACTIVE duplicate" guard in `provisionSubscription` is **not sufficient** — a trial that expires (status → EXPIRED) would slip past it, letting a user re-claim. The constraint must be on existence-ever, not active-ever.

**Primary recommendation:** Add one `RobotPrice` table (composite unique `(robotId, tier)`), keep `TIER_METADATA` as the tier/duration SSoT, thread `robotSlug` through the whole funnel **including the HMAC payload**, enforce price+tier server-side by looking up `RobotPrice` (fail-closed, mirroring `UnknownTierError`), and add a Postgres **partial unique index** for the one-trial-per-robot rule. Ship the schema via one incremental migration through the proven Vercel build-step channel.

---

## Standard Stack

Everything needed is already installed. **No new dependencies.** This is a modeling + wiring phase, not a library-adoption phase.

### Core (already present)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `prisma` / `@prisma/client` | ^6.19.3 | new `RobotPrice` model + partial unique index migration | Already the ORM; migration history established since `0_init` |
| `next` | 16.2.3 | catalog page (RSC), server actions for admin price edit | App Router already in use under `src/app/[locale]/` |
| `next-intl` | ^4.9.1 | locale routing (`as-needed` prefix, 7 locales) | Catalog page must live under `[locale]/` like every other page |
| `next-auth` | ^4.24.14 | ADMIN role check inside price-edit server action | Pattern already in `robots/actions.ts` |

### Supporting (already present)
| Library | Version | Purpose |
|---------|---------|---------|
| `framer-motion` | ^12.38.0 | optional catalog card entrance polish (used elsewhere) |
| `lucide-react` | ^1.8.0 | icons for catalog CTA |
| `node:crypto` | built-in | HMAC — extend signed payload with robotSlug |

**Installation:** none. `npm install` unchanged.

---

## Architecture Patterns

### Recommended data model: `RobotPrice` (price overrides), NOT a full pricing table

**Decision:** Add a thin per-robot price table. Keep `TIER_METADATA` as the canonical list of valid tiers + their durations + the `TierId ↔ PricingTier` enum mapping.

```prisma
model RobotPrice {
  id          String      @id @default(cuid())
  robotId     String
  robot       Robot       @relation(fields: [robotId], references: [id], onDelete: Cascade)
  tier        PricingTier
  amount      Float       // per-robot price in USD; 0 for FREE_TRIAL
  active      Boolean     @default(true) // hide a tier for one robot without deleting the row
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@unique([robotId, tier]) // one price row per (robot, tier)
  @@index([robotId, active])
}
```
Add `prices RobotPrice[]` to the `Robot` model.

**Why this shape, not putting duration/priceString in the DB:**
- `TIER_METADATA` already owns `durationDays` and `computeExpirationDate()` is an **exhaustive `assertNever` switch** (`pricing-tiers.ts:42`) — a compile-time guarantee. Moving durations into the DB throws that away. Keep durations in code; keep only **price** per robot in the DB.
- `priceString` (`"$1,799"`) is a **presentation** concern — derive it from `amount` at render time (`toLocaleString`), don't store it. Storing it invites drift.
- The `PricingTier` enum is the join key. `RobotPrice.tier` being the enum (not the `TierId` string) means Prisma enforces validity at the DB layer for free.

### Recommended one-trial-per-robot constraint: Postgres partial unique index

Prisma's `@@unique` cannot express a **filtered** (WHERE) uniqueness. Since the rule is "at most one FREE_TRIAL subscription per (user, robot) — other tiers can repeat," you need a **partial unique index**, which Prisma supports only via **raw SQL in the migration** (not expressible in `schema.prisma`). Pattern:

```sql
-- in the migration.sql (hand-appended after prisma migrate diff generates the RobotPrice table)
CREATE UNIQUE INDEX "Subscription_one_free_trial_per_robot"
  ON "Subscription" ("userId", "robotId")
  WHERE "tier" = 'FREE_TRIAL';
```

The application code must then translate the resulting `P2002` into a friendly "You already used your free trial for this robot" — mirroring the existing `P2002` handling in `webhooks/paygate/route.ts:80` and `robots/actions.ts:99`. **DB-enforced = cannot be bypassed by the client (TRIL-02).** Keep a pre-check for a nice UX message, but the index is the real guard (race-safe, unlike a read-then-write check).

> Prisma note: after adding this index via raw SQL, `schema.prisma` won't "know" about it, which is fine for `migrate deploy` (it just runs the SQL). Do NOT let a later `migrate diff` try to "correct" it — document it. Confirm current Prisma behavior in `node_modules/prisma` docs before finalizing; partial-index-via-raw-SQL has been the standard workaround for years and is HIGH confidence, but verify the CLI version doesn't now support it natively.

### Recommended project structure (new/changed files)

```
prisma/
  migrations/
    2026XXXX_add_robot_pricing_and_trial_index/  # RobotPrice table + partial unique index (raw SQL appended)
src/
  lib/
    robot-pricing.ts        # NEW: getRobotPrice(robotSlug, tier) → { amount } | throws; UnknownRobotError/UnknownRobotPriceError
    subscriptions.ts        # CHANGED: provisionSubscription gains robotSlug param, drops GOLDBOT_SLUG default
    pricing-tiers.ts        # UNCHANGED (stays the tier/duration SSoT)
  app/
    [locale]/
      catalog/
        page.tsx            # NEW: RSC — lists active robots (CTLG-02)
        CatalogClient.tsx?  # optional, only if interactivity needed
      checkout/
        CheckoutClient.tsx  # CHANGED: read robotSlug from query, send it, per-robot prices
      dashboard/admin/robots/
        actions.ts          # CHANGED: add updateRobotPrices server action (ADMIN-guarded)
        RobotForm.tsx        # CHANGED: replace read-only PRICING_TIERS block with editable per-robot price inputs
  app/api/
    paygate/create-session/route.ts   # CHANGED: accept robotSlug, look up RobotPrice, sign robotSlug into payload
    webhooks/paygate/route.ts         # CHANGED: read robotSlug param, include in signature payload, pass to provision
    checkout/free-trial/route.ts      # CHANGED: accept robotSlug, pass to provision
```

### Pattern: fail-closed server-side price/tier resolution (mirror `UnknownTierError`)

The codebase's defining discipline is "refuse unknown, never coerce" (`mapTier` throws `UnknownTierError`, every caller maps it to HTTP 400 — never a default). Extend it:

```typescript
// src/lib/robot-pricing.ts  (new — mirrors pricing-tiers.ts fail-closed style)
export class UnknownRobotError extends Error { /* name = "UnknownRobotError" */ }
export class UnknownRobotPriceError extends Error { /* tier not priced for this robot */ }

// Returns the server-authoritative amount for (robot, tier). NEVER trusts a client amount.
export async function resolveRobotPrice(robotSlug: string, tierRaw: string) {
  const tier = mapTier(tierRaw);            // throws UnknownTierError on bad tier (existing)
  const robot = await prisma.robot.findUnique({ where: { slug: robotSlug } });
  if (!robot || !robot.active) throw new UnknownRobotError(robotSlug);   // inactive robots not purchasable
  const price = await prisma.robotPrice.findUnique({
    where: { robotId_tier: { robotId: robot.id, tier } },
  });
  if (!price || !price.active) throw new UnknownRobotPriceError(`${robotSlug}/${tierRaw}`);
  return { robot, tier, amount: price.amount };
}
```
`create-session` calls this to get `amount` (replacing `PRICING_TIERS[tier].amount`), and every route maps the new errors → HTTP 400, exactly as `UnknownTierError` is handled today.

### Pattern: catalog page as pure RSC

The catalog is a Server Component that queries `prisma.robot.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, include: { prices: { where: { active: true } } } })` and renders cards. There's already an index for exactly this: `@@index([active, sortOrder])` on `Robot` (schema.prisma:77). No client component needed unless the "pick tier" happens on the catalog page itself; simpler to link each card to `/checkout?robot=<slug>&tier=<tierId>` and let the existing checkout UI show the tier picker.

### Anti-Patterns to Avoid
- **Storing `amount` in the signed URL as the price source.** The amount in the callback is an *echo* for signature reconstruction, not the price of record. Compute price server-side from `RobotPrice`; the URL amount is only there because Paygate omits `value_coin` for USD (see `webhooks/paygate/route.ts:31`). Binding it in the signature prevents tampering, but the *authoritative* number is the DB row.
- **Leaving `robotSlug` out of the HMAC payload.** See Pitfall 1 — this is the phase's key security decision.
- **Using the "no ACTIVE subscription" check for trial uniqueness.** It permits re-claim after expiry. Use the DB partial unique index.
- **Duplicating durations/priceString into `RobotPrice`.** Presentation + duration stay in code (`TIER_METADATA`, `computeExpirationDate`).
- **Coercing unknown robot to GoldBot.** `provisionSubscription` currently *defaults* to GoldBot; after this phase an unknown/missing slug must **refuse**, not fall back.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| One-trial-per-robot | read-then-create JS check | Postgres partial unique index + `P2002` handling | read-then-write races; index is atomic + unbypassable |
| Tier validity | new per-robot tier whitelist | existing `mapTier` / `TIER_METADATA` | already the fail-closed SSoT; enum-typed |
| Expiry dates | per-robot duration column | existing `computeExpirationDate` exhaustive switch | compile-time exhaustiveness via `assertNever` |
| Signature verify | new HMAC code | extend `verifyPaygateSignature` payload only | constant-time compare + fail-closed already correct |
| Idempotency/replay | new dedupe | existing `WebhookDelivery` unique-signature row | already closes SECR-02/03; adding robotSlug to signature keeps it working |
| Price formatting | store `priceString` | `amount.toLocaleString("en-US", {style:"currency"})` at render | avoids drift between number and string |

**Key insight:** This codebase already solved "fail-closed validation" and "atomic idempotency." Phase 6's job is to *extend* those patterns to a second dimension (robot), not invent new ones.

---

## Common Pitfalls

### Pitfall 1: Robot-swap replay if `robotSlug` isn't in the signed payload  (SECURITY — the key decision)
**What goes wrong:** Signature today = `HMAC(${orderRef}${email}${tier}${amount})`. If `robotSlug` rides as an *unsigned* query param on the callback, an attacker who observes/obtains a valid callback for a cheap robot's tier could swap `robotSlug` to an expensive robot at the *same tier+amount* and the signature would still verify — provisioning the expensive robot for a cheap-robot payment. Even without cross-robot price parity, an unsigned slug means the webhook's robot identity is attacker-controlled.
**Why it happens:** The HMAC binds only what's in the payload string. Anything appended to the URL but not in the payload is unauthenticated.
**How to avoid:** Add `robotSlug` to BOTH the create-session signing payload and the webhook reconstruction, in a fixed order. Recommended: `${orderRef}${email}${robotSlug}${tier}${amount}`. Change both sites together (`create-session/route.ts:87` and `webhooks/paygate/route.ts:35`) — they MUST match byte-for-byte or every callback 401s. Confidence: MEDIUM (attack is reasoned from the code, not externally reported) but the mitigation is low-cost and aligns with existing discipline — **do it.**
**Warning signs:** After the change, if legit callbacks return 401 "Invalid signature," the two payload strings drifted.

### Pitfall 2: Migration applied to a DB with no history / wrong channel
**What goes wrong:** `DATABASE_URL` is Vercel-Sensitive (write-only); nothing needing a live DB runs locally. But history now EXISTS since `0_init` — so this is a normal **incremental** `migrate deploy`, NOT the Phase 3 bootstrap.
**How to avoid:** Author the migration SQL locally (`prisma migrate diff --from-... --script` or hand-write following the `20260705_add_source_version` example — it's just `ALTER TABLE`/`CREATE TABLE`/`CREATE UNIQUE INDEX`). Apply via the proven channel: temporarily set `build` to `prisma generate && prisma migrate deploy && node scripts/seed-robot-prices.js && next build`, `vercel --prod --yes`, confirm in build log, then **revert build script in a separate commit**. **Never** use `migrate reset` / `db push --force-reset` — that was the one-time Phase 3 bootstrap and would wipe production data.
**Warning signs:** Build log shows "Applying migration …" for the new dir only; if it shows P3005 or a reset, stop.

### Pitfall 3: Existing GoldBot has no `RobotPrice` rows after migration
**What goes wrong:** The migration creates an empty `RobotPrice` table; GoldBot (and any existing robot) has zero price rows → catalog shows no prices, checkout refuses every tier (correctly fail-closed, but broken UX).
**How to avoid:** Seed `RobotPrice` rows for GoldBot from the current global `PRICING_TIERS`/`TIER_METADATA` values in the same build step, via a `scripts/seed-robot-prices.js` (idempotent `upsert` on `robotId_tier`, matching the existing `seed-goldbot.js` style at `scripts/seed-goldbot.js`). This preserves current GoldBot prices exactly while making them per-robot.
**Warning signs:** Post-deploy, GoldBot checkout returns `UnknownRobotPriceError`.

### Pitfall 4: `secret-test` / `lifetime-source` tiers leaking into public catalog
**What goes wrong:** `PRICING_TIERS` has 8 tiers including `secret-test` and `lifetime-source` (contact-only / hidden per `pricing-showcase.ts`, which only surfaces 10-days/1-month/6-months/1-year publicly + free-trial). If per-robot pricing naively renders every `RobotPrice` row, hidden tiers appear publicly.
**How to avoid:** Use the `RobotPrice.active` flag (or a separate "publicly listable" notion) and/or keep the public catalog's tier display driven by the same curated set `pricing-showcase.ts` uses. Admin can create price rows for hidden tiers but they shouldn't render on the public card. Decide explicitly which tiers are catalog-visible.
**Warning signs:** `$79,999` or `$10` tiers showing on the public catalog.

### Pitfall 5: Next 16 API drift
**What goes wrong:** `AGENTS.md` warns this Next.js diverges from training data (App Router conventions, `params` now a Promise — seen in `checkout/page.tsx`, server action signatures, `revalidatePath`). Writing from memory breaks the build.
**How to avoid:** Per `AGENTS.md`, read `node_modules/next/dist/docs/` for any Next-specific API before writing. Follow the **existing** files as templates (`robots/actions.ts` for server actions, `robots/page.tsx` for admin RSC with auth redirect, `checkout/page.tsx` for `generateMetadata` + Promise params).
**Warning signs:** Type errors on `params`, server action, or `revalidatePath` usage.

### Pitfall 6: Free-trial route has weaker validation than paid route
**What goes wrong:** `free-trial/route.ts` accepts `{ email }` only; adding `robotSlug` there without the same fail-closed resolution as `create-session` could let a free trial be claimed for an inactive/nonexistent robot.
**How to avoid:** Route the free-trial `robotSlug` through the SAME `resolveRobotPrice`/robot-existence check (amount must be 0 for FREE_TRIAL — verify against the robot's FREE_TRIAL `RobotPrice` row, or assert 0). Then `provisionSubscription` hits the partial-unique-index trial guard.
**Warning signs:** Free trial provisioned for a robot with no active price row.

---

## Code Examples

### Verified: current signing site to extend (create-session)
```typescript
// src/app/api/paygate/create-session/route.ts:87 (CURRENT)
const signaturePayload = `${orderRef}${email}${tier}${amount}`;
// PHASE 6: → `${orderRef}${email}${robotSlug}${tier}${amount}`
// and callbackUrl.searchParams.set("robot", robotSlug) so the webhook can read it back.
```

### Verified: current verify site to match (webhook)
```typescript
// src/app/api/webhooks/paygate/route.ts:35 (CURRENT)
const signaturePayload = `${orderRef}${email}${tier}${callbackAmount}`;
// PHASE 6: read robotSlug = url.searchParams.get("robot") || "";
// → `${orderRef}${email}${robotSlug}${tier}${callbackAmount}`  (MUST match create-session order)
// then: provisionSubscription(email, tier, orderRef, amount, currency, robotSlug)
```

### Verified: current single-robot default to replace (subscriptions)
```typescript
// src/lib/subscriptions.ts:32,59 (CURRENT — remove the hardcoded default)
const GOLDBOT_SLUG = "goldbot";
const robot = await prisma.robot.findUniqueOrThrow({ where: { slug: GOLDBOT_SLUG } });
// PHASE 6: provisionSubscription(email, tierRaw, paygateId?, amount?, currency?, robotSlug: string)
//   resolve robot from robotSlug (fail-closed: findUnique → throw UnknownRobotError if missing/inactive)
```

### Verified: existing incremental migration to copy (pattern for RobotPrice + index)
```sql
-- prisma/migrations/20260705_add_source_version/migration.sql (EXISTING — this is the shape to follow)
ALTER TABLE "Robot" ADD COLUMN "sourceVersion" INTEGER NOT NULL DEFAULT 1;
-- Phase 6 migration: CREATE TABLE "RobotPrice" (...); plus the partial unique index CREATE UNIQUE INDEX ... WHERE "tier" = 'FREE_TRIAL';
```

### Verified: existing seed style to copy (seed-robot-prices.js)
```javascript
// mirror scripts/seed-goldbot.js — upsert, idempotent
await prisma.robotPrice.upsert({
  where: { robotId_tier: { robotId: goldbot.id, tier: 'ONE_MONTH' } },
  update: {},                       // don't clobber admin edits on re-run
  create: { robotId: goldbot.id, tier: 'ONE_MONTH', amount: 199 },
});
```

### Verified: existing admin server-action auth pattern to reuse (price edit)
```typescript
// src/app/[locale]/dashboard/admin/robots/actions.ts — every action starts with this
const session = await getServerSession(authOptions);
if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");
// ... prisma writes ... then revalidatePath("/dashboard/admin/robots");
// PHASE 6 updateRobotPrices: also revalidatePath("/catalog") and the checkout if it reads prices at request time.
```

---

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Global static `PRICING_TIERS` map | Per-robot `RobotPrice` rows (price only) + `TIER_METADATA` kept for tiers/durations | This phase | Admin edits prices without deploy (PRIC-04) |
| `provisionSubscription` defaults to `GOLDBOT_SLUG` | `robotSlug` is a required, fail-closed param | This phase | True multi-robot; unknown slug refused |
| Signature binds `orderRef+email+tier+amount` | Also binds `robotSlug` | This phase | Blocks robot-swap replay |
| Trial guard = "no ACTIVE dup" | Partial unique index on `(userId, robotId) WHERE tier=FREE_TRIAL` | This phase | One trial per robot ever, race-safe (TRIL-01/02) |
| No public catalog | RSC catalog under `[locale]/catalog` | This phase | CTLG-02 |

**Deprecated/outdated after this phase:**
- Read-only `PRICING_TIERS` block in `RobotForm.tsx:163-178` (the "Per-robot pricing arrives in Phase 6" note) → replaced by editable per-robot price inputs.
- `GOLDBOT_SLUG` constant in `subscriptions.ts` → removed.
- Do NOT delete `PRICING_TIERS`/`TIER_METADATA` — `TIER_METADATA` stays the tier/duration SSoT; `PRICING_TIERS` may remain as the seed source + public-tier curation reference (used by `pricing-showcase.ts`, `CheckoutClient.tsx`). Migrating those consumers to read DB prices is part of this phase for checkout, but the tier *list* stays code-driven.

---

## Open Questions

1. **Should the public catalog show every priced tier or a curated subset per robot?**
   - Known: `pricing-showcase.ts` today curates public tiers (10-days/1-month/6-months/1-year + free-trial), hiding `lifetime`, `lifetime-source`, `secret-test` behind "contact us."
   - Unclear: whether per-robot pricing means per-robot tier *visibility* too.
   - Recommendation: give `RobotPrice.active` a "listable" meaning and default hidden tiers to non-public; drive the catalog card's visible tiers from the same curated set the showcase uses, per robot. Confirm with the roadmap author if a robot should be able to expose a lifetime tier publicly.

2. **Does `robotSlug` or `robotId` thread through the URL?**
   - Known: `Robot.slug` is the stable public join key (kebab, unique, used for Blob paths); `id` is a cuid.
   - Recommendation: use `slug` in URLs (readable, already the semantic key), resolve to `id` server-side. Success criterion CTLG-03 says "robotSlug (or robotId)" — slug is the better public identifier.

3. **Where does the tier picker live — on the catalog card or on checkout?**
   - Known: checkout already reads `?tier=` from query and shows an order summary; it hardcodes "GoldBot EA" as the product (`CheckoutClient.tsx:338`).
   - Recommendation: catalog card links to `/checkout?robot=<slug>&tier=<tierId>` (or `?robot=<slug>` and let checkout render a per-robot tier picker). Checkout must replace the hardcoded "GoldBot EA" / "Your GoldBot access" strings with the selected robot's name. Lower-risk: keep checkout the single tier-selection surface.

4. **Confirm Prisma 6.19 partial-unique-index handling in migrations.**
   - Known: partial unique indexes aren't expressible in `schema.prisma`; the standard workaround is raw SQL appended to the generated migration.
   - Recommendation: verify in `node_modules/prisma` docs that `migrate deploy` runs raw SQL blocks as-is (it does — migrations are just SQL) and that a later `migrate diff` won't flag drift on the hand-added index. HIGH confidence this works; verify to be safe.

---

## Sources

### Primary (HIGH confidence — codebase, read this session)
- `prisma/schema.prisma` — Robot/Subscription/Order/PricingTier enum, existing indexes
- `src/config/pricing.ts`, `src/lib/pricing-tiers.ts` — global pricing SSoT, `mapTier`/`UnknownTierError`/`computeExpirationDate` fail-closed patterns
- `src/lib/subscriptions.ts` — `provisionSubscription`, `GOLDBOT_SLUG` default, existing trial/active guard
- `src/app/api/paygate/create-session/route.ts` + `src/app/api/webhooks/paygate/route.ts` + `src/lib/webhook-signature.ts` — HMAC signing/verify sites and payload string
- `src/app/api/checkout/free-trial/route.ts` — single-robot free-trial route
- `src/app/[locale]/dashboard/admin/robots/{actions.ts,RobotForm.tsx,RobotsTable.tsx,page.tsx}` — admin CRUD + read-only pricing block, ADMIN-guard + revalidatePath pattern
- `src/app/[locale]/checkout/{CheckoutClient.tsx,page.tsx}`, `src/lib/pricing-showcase.ts` — checkout UX, curated public tiers, GoldBot hardcoding
- `prisma/migrations/20260705_add_source_version/migration.sql`, `prisma/migrations/migration_lock.toml`, `scripts/seed-goldbot.js` — incremental migration + seed style
- `.planning/phases/03-multi-robot-schema-foundation/3-RESEARCH.md` — Vercel build-step migration channel (reset was one-time Phase 3; incremental is normal now)
- `AGENTS.md` — Next 16 divergence rule (read `node_modules/next/dist/docs/`)

### Secondary (MEDIUM confidence — reasoned)
- Robot-swap replay analysis (Pitfall 1) — derived from the signature payload string; not an externally reported CVE. Mitigation is low-cost and consistent with existing discipline.

### Tertiary (LOW confidence — verify)
- Prisma 6.19 exact `migrate diff` behavior for hand-added partial indexes — verify in installed docs (Open Q 4).

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything installed; no new deps; patterns already in repo.
- Architecture (RobotPrice model, partial index, robotSlug threading): HIGH — grounded in read code + established Prisma workarounds.
- Security (robotSlug in HMAC): MEDIUM — attack reasoned, not externally verified; mitigation is safe and recommended.
- Migration channel: HIGH — documented + proven twice; incremental now that `0_init` history exists.
- Next 16 specifics: MEDIUM — mitigated by `AGENTS.md` rule to read local docs + copy existing files.

**Research date:** 2026-07-06
**Valid until:** ~2026-08-05 (codebase-derived; stable unless schema/checkout refactored)
