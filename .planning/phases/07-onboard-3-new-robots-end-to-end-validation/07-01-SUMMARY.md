---
phase: 07-onboard-3-new-robots-end-to-end-validation
plan: 01
status: complete
requirements: [ONBD-01, ONBD-02, ONBD-03]
subsystem: catalog-content
files_changed:
  - scripts/upload-robot-source.js
  - scripts/onboard-robots-07.js
  - package.json (temp, reverted)
commits:
  - c538ad0 chore: temp route to list current Robot rows for Phase 7 kickoff
  - c8347d7 chore(07): temp-run robot onboarding script in build step
  - 558ee8d chore(07): revert build step after robot onboarding, remove temp list-robots route
  - 7b415ff chore(07): temp route to drive+poll a real compile job for onboarding smoke test
  - a186c11 chore(07): remove temp compile-verification route after onboarding smoke test
key_decisions:
  - "Source of the 3 new robots: real .mq5 files the user pointed to at /Users/klev/Code/visionfx-ea (a separate local repo), NOT fabricated/cloned GoldBot variants — resolves the Phase 7 blocker flagged at the end of Phase 6 (no real distinct robot source existed anywhere in al-ai-fx)."
  - "Picked 3 genuinely distinct strategies out of ~40 candidate .mq5 files in that repo (many were iterative near-duplicates of the same family, e.g. 10+ GG-EA-Bot-bs-ss-* revisions, 8 GoldEA-Vision-New-May-2026-* revisions, several GoldBot-* files that are literally the existing product's lineage): VisionFX EA (hedged range-breakout with a multi-region holiday calendar — the repo's own flagship, matches the directory name), Precision Range Trader (a different, simpler time-window range-breakout — MT4ORDERS-based, self-contained), and Sniper Lite EA (a completely different paradigm: RSI-pullback + 8-filter indicator confluence with 3-stage partial-profit scaling). Rejected Sniper Terminal (near-duplicate indicator set of Sniper Lite, same author) and all Gold-themed families (GoldEA-Vision-*, GG-EA-Bot-*, GoldBot-*, VietnameziGold) to avoid confusing overlap with the existing live GoldBot product."
  - "Precision Range Trader's source file was UTF-16LE on disk (Windows-authored) — converted to UTF-8 via iconv before encryption/upload; the other two were already ASCII/UTF-8. All 3 have only standard-library MQL5 #includes (Trade\\Trade.mqh, Trade\\PositionInfo.mqh, Generic\\HashMap.mqh, WinAPI\\winapi.mqh) — no custom includes beyond what the VM's MetaEditor already has (confirmed by real compiles succeeding, not just by inspection)."
  - "Uploaded encrypted v1 sources to Blob directly from the local machine (scripts/upload-robot-source.js, generalized from upload-goldbot-source.js) WITHOUT a deploy — BLOB_READ_WRITE_TOKEN and SOURCE_ENCRYPTION_KEY are both non-Sensitive and already in .env.local, unlike DATABASE_URL. Only the Robot/RobotPrice DB rows needed the build-step channel."
  - "Default per-robot prices (scripts/onboard-robots-07.js) are placeholders lower than GoldBot's (e.g. 1-month $149 vs GoldBot's $199) — explicitly NOT final; user said 'build fundamentals first then I'll revise this later,' so these exist only so the catalog/checkout have valid non-zero prices to exercise, and are trivially editable live via the 06-04 admin price editor with zero further deploys needed."
  - "All 3 robots created with active:true (visible on /catalog immediately) — the user's instruction was to get fundamentals working now, not stage them inactive pending review."
provides:
  - "3 real, live, distinct robots in the catalog: visionfx, precision-range, sniper-lite — each with a genuine uploaded v1 source, default prices across all 8 tiers, and a real successful COMPLETED compile proven this plan (not just a DB/Blob write)."
  - "scripts/upload-robot-source.js — reusable generalized version of upload-goldbot-source.js, takes (slug, path) instead of being GoldBot-specific. Future robot onboarding (or a source re-upload) can reuse it directly."
  - "Established Phase 7 verification pattern: a temporary admin-gated route that both DRIVES (creates a SECRET_TEST_TIER subscription + PENDING Compilation) and POLLS (returns the Compilation row) a real compile job without needing a redeploy per check — cheaper than the Phase 4 pattern of a build-step create + separate build-step check for each poll."
---

# Phase 7 Plan 01: Onboard 3 New Robots (Real Source) Summary

**Sourced real, distinct MQL5 source for 3 new robots from a separate local repo the user pointed to (`/Users/klev/Code/visionfx-ea`), onboarded them into the live catalog with encrypted source + default pricing, and proved the compile pipeline actually works for each by driving and completing a real compile job per robot — not just writing DB rows.**

## Context
Phase 6 closed with Phase 7 explicitly blocked: no real MQL5 source existed anywhere in the al-ai-fx project for robots #2/#3/#4, and fabricating clone/relabeled GoldBot variants to sell as distinct products was flagged as a business decision requiring the user's sign-off rather than an autonomous implementation call. The user resolved this by pointing at a separate local repo (`visionfx-ea`) containing ~40 real `.mq5` files and said to "find 3 distinct robots here, just build fundamentals first, [they'll] revise this later."

