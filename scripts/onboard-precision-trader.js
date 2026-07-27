/* eslint-disable @typescript-eslint/no-require-imports */
// Onboard PrecisionTrader (2026-07-27) and move the free trial onto it.
//
// Catalog goes from one sellable robot to two: GoldBot Double Range stays the
// paid flagship, PrecisionTrader (single-range breakout, adapted from the
// goldshield candidate) becomes the trial robot AND a cheaper paid product.
// Source is already uploaded as sources/precision-trader/v1.mq5.enc.
//
// Idempotent — safe to re-run.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROBOT = {
  slug: 'precision-trader',
  name: 'PrecisionTrader',
  shortDescription:
    'Single-range breakout EA for gold — one session range a day, hedged, with a fixed lot you control.',
  longDescription:
    'PrecisionTrader builds one range per session on the H1 chart and trades the breakout, placing a hedge behind the primary order so a false break is capped rather than left running. Every strategy value — session window, stops, targets, buffer, hedge sizing — is fixed in the build; the only thing you set is your lot size. Delivered as a compiled build locked to your MT5 account number.',
  sortOrder: 2,
};

// Below GoldBot's ladder (19/69/299/699): a simpler, single-range strategy.
// Admin can revise any of these live in the price editor.
const PRICES = [
  { tier: 'FREE_TRIAL', amount: 0 },
  { tier: 'TEN_DAYS', amount: 9 },
  { tier: 'ONE_MONTH', amount: 39 },
  { tier: 'SIX_MONTHS', amount: 179 },
  { tier: 'ONE_YEAR', amount: 399 },
  { tier: 'LIFETIME', amount: 3999 },
  { tier: 'LIFETIME_SOURCE', amount: 39999 },
  { tier: 'SECRET_TEST_TIER', amount: 10 },
];

async function main() {
  const robot = await prisma.robot.upsert({
    where: { slug: ROBOT.slug },
    update: {
      name: ROBOT.name,
      shortDescription: ROBOT.shortDescription,
      longDescription: ROBOT.longDescription,
      active: true,
      sortOrder: ROBOT.sortOrder,
      sourceVersion: 1,
    },
    create: { ...ROBOT, active: true, sourceVersion: 1 },
  });
  console.log(`robot ${robot.slug} (${robot.id})`);

  for (const p of PRICES) {
    await prisma.robotPrice.upsert({
      where: { robotId_tier: { robotId: robot.id, tier: p.tier } },
      update: { amount: p.amount, active: true },
      create: { robotId: robot.id, tier: p.tier, amount: p.amount, active: true },
    });
  }
  console.log(`prices active: ${PRICES.map((p) => p.tier).join(', ')}`);

  // The trial now hands out the single-range robot, so the double-range
  // strategy stops being free-claimable.
  const goldbot = await prisma.robot.findUnique({ where: { slug: 'goldbot' } });
  if (goldbot) {
    const off = await prisma.robotPrice.updateMany({
      where: { robotId: goldbot.id, tier: 'FREE_TRIAL' },
      data: { active: false },
    });
    console.log(`goldbot FREE_TRIAL deactivated (${off.count} row)`);
  }

  // The other three have no source in storage yet. Leave them ACTIVE with no
  // active prices: the catalog renders exactly that state as "Coming soon"
  // (see catalog/page.tsx), which is what marketing wants, and checkout can't
  // reach them because every price row is inactive.
  const soon = await prisma.robot.updateMany({
    where: { slug: { in: ['goldshield', 'precision-range', 'sniper-lite'] } },
    data: { active: true },
  });
  await prisma.robotPrice.updateMany({
    where: { robot: { slug: { in: ['goldshield', 'precision-range', 'sniper-lite'] } } },
    data: { active: false },
  });
  console.log(`coming-soon robots: ${soon.count}`);

  const rows = await prisma.robot.findMany({
    where: { active: true },
    select: { slug: true, name: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log('live catalog:', rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
