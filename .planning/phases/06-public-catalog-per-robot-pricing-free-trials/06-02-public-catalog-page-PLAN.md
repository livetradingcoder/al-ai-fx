---
phase: 06-public-catalog-per-robot-pricing-free-trials
plan: 02
type: execute
wave: 2
depends_on: [06-01]
files_modified:
  - src/app/[locale]/catalog/page.tsx
  - src/lib/catalog-tiers.ts
autonomous: true

must_haves:
  truths:
    - "A visitor (NOT logged in) can open /catalog and see a card for EVERY active robot — artwork, name, shortDescription, and a CTA — sourced live from the DB (prisma.robot.findMany where active order by sortOrder)"
    - "Each robot card shows only the CURATED public tiers with that robot's own per-robot prices from RobotPrice (never the global PRICING_TIERS), formatted from amount via toLocaleString"
    - "Hidden/contact-only tiers (lifetime-source, secret-test, lifetime) never render on a public catalog card even if a RobotPrice row exists for them"
    - "Each card's CTA links to /checkout?robot=<slug>&tier=<tierId> so the checkout funnel receives the robot identity"
    - "Inactive robots do NOT appear on the public catalog"
  artifacts:
    - path: "src/app/[locale]/catalog/page.tsx"
      provides: "public RSC catalog listing active robots with per-robot prices"
      contains: "prisma.robot.findMany"
      min_lines: 40
    - path: "src/lib/catalog-tiers.ts"
      provides: "CATALOG_PUBLIC_TIERS curated visible-tier set + price formatter"
      contains: "CATALOG_PUBLIC_TIERS"
  key_links:
    - from: "src/app/[locale]/catalog/page.tsx"
      to: "prisma.robot"
      via: "findMany active + include active prices"
      pattern: "prisma\\.robot\\.findMany"
    - from: "src/app/[locale]/catalog/page.tsx"
      to: "/checkout"
      via: "CTA link with robot slug + tier"
      pattern: "checkout\\?robot="
    - from: "src/app/[locale]/catalog/page.tsx"
      to: "src/lib/catalog-tiers.ts CATALOG_PUBLIC_TIERS"
      via: "curated tier filter"
      pattern: "CATALOG_PUBLIC_TIERS"
---

<objective>
Ship the public, no-login catalog: a Server Component under `[locale]/catalog` that lists every active robot with its artwork, copy, per-robot prices (from `RobotPrice`, not the global map), and a CTA that carries the robot slug into checkout. Curate which tiers are publicly visible so hidden/contact-only tiers never leak.

Purpose: Satisfies phase success criterion 1 (public catalog lists every active robot; visitors browse without logging in) and the display half of criterion 3 (per-robot prices shown correctly). Uses the `RobotPrice` table + composite lookup from 06-01.

This plan is file-disjoint from 06-03 (payment funnel) and 06-04 (admin price editor) and depends only on 06-01, so it runs in parallel with them in Wave 2.

Output:
- `src/lib/catalog-tiers.ts` — `CATALOG_PUBLIC_TIERS` (curated visible tiers) + a small price formatter
- `src/app/[locale]/catalog/page.tsx` — public RSC catalog page
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
@prisma/schema.prisma
@src/lib/pricing-tiers.ts
@src/lib/pricing-showcase.ts
@src/app/[locale]/checkout/page.tsx
@src/app/[locale]/dashboard/admin/robots/page.tsx
@src/lib/prisma.ts
@AGENTS.md
</context>

<critical_environment_notes>
- **Node:** prepend `export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"` for every node/npx/tsc/eslint call.
- **Next 16 App Router (Pitfall 5):** per AGENTS.md this Next.js diverges from training data — `params` is a `Promise`, RSC conventions differ. READ `node_modules/next/dist/docs/` before writing page code, and COPY the shape of existing pages: `src/app/[locale]/checkout/page.tsx` (async `generateMetadata` with `params: Promise<{locale}>`) and `src/app/[locale]/dashboard/admin/robots/page.tsx` (async RSC, prisma query, no client component needed).
- **This is a PUBLIC page — NO auth gate.** Unlike the admin robots page, catalog must NOT `redirect` unauthenticated users. Do not call `getServerSession`/`redirect`.
- **Curated tiers (Pitfall 4):** `RobotPrice` may hold rows for hidden tiers (`lifetime-source`, `secret-test`, and per the showcase, `lifetime` is contact-only). The public card must render ONLY the curated set that `pricing-showcase.ts` surfaces publicly: `free-trial`, `10-days`, `1-month`, `6-months`, `1-year`. Drive visibility from `CATALOG_PUBLIC_TIERS`, never by dumping every RobotPrice row.
- **Prices come from `RobotPrice`, never `PRICING_TIERS`.** Format from `amount` (Float) via `amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })`. Do NOT store/read a priceString.
- **Query pattern:** `prisma.robot.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, include: { prices: { where: { active: true } } } })` — the `@@index([active, sortOrder])` on Robot already covers this.
</critical_environment_notes>