## Accomplishments
- Surveyed `/Users/klev/Code/visionfx-ea` (~40 `.mq5` files) and identified 3 genuinely distinct trading strategies, avoiding near-duplicate iterations within the same family and avoiding anything Gold-themed (to not confuse/overlap with the existing live GoldBot product):
  - **VisionFX EA** (`VisionFX_EA_Holiday_EU_UK_DE_FR_IT_v2.mq5`) — hedged range-breakout with an EU/UK/US/DE/FR/IT holiday calendar. The repo's own flagship (matches the directory name), cleanly `#property description`d.
  - **Precision Range Trader** (`Precision Range Trader_v6.mq5`) — a different, MT4ORDERS-based time-window range-breakout EA. Source was UTF-16LE on disk; converted to UTF-8 before upload.
  - **Sniper Lite EA** (`Sniper_Lite_EA_v5_5.mq5`) — a completely different paradigm: RSI-pullback core signal with 8 confluence filters and 3-stage partial-profit scaling.
- Wrote `scripts/upload-robot-source.js` (generalized `upload-goldbot-source.js`) and ran it locally (no deploy needed — Blob + encryption keys are non-Sensitive) to encrypt and upload all 3 as `sources/<slug>/v1.mq5.enc`.
- Wrote `scripts/onboard-robots-07.js` (idempotent upsert, mirrors `seed-goldbot.js` + `seed-robot-prices.js` patterns) creating the 3 `Robot` rows (active, sortOrder 1/2/3 after GoldBot's 0) and seeding default `RobotPrice` rows across all 8 tiers. Ran via the established build-step channel (temp `package.json` build script edit → `vercel --prod --yes` → confirmed in build log → reverted in a separate commit).
- Drove and confirmed a **real compile job per robot** via a temporary admin-gated verification route (create + poll, no redeploy needed between checks) — all 3 reached genuine `COMPLETED` with real `.ex5` artifacts:
  - `visionfx`: COMPLETED
  - `precision-range`: COMPLETED
  - `sniper-lite`: COMPLETED, 58076-byte `.ex5`, sha256 `998eb99e...`, `AL-ai-FX_sniper-lite_<jobId>.ex5`

## Live Verification Against Production
1. `curl https://www.al-ai-fx.xyz/catalog` shows all 4 robots: `GoldBot`, `VisionFX EA`, `Precision Range Trader`, `Sniper Lite EA`.
2. Build log confirmed all 3 `Robot` rows + 8 `RobotPrice` rows each created (`onboard-robots-07.js` output captured via `vercel inspect --logs`).
3. Real compile jobs created (SECRET_TEST_TIER subscriptions, throwaway `verify-07-<slug>@al-ai-fx.xyz` test users, random MT5 account numbers) and polled to `COMPLETED` for all 3 — proving the VM daemon successfully fetched each robot's actual uploaded source, compiled it with MetaEditor, and uploaded a robot-scoped artifact to Blob.
4. Both temporary verification routes (`verify-list-robots`, `verify-07-compile`) removed and redeployed; confirmed 404 afterward.

## Deviations from Plan
- No formal `/gsd:plan-phase 7` was run before this work — the user's directive ("find 3 distinct robots, build fundamentals first") was executed directly given the standing "implement non-stop" instruction, with this SUMMARY written after the fact to keep the phase's paper trail consistent with prior phases.
- Did not attempt real MT5-account end-to-end trading validation (that's ONBD-04 / plan 07-04, requires an actual MT5 terminal run per robot) — this plan proves compile-and-deliver, matching the "fundamentals first" instruction; the deeper MT5 validation is explicitly deferred pending the user's revision pass.

## Issues Encountered
None. VM SSH (port 22) was transiently connection-refused earlier in the session (ping succeeded, so the VM was up) but resolved on its own by the time compile verification was needed — daemon and reaper NSSM services were both confirmed `SERVICE_RUNNING`.

## User Setup Required
- **Pricing is placeholder** — all 3 robots seeded with default prices lower than GoldBot's; revise via the live admin price editor (`/dashboard/admin/robots`, no deploy needed) whenever ready.
- **Names/descriptions are a first pass** extracted from each source's own `#property description` / header comments — revise via the admin edit form whenever ready.
- **Artwork not set** (`artworkUrl: null` for all 3) — catalog shows the placeholder box; upload artwork via the admin edit form.
- Leftover test artifacts from this plan's verification (harmless, non-blocking): `verify-07-visionfx@al-ai-fx.xyz` / `verify-07-precision-range@al-ai-fx.xyz` / `verify-07-sniper-lite@al-ai-fx.xyz` test users with a SECRET_TEST_TIER subscription + COMPLETED Compilation each. Not shown in any admin/user UI beyond raw DB inspection; safe to leave or clean up later.

## Next Phase Readiness
Fundamentals proven for all 3 robots (catalog visibility, per-robot pricing, real encrypted source, real successful compile). Remaining Phase 7 scope: 07-04's real MT5-account end-to-end validation (purchase → compile → deliver → actual MetaTrader run) — deferred per the user's "revise later" framing; content (pricing/copy/artwork) revisions expected before that validation is meaningful.

## Self-Check: PASSED
- Files verified present: `scripts/upload-robot-source.js`, `scripts/onboard-robots-07.js` (both committed, non-temp).
- Commits verified: all 5 in `git log`; build script confirmed reverted to `"prisma generate && next build"`.
- Live verification: catalog shows all 4 robots; 3/3 real compile jobs reached COMPLETED with real artifacts; both temp routes confirmed 404 after cleanup.

---
*Phase: 07-onboard-3-new-robots-end-to-end-validation*
*Completed: 2026-07-06*
