/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 7: onboard 3 new robots (real MQL5 source, provided by user from visionfx-ea repo).
// Idempotent upsert — safe to re-run. Sources already uploaded to Blob via
// scripts/upload-robot-source.js (sources/<slug>/v1.mq5.enc, sourceVersion=1).
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROBOTS = [
  {
    slug: 'visionfx',
    name: 'VisionFX EA',
    shortDescription: 'Professional range-breakout EA with hedges and a multi-region holiday calendar.',
    longDescription:
      'VisionFX EA trades range breakouts with built-in hedging and an extensive holiday calendar covering EU, UK, US, DE, FR, and IT sessions — so it sits out when major markets are closed instead of trading into thin liquidity. Delivered as a compiled, MT5-account-locked build.',
    sortOrder: 1,
  },
  {
    slug: 'precision-range',
    name: 'Precision Range Trader',
    shortDescription: 'Time-window range-breakout EA — define a session range, trade the breakout.',
    longDescription:
      'Precision Range Trader marks out a configurable time window each session, then trades breakouts from that range with independently tuned take-profit and stop-loss settings. A more classical session-range approach than VisionFX\'s hedged holiday-aware model. Delivered as a compiled, MT5-account-locked build.',
    sortOrder: 2,
  },
  {
    slug: 'sniper-lite',
    name: 'Sniper Lite EA',
    shortDescription: 'Multi-indicator confluence swing EA — RSI pullback core with 8 confluence filters and 3-stage partial profit scaling.',
    longDescription:
      'Sniper Lite EA looks for RSI pullback-recovery setups, then confirms with up to 8 confluence filters (EMA200 trend, Supertrend, MACD histogram, ADX, Bollinger Band expansion, higher-timeframe RSI, volume spike). Exits scale out in three stages (33%/33%/34% at 1.5R/3R/5R) with an equity stop and post-loss cooldown. A fundamentally different, indicator-driven approach vs. the range-breakout robots above. Delivered as a compiled, MT5-account-locked build.',
    sortOrder: 3,
  },
];

// Mirrors seed-robot-prices.js defaults (goldbot's tier structure) — placeholder
// starting prices; admin can revise any of these live via the 06-04 price editor.
const DEFAULT_PRICES = [
  { tier: 'FREE_TRIAL',       amount: 0 },
  { tier: 'TEN_DAYS',         amount: 49 },
  { tier: 'ONE_MONTH',        amount: 149 },
  { tier: 'SIX_MONTHS',       amount: 699 },
  { tier: 'ONE_YEAR',         amount: 1299 },
  { tier: 'LIFETIME',         amount: 5999 },
  { tier: 'LIFETIME_SOURCE',  amount: 59999 },
  { tier: 'SECRET_TEST_TIER', amount: 10 },
];

async function main() {
  for (const r of ROBOTS) {
    const robot = await prisma.robot.upsert({
      where: { slug: r.slug },
      update: {}, // idempotent — do not clobber admin edits on re-run
      create: {
        slug: r.slug,
        name: r.name,
        shortDescription: r.shortDescription,
        longDescription: r.longDescription,
        active: true,
        sortOrder: r.sortOrder,
        sourceVersion: 1, // matches the v1.mq5.enc already uploaded to Blob
      },
    });
    console.log(`[onboard-robots-07] Robot ready: id=${robot.id} slug=${robot.slug} active=${robot.active} sourceVersion=${robot.sourceVersion}`);

    for (const { tier, amount } of DEFAULT_PRICES) {
      await prisma.robotPrice.upsert({
        where: { robotId_tier: { robotId: robot.id, tier } },
        update: {}, // idempotent — never clobber admin edits on re-run
        create: { robotId: robot.id, tier, amount, active: true },
      });
    }
    console.log(`[onboard-robots-07] Seeded ${DEFAULT_PRICES.length} RobotPrice rows for ${r.slug}.`);
  }
}

main()
  .catch((err) => { console.error('[onboard-robots-07] FAILED:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
