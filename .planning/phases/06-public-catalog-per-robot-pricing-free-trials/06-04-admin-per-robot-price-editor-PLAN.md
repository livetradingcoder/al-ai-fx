---
phase: 06-public-catalog-per-robot-pricing-free-trials
plan: 04
type: execute
wave: 2
depends_on: [06-01]
files_modified:
  - src/app/[locale]/dashboard/admin/robots/actions.ts
  - src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx
  - src/app/[locale]/dashboard/admin/robots/RobotForm.tsx
autonomous: true

must_haves:
  truths:
    - "An ADMIN can edit a robot's per-tier prices from the dashboard and save them — no deploy required (PRIC-04)"
    - "updateRobotPrices is an ADMIN-gated server action that upserts RobotPrice rows on the (robotId, tier) composite and revalidates BOTH /dashboard/admin/robots AND /catalog so the public catalog reflects the change immediately"
    - "The edit view shows the robot's ACTUAL per-robot RobotPrice rows (editable inputs), NOT the global read-only PRICING_TIERS block — the Phase-5 'per-robot pricing arrives in Phase 6' note is gone"
    - "A robot with no RobotPrice rows yet shows empty/zero-defaulted editable inputs for the editable tier set, so the admin can set them from scratch"
    - "Price inputs are validated server-side (non-negative finite numbers) and the composite upsert never trusts a client that omits robotId/tier"
  artifacts:
    - path: "src/app/[locale]/dashboard/admin/robots/actions.ts"
      provides: "updateRobotPrices ADMIN-gated server action (upsert + dual revalidate)"
      contains: "updateRobotPrices"
    - path: "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx"
      provides: "editable per-robot price inputs replacing the read-only PRICING_TIERS block"
      contains: "updateRobotPrices"
  key_links:
    - from: "src/app/[locale]/dashboard/admin/robots/actions.ts"
      to: "prisma.robotPrice"
      via: "upsert on robotId_tier composite"
      pattern: "robotPrice\\.upsert"
    - from: "src/app/[locale]/dashboard/admin/robots/actions.ts"
      to: "/catalog"
      via: "revalidatePath so public prices refresh"
      pattern: "revalidatePath\\(\"/catalog\"\\)"
    - from: "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx"
      to: "src/app/[locale]/dashboard/admin/robots/actions.ts updateRobotPrices"
      via: "price-form submit"
      pattern: "updateRobotPrices"
---

<objective>
Give admins real, deploy-free control of per-robot prices: an ADMIN-gated `updateRobotPrices` server action that upserts `RobotPrice` rows and revalidates both the admin page and the public catalog, plus editable price inputs in `RobotForm` that replace the Phase-5 read-only global-pricing placeholder.

