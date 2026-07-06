/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Amounts mirror TIER_METADATA (src/lib/pricing-tiers.ts) at seed time. Admin
// edits (06-04) override these later; upsert update:{} makes re-runs non-clobbering.
// KEEP IN SYNC with TIER_METADATA amounts.
const GOLDBOT_PRICES = [
  { tier: 'FREE_TRIAL',       amount: 0 },
  { tier: 'TEN_DAYS',         amount: 69 },
  { tier: 'ONE_MONTH',        amount: 199 },
  { tier: 'SIX_MONTHS',       amount: 999 },
  { tier: 'ONE_YEAR',         amount: 1799 },
  { tier: 'LIFETIME',         amount: 7999 },
  { tier: 'LIFETIME_SOURCE',  amount: 79999 },
  { tier: 'SECRET_TEST_TIER', amount: 10 },
];

async function seed() {
  const goldbot = await prisma.robot.findUniqueOrThrow({ where: { slug: 'goldbot' } });
  for (const { tier, amount } of GOLDBOT_PRICES) {
    await prisma.robotPrice.upsert({
      where: { robotId_tier: { robotId: goldbot.id, tier } },
      update: {}, // idempotent — never clobber admin edits on re-run
      create: { robotId: goldbot.id, tier, amount, active: true },
    });
  }
  console.log(`[seed-robot-prices] Seeded ${GOLDBOT_PRICES.length} RobotPrice rows for goldbot (id=${goldbot.id}).`);
}

seed()
  .catch((err) => { console.error('[seed-robot-prices] FAILED:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