<tasks>

<task type="auto">
  <name>Task 1: Curated catalog-tier helper</name>
  <files>src/lib/catalog-tiers.ts</files>
  <action>
Create `src/lib/catalog-tiers.ts` — the single source of "which tiers are publicly listable" plus a price formatter, so the catalog page and any future consumer agree.
```ts
import { PricingTier } from "@prisma/client";

// Publicly listable tiers, in display order. Mirrors the curated set
// pricing-showcase.ts surfaces on the public site (free trial + the 4 paid
// windows). Hidden/contact-only tiers (LIFETIME, LIFETIME_SOURCE, SECRET_TEST_TIER)
// are intentionally EXCLUDED so a RobotPrice row for them never leaks onto a card.
export const CATALOG_PUBLIC_TIERS: PricingTier[] = [
  PricingTier.FREE_TRIAL,
  PricingTier.TEN_DAYS,
  PricingTier.ONE_MONTH,
  PricingTier.SIX_MONTHS,
  PricingTier.ONE_YEAR,
];

// Maps a PricingTier enum back to its checkout slug (?tier=<id>) for CTA links.
export const TIER_ENUM_TO_SLUG: Record<PricingTier, string> = {
  FREE_TRIAL: "free-trial",
  TEN_DAYS: "10-days",
  ONE_MONTH: "1-month",
  SIX_MONTHS: "6-months",
  ONE_YEAR: "1-year",
  LIFETIME: "lifetime",
  LIFETIME_SOURCE: "lifetime-source",
  SECRET_TEST_TIER: "secret-test",
};

export function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
```
`TIER_ENUM_TO_SLUG` is typed `Record<PricingTier, string>`, so adding a PricingTier enum value forces this map to grow (TS error otherwise) — same fail-closed exhaustiveness discipline as `TIER_METADATA`.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q 'CATALOG_PUBLIC_TIERS' src/lib/catalog-tiers.ts && echo TIERS_OK
grep -q 'TIER_ENUM_TO_SLUG' src/lib/catalog-tiers.ts && echo SLUGMAP_OK
grep -q 'formatUsd' src/lib/catalog-tiers.ts && echo FMT_OK
# hidden tiers must NOT be in the public list array (they can be in the slug map):
awk '/CATALOG_PUBLIC_TIERS/,/\];/' src/lib/catalog-tiers.ts | grep -qE 'LIFETIME_SOURCE|SECRET_TEST_TIER' && echo LEAK_BAD || echo NO_LEAK_OK
npx tsc --noEmit && npx eslint src/lib/catalog-tiers.ts && echo LINT_OK
```
  </verify>
  <done>`catalog-tiers.ts` exports the curated `CATALOG_PUBLIC_TIERS` (no hidden tiers), an exhaustive `TIER_ENUM_TO_SLUG`, and `formatUsd`; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 2: Public catalog RSC page</name>
  <files>src/app/[locale]/catalog/page.tsx</files>
  <action>
Create `src/app/[locale]/catalog/page.tsx` as a public async Server Component (NO auth gate). COPY the metadata + async-params shape from `src/app/[locale]/checkout/page.tsx` and the prisma-in-RSC shape from `src/app/[locale]/dashboard/admin/robots/page.tsx`.

Behavior:
1. `export async function generateMetadata({ params }: { params: Promise<{ locale: string }> })` — reuse `getPageMetadata("catalog", locale)` if the SEO map supports it; if "catalog" isn't a known key, fall back to a static `{ title, description }` (read `src/lib/seo.ts` to confirm before assuming a key exists).
2. Query active robots with their active prices:
   ```ts
   const robots = await prisma.robot.findMany({
     where: { active: true },
     orderBy: { sortOrder: "asc" },
     include: { prices: { where: { active: true } } },
   });
   ```
3. Render a responsive grid of robot cards (reuse existing site classes like `glass-panel` / `feature-card` seen in checkout + admin — match the app's visual language; do NOT invent a new design system). Each card:
   - artwork: `robot.artworkUrl` in an `<img>` if present, else a neutral placeholder block.
   - `robot.name` (heading) + `robot.shortDescription`.
   - A price row: filter `robot.prices` to those whose `tier` is in `CATALOG_PUBLIC_TIERS`, sort by the `CATALOG_PUBLIC_TIERS` order, and render each as `formatUsd(price.amount)` with a small tier label. If a robot has NO public-tier price rows, show a muted "Pricing coming soon" and still render the card.
   - A CTA `<Link href={\`/checkout?robot=${robot.slug}&tier=${TIER_ENUM_TO_SLUG[cheapestPaidTier]}\`}>` — pick a sensible default tier for the CTA (e.g. the first available paid tier from the curated order, falling back to `free-trial` if only that exists). The link MUST include `robot=<slug>`.
4. Empty state: if `robots.length === 0`, render a friendly "No robots available yet" panel (do not crash).

Use `import Link from "next/link"`, `import { prisma } from "@/lib/prisma"`, and the helpers from `@/lib/catalog-tiers`. Keep it a Server Component — no `"use client"` unless genuinely needed (it is not; links are static).
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
test -f "src/app/[locale]/catalog/page.tsx" && echo PAGE_EXISTS
grep -q 'prisma.robot.findMany' "src/app/[locale]/catalog/page.tsx" && echo QUERY_OK
grep -q 'active: true' "src/app/[locale]/catalog/page.tsx" && echo ACTIVE_FILTER_OK
grep -q 'CATALOG_PUBLIC_TIERS' "src/app/[locale]/catalog/page.tsx" && echo CURATED_OK
grep -q 'checkout?robot=' "src/app/[locale]/catalog/page.tsx" && echo CTA_ROBOT_OK
grep -q 'formatUsd' "src/app/[locale]/catalog/page.tsx" && echo PRICE_FMT_OK
# must NOT auth-gate the public page:
! grep -q 'redirect("/dashboard")' "src/app/[locale]/catalog/page.tsx" && echo NO_AUTH_GATE_OK
# must NOT read the global static pricing map:
! grep -q 'PRICING_TIERS' "src/app/[locale]/catalog/page.tsx" && echo NO_GLOBAL_PRICING_OK
npx tsc --noEmit && npx eslint "src/app/[locale]/catalog/page.tsx" && echo LINT_OK
</verify>
  <done>`/catalog` is a public RSC that lists active robots (ordered) with per-robot curated prices from `RobotPrice`, a CTA carrying `robot=<slug>` into checkout, an empty state, and no auth gate; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 3: Verify the catalog renders live in production</name>
  <files>.planning/phases/06-public-catalog-per-robot-pricing-free-trials/06-02-SUMMARY.md</files>
  <action>
Verify against LIVE production (no local DB — established pattern). The catalog is PUBLIC, so no session cookie is needed for the anonymous-visitor check.

1. Deploy the branch/commit (or confirm it's included in the deploy that 06-03/06-04 also land in — coordinate so a single `vercel --prod --yes` covers Wave 2). If deploying independently: `vercel --prod --yes`.
2. `curl -s https://<prod-domain>/en/catalog` (use the real production domain from `NEXTAUTH_URL` / prior SUMMARYs) and confirm:
   - HTTP 200 (no redirect to /dashboard or /login — proves public access).
   - GoldBot's card is present (its name + shortDescription appear in the HTML).
   - GoldBot's per-robot prices appear (e.g. the seeded `$199` for 1-month, `$999` for 6-months), formatted from RobotPrice — and the hidden `$79,999` (lifetime-source) / `$10` (secret-test) do NOT appear.
   - A checkout CTA href contains `robot=goldbot`.
3. Negative check: confirm an INACTIVE robot (if any exists) is absent from the HTML. If GoldBot is the only robot, note that the active-filter is proven by the query + the absence of any inactive row.
Capture the relevant curl output (grep for the price strings + the `robot=goldbot` href) into the SUMMARY as evidence.
  </action>
  <verify>
- `curl https://<prod>/en/catalog` returns 200 without an auth redirect.
- GoldBot card + its RobotPrice-derived prices present; hidden-tier prices absent.
- A CTA href contains `robot=goldbot`.
  </verify>
  <done>The public catalog renders live: anonymous 200, GoldBot listed with its per-robot curated prices and a `robot=goldbot` checkout CTA, hidden tiers absent — evidenced by captured curl output.</done>
</task>

</tasks>

<verification>
- `/catalog` is a public Server Component (no auth gate) listing active robots ordered by sortOrder.
- Prices come from `RobotPrice` (curated via `CATALOG_PUBLIC_TIERS`), formatted from `amount`; hidden tiers never render.
- CTA links carry `robot=<slug>&tier=<tierId>` into checkout.
- Empty state handled; inactive robots excluded.
- `npx tsc --noEmit` + `npx eslint` clean; live curl confirms anonymous render with GoldBot's per-robot prices.
</verification>

<success_criteria>
- CTLG-02: public catalog lists every active robot with artwork, description, CTA — browsable without login.
- CTLG-03 (display half): CTA threads `robotSlug` toward checkout.
- PRIC-03 (display half): per-robot prices shown correctly from RobotPrice.
</success_criteria>

<output>
After completion, create `.planning/phases/06-public-catalog-per-robot-pricing-free-trials/06-02-SUMMARY.md` with frontmatter: `phase`, `plan`, `status: complete`, `requirements: [CTLG-02, CTLG-03, PRIC-03]`, `files_changed`, `commits`, `key_decisions` (public page has NO auth gate; prices sourced from RobotPrice never PRICING_TIERS; CATALOG_PUBLIC_TIERS curates visibility so hidden tiers never leak; CTA carries robot slug + a default tier into /checkout) and `provides` — note the checkout URL contract `/checkout?robot=<slug>&tier=<tierId>` that 06-03 consumes.
</output>