Purpose: Satisfies phase success criterion 6 (admin can change a robot's tier prices from the dashboard without a deploy) and completes the write half of criterion 3. Depends on 06-01's `RobotPrice` table + composite key.

This plan is file-disjoint from 06-02 (catalog) and 06-03 (payment funnel) and depends only on 06-01, so it runs in parallel with them in Wave 2. It edits `actions.ts` (appends a new action; leaves 05-01/05-02 actions untouched) and `RobotForm.tsx` (replaces ONLY the read-only pricing block at lines ~163-178) plus a small entry point in `RobotsTable.tsx`.

Output:
- `robots/actions.ts` — appends `updateRobotPrices`
- `robots/RobotForm.tsx` — editable per-robot price inputs (replacing the read-only block)
- `robots/RobotsTable.tsx` — passes the robot's existing prices into the edit form
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/06-public-catalog-per-robot-pricing-free-trials/6-RESEARCH.md
@.planning/phases/06-public-catalog-per-robot-pricing-free-trials/06-01-SUMMARY.md
@src/app/[locale]/dashboard/admin/robots/actions.ts
@src/app/[locale]/dashboard/admin/robots/RobotForm.tsx
@src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx
@src/app/[locale]/dashboard/admin/robots/page.tsx
@src/lib/pricing-tiers.ts
@src/lib/catalog-tiers.ts
@prisma/schema.prisma
@AGENTS.md
</context>

<critical_environment_notes>
- **Node:** prepend `export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"` for every node/npx/tsc/eslint call.
- **Reuse the composite key from 06-01:** upsert on `where: { robotId_tier: { robotId, tier } }`. `tier` is the `PricingTier` enum — validate incoming tier strings against `TIER_METADATA` (or `PricingTier` enum values) before upserting; never write an arbitrary string.
- **Editable tier set:** admins may set prices for ALL 8 tiers (including hidden ones — a robot could have a lifetime price the catalog won't show). Drive the editable list from `TIER_METADATA` keys (the full tier catalog), NOT `CATALOG_PUBLIC_TIERS` (that's only public visibility, used by 06-02). Keep them decoupled.
- **Dual revalidate is REQUIRED:** after upsert, `revalidatePath("/dashboard/admin/robots")` AND `revalidatePath("/catalog")` — otherwise the public catalog (06-02) serves stale prices. This is the "without a deploy" guarantee (PRIC-04).
- **ADMIN gate inside the action:** `"use server"` actions are POST-reachable — start `updateRobotPrices` with the exact `session?.user?.role !== "ADMIN"` throw used by every action in this file.
- **Server-side price validation:** coerce each amount with `Number(...)`, reject non-finite or negative (`amount < 0`) → throw a friendly error. FREE_TRIAL should be 0 (assert or allow 0). Never trust the client to send a valid number.
- **Do NOT modify the Phase-5 actions** (`toggleRobotActive`, `updateRobot`, `createRobot`, `uploadRobotSource`) — append only.
- **Do NOT touch** `catalog/page.tsx` (06-02), the payment routes, or `subscriptions.ts` (06-03) — file-disjoint.
- **The read-only pricing block lives at RobotForm.tsx lines ~163-178** (`<h3>Pricing (read-only)</h3>` … "Per-robot pricing arrives in the catalog phase (Phase 6)."). Replace exactly that block; keep the surrounding form/create-mode logic intact. The `import { PRICING_TIERS } from "@/config/pricing"` becomes unused after replacement — remove it to keep eslint clean.
- **Next 16:** server-action + client-form conventions per AGENTS.md diverge from training — read `node_modules/next/dist/docs/` if unsure; `actions.ts`/`RobotForm.tsx` are the templates.
</critical_environment_notes>

<tasks>

<task type="auto">
  <name>Task 1: updateRobotPrices server action (ADMIN-gated, composite upsert, dual revalidate)</name>
  <files>src/app/[locale]/dashboard/admin/robots/actions.ts</files>
  <action>
Append `updateRobotPrices` to `robots/actions.ts` (do NOT alter existing exports). Accept the robot id + a map/array of `{ tier, amount }` and upsert each. Validate tier + amount server-side.
```ts
import { TIER_METADATA } from "@/lib/pricing-tiers";
import { PricingTier } from "@prisma/client";

// Accepts a list of per-tier prices for one robot and upserts each RobotPrice row.
export async function updateRobotPrices(
  robotId: string,
  prices: { tier: string; amount: number; active?: boolean }[],
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  if (!robotId) throw new Error("robotId is required");

  // Confirm the robot exists (fail-closed) — never create price rows for a ghost robot.
  await prisma.robot.findUniqueOrThrow({ where: { id: robotId } });

  for (const row of prices) {
    // Validate tier against the enum via TIER_METADATA (the tier SSoT).
    const meta = TIER_METADATA[row.tier as keyof typeof TIER_METADATA];
    if (!meta) throw new Error(`Unknown tier: ${row.tier}`);
    const tier: PricingTier = meta.enum;

    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Invalid amount for ${row.tier}`);
    }
    const active = row.active ?? true;

    await prisma.robotPrice.upsert({
      where: { robotId_tier: { robotId, tier } },
      update: { amount, active },
      create: { robotId, tier, amount, active },
    });
  }

  // Deploy-free price change (PRIC-04): refresh admin AND public catalog.
  revalidatePath("/dashboard/admin/robots");
  revalidatePath("/catalog");
  return { success: true, count: prices.length };
}
```
Note: unlike the seed's `update: {}`, the admin action MUST write `update: { amount, active }` (the whole point is to overwrite).
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
A="src/app/[locale]/dashboard/admin/robots/actions.ts"
grep -q 'export async function updateRobotPrices' "$A" && echo ACTION_OK
grep -q 'robotPrice.upsert' "$A" && echo UPSERT_OK
grep -q 'robotId_tier' "$A" && echo COMPOSITE_OK
grep -q 'revalidatePath("/catalog")' "$A" && echo CATALOG_REVALIDATE_OK
grep -q 'amount < 0' "$A" && echo VALIDATION_OK
# still ADMIN-gated (now 5 gates: toggle, update, create, upload, prices):
test "$(grep -c 'session?.user?.role !== "ADMIN"' "$A")" -ge 5 && echo ALL_GATES_OK
# existing actions untouched:
grep -q 'export async function createRobot' "$A" && grep -q 'export async function uploadRobotSource' "$A" && echo EXISTING_INTACT
npx tsc --noEmit && npx eslint "$A" && echo LINT_OK
```
  </verify>
  <done>`updateRobotPrices` exists, ADMIN-gated, upserts on the `robotId_tier` composite with `update: { amount, active }`, validates tier (via TIER_METADATA) + non-negative finite amount, and revalidates both admin + catalog paths; Phase-5 actions untouched; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 2: Editable per-robot price inputs in RobotForm (replace the read-only block) + table wiring</name>
  <files>src/app/[locale]/dashboard/admin/robots/RobotForm.tsx, src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx</files>
  <action>
