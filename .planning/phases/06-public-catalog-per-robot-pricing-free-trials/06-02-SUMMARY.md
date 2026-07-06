---
phase: 06-public-catalog-per-robot-pricing-free-trials
plan: 02
status: complete
requirements: [CTLG-02, CTLG-03, PRIC-03]
subsystem: public-catalog
files_changed:
  - src/lib/catalog-tiers.ts
  - "src/app/[locale]/catalog/page.tsx"
commits:
  - 11d96bb feat(06-02): add curated catalog-tier helper (CATALOG_PUBLIC_TIERS, formatUsd)
  - 676053e feat(06-02): add public catalog RSC page (no auth, per-robot RobotPrice)
key_decisions:
  - "Public page has NO auth gate — no getServerSession/redirect, unlike every admin page in this repo."
  - "Prices are sourced exclusively from RobotPrice (06-01), never the global PRICING_TIERS map — the catalog page never imports src/config/pricing."
  - "CATALOG_PUBLIC_TIERS curates visibility (FREE_TRIAL/TEN_DAYS/ONE_MONTH/SIX_MONTHS/ONE_YEAR only) so LIFETIME/LIFETIME_SOURCE/SECRET_TEST_TIER never leak onto a public card even if a RobotPrice row exists for them."
  - "No 'catalog' key exists in src/lib/seo.ts's PublicPageKey (would require touching PAGE_COPY for all 7 locales) — used a static generateMetadata fallback instead of extending the SEO registry, to keep this plan file-scoped."
  - "CTA default tier = cheapest available paid tier from the curated set, falling back to free-trial if that's all a robot has."
provides:
  - "Checkout URL contract: /checkout?robot=<slug>&tier=<tierId> — the CTA always includes robot=<slug>; Plan 06-03 must read this query param."
---

# Phase 6 Plan 02: Public Catalog Page Summary

**Shipped the public, no-login catalog page: a Server Component listing every active robot with per-robot prices sourced from `RobotPrice` (06-01), curated to hide contact-only tiers, with a CTA carrying the robot's slug into checkout.**

## Performance
- **Tasks:** 3 completed inline (this session's background-agent attempt died before doing any work due to a host process restart — resumed by implementing directly rather than re-spawning)
- **Files changed:** 2

## Accomplishments
- `catalog-tiers.ts` — `CATALOG_PUBLIC_TIERS` (5 curated tiers), `TIER_ENUM_TO_SLUG` (exhaustive `Record<PricingTier, string>` — fail-closed exhaustiveness discipline matching `TIER_METADATA`), `formatUsd`.
- `catalog/page.tsx` — public async RSC, `prisma.robot.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, include: { prices: { where: { active: true } } } })`, renders a card grid (artwork/placeholder, name, description, curated price list, CTA), empty-state handled.

## Live Verification Against Production
```
curl -sL https://www.al-ai-fx.xyz/en/catalog → HTTP 200
Contains: "GoldBot", "$199", "$999", "robot=goldbot"
Absent: "$79,999" (lifetime-source), "$10" (secret-test) — hidden tiers correctly filtered
```
No auth redirect occurred — confirms the page is genuinely public.

## Deviations from Plan
None material — the SEO-key fallback (documented in `key_decisions`) was already anticipated by the plan's own guidance ("if catalog isn't a known key, fall back to static metadata").

## Issues Encountered
- The originally-spawned background executor agent for this plan was killed by a host process restart before doing any work (confirmed via `git log` — zero 06-02 commits existed on resume). No partial state to reconcile; implemented the plan directly in the main session instead of re-spawning, to reduce coordination overhead.

## User Setup Required
None.

## Next Phase Readiness
Plan 06-03 (payment funnel) consumes the `/checkout?robot=<slug>&tier=<tierId>` URL contract this plan establishes. Plans 06-03/06-04 are file-disjoint from this plan.

## Self-Check: PASSED
- Files verified present: both listed above.
- Commits verified: 11d96bb, 676053e in `git log`.
- Live verification: HTTP 200, GoldBot + correct per-robot prices present, hidden tiers absent, `robot=goldbot` CTA confirmed.

---
*Phase: 06-public-catalog-per-robot-pricing-free-trials*
*Completed: 2026-07-06*