**2a. `RobotForm.tsx`** — in EDIT mode only, replace the read-only pricing block (lines ~163-178, the `<h3>Pricing (read-only)</h3>` … Phase-6 note) with editable per-tier price inputs:
- Remove `import { PRICING_TIERS } from "@/config/pricing";` (now unused) and import `import { TIER_METADATA } from "@/lib/pricing-tiers";` and `import { updateRobotPrices } from "./actions";`.
- The form needs the robot's existing prices. Extend the component props to accept `prices?: { tier: string; amount: number; active: boolean }[]` (passed from RobotsTable — see 2b) — or, if `RobotRow` already carries them, read from there. Build local state seeded from those rows: for each tier in `Object.keys(TIER_METADATA)`, initialize an input value from the matching existing RobotPrice `amount` (or `0`/empty if none). Store as `Record<TierId, string>` (string inputs; parse on submit).
- Render a "Per-robot pricing" panel: one number input per tier (label = the tier id, e.g. `1-month`), controlled by the price state. Include the hidden tiers too (admin may price them; catalog just won't show them).
- Add a "Save prices" button (separate from the metadata Save, or fold into the same submit — simplest is a dedicated handler `handleSavePrices` inside a `startTransition` that builds `[{ tier, amount: Number(value) }, ...]` and calls `await updateRobotPrices(robot!.id, rows)`, then `alert("Prices saved")` / `onClose()` on success, `alert(getErrorMessage(...))` on failure — mirror the existing `handleSubmit` error pattern).
- Keep create-mode and all metadata fields exactly as they are. The price editor is edit-mode only (a robot must exist to have RobotPrice rows).

**2b. `RobotsTable.tsx`** — ensure the edit form receives the robot's prices:
- The admin page (`page.tsx`) currently does `prisma.robot.findMany({ orderBy: { sortOrder } })` with no prices. Since `page.tsx` is NOT in this plan's files, pass prices WITHOUT editing page.tsx: options — (a) have `RobotForm` fetch prices via a small server action `getRobotPrices(robotId)` you add in Task 1's file, called on mount; OR (b) accept editing the `RobotForm`/`RobotsTable` prop plumbing only. PREFER (a): add a tiny `getRobotPrices(robotId)` ADMIN-gated read action in `actions.ts` (during Task 1 or here) and have `RobotForm` load prices in a `useEffect` when it opens in edit mode. This keeps `page.tsx` (and its query) untouched and avoids a cross-plan file conflict.
  - If you choose (a): add to `actions.ts` a `getRobotPrices(robotId)` returning `prisma.robotPrice.findMany({ where: { robotId } })` (ADMIN-gated). `RobotForm` calls it on open and seeds the price state; show a small "Loading prices…" state.
- Keep the existing table controls (toggle, edit, add, upload) intact. No visual regression to the metadata edit flow.

Document in the SUMMARY which plumbing option was taken and why.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
F="src/app/[locale]/dashboard/admin/robots/RobotForm.tsx"
grep -q 'updateRobotPrices' "$F" && echo SAVE_WIRED_OK
grep -q 'TIER_METADATA' "$F" && echo TIER_LIST_OK
# read-only placeholder + its note are GONE:
! grep -q 'Pricing (read-only)' "$F" && echo READONLY_GONE_OK
! grep -q 'Per-robot pricing arrives' "$F" && echo NOTE_GONE_OK
! grep -q 'from "@/config/pricing"' "$F" && echo GLOBAL_IMPORT_REMOVED_OK
# a number input for prices exists:
grep -q 'type="number"' "$F" && echo PRICE_INPUT_OK
npx tsc --noEmit && npx eslint "$F" "src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx" && echo LINT_OK
```
  </verify>
  <done>Edit view renders editable per-tier price inputs seeded from the robot's RobotPrice rows and saves via `updateRobotPrices`; the read-only global-pricing block + Phase-6 note are removed; prices load without editing `page.tsx`; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 3: Live verification — admin edits a price, catalog reflects it</name>
  <files>.planning/phases/06-public-catalog-per-robot-pricing-free-trials/06-04-SUMMARY.md</files>
  <action>
Verify deploy-free price editing against LIVE production (no local DB — established Phase 5 pattern; UI verification via curl + a real ADMIN NextAuth session cookie).

1. Deploy Wave 2 (coordinate a single `vercel --prod --yes` with 06-02/06-03 if landing together; else deploy this).
2. Obtain an ADMIN session cookie (reuse the approach documented in `05-01-SUMMARY.md` — a verification admin account via the build-step channel if none persists, or an existing admin login). Server Actions embed a build-specific action id in the client bundle, so a pure hand-crafted `curl` POST to the action may be impractical (05-01 noted this) — in that case, verify the DATA path instead: after saving a price via the browser-with-session OR by invoking `updateRobotPrices` through a temporary build-step script, confirm the effect.
3. Concrete acceptance (pick the achievable one and document it):
   - Change GoldBot's `1-month` price to a distinctive value (e.g. `$222`) via the admin edit form (authenticated session) OR via a temporary build-step invocation of `updateRobotPrices('<goldbotId>', [{tier:'1-month', amount:222}])`.
   - `curl -s https://<prod>/en/catalog | grep -o '\$222'` → confirms the public catalog reflects the new price WITHOUT a redeploy (the `revalidatePath("/catalog")` worked). This is the PRIC-04 proof.
   - `curl -sS -X POST https://<prod>/api/paygate/create-session -H 'Content-Type: application/json' -d '{"tier":"1-month","email":"verify-0604@al-ai-fx.xyz","currency":"USD","robotSlug":"goldbot"}' | grep '"amount":"222.00"'` → confirms the server-side price authority (resolveRobotPrice) now returns the edited amount (ties the admin edit to real enforcement).
   - Restore the original price (`$199`) afterward so the catalog isn't left altered.
4. Capture the before/after curl evidence + the method used (browser session vs build-step) into the SUMMARY.
  </action>
  <verify>
- After an admin price edit, `/en/catalog` shows the new price without a redeploy.
- create-session returns the edited amount as the server-authoritative price.
- Original price restored.
  </verify>
  <done>An admin price change propagates to the public catalog and to server-side checkout pricing without a deploy — evidenced by captured curl before/after showing the changed then restored price.</done>
</task>

</tasks>

<verification>
- `updateRobotPrices` is ADMIN-gated, upserts on `robotId_tier`, validates tier + non-negative amount, revalidates admin + catalog.
- Edit view has editable per-tier price inputs seeded from RobotPrice; read-only global block + Phase-6 note removed; `@/config/pricing` import gone.
- Prices load without editing `page.tsx` (via a read action or prop plumbing — documented).
- `npx tsc --noEmit` + `npx eslint` clean; live curl proves a price edit reaches the public catalog + server-side pricing without a redeploy.
</verification>

<success_criteria>
- PRIC-04: admin changes a robot's tier prices from the dashboard without a deploy; the public catalog + checkout reflect it.
- PRIC-03 (write half): per-robot prices are admin-editable and enforceable.
</success_criteria>

<output>
After completion, create `.planning/phases/06-public-catalog-per-robot-pricing-free-trials/06-04-SUMMARY.md` with frontmatter: `phase`, `plan`, `status: complete`, `requirements: [PRIC-03, PRIC-04]`, `files_changed`, `commits`, `key_decisions` (updateRobotPrices upserts on robotId_tier with update:{amount,active}; dual revalidate admin + /catalog for deploy-free change; editable tier set driven by TIER_METADATA not CATALOG_PUBLIC_TIERS; price-load plumbing choice; server-side amount validation non-negative) and `provides` — note that admin price edits are now the write side of the same RobotPrice rows resolveRobotPrice (06-03) and the catalog (06-02) read.
</output>
