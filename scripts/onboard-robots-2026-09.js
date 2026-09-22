/* eslint-disable @typescript-eslint/no-require-imports */
// Onboard the 2026-09 lineup: two single-range Breakouts and two MultiRange
// robots, a coming-soon MultiRange 11, and GoldBot Double Range delisted.
//
//   node scripts/onboard-robots-2026-09.js                  # stage: rows exist, hidden, prices off
//   node scripts/onboard-robots-2026-09.js --activate       # go live after compile probes pass
//   node scripts/onboard-robots-2026-09.js --delist-goldbot # once the homepage points at the flagship
//
// Staging first means nothing is buyable until a real compile of every new
// source has succeeded on the Windows worker. Delisting GoldBot is separate
// so the homepage's "Get" buttons never point at a robot that can't be
// bought. Idempotent — safe to re-run.
//
// Price ladder = number of ranges the robot trades (PrecisionTrader, the
// existing single-range robot, sets the 1-range rung):
//   ranges   10 days  month  6 months  year   lifetime  lifetime+source
//   1          9       39     179       399    3,999     39,999
//   4         29       99     449       999    9,999     99,999
//   6         39      139     629     1,399   13,999    139,999
//   11        59      199     899     1,999   19,999    199,999
// LIFETIME / LIFETIME_SOURCE are contact-only (never shown as checkout chips).
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ACTIVATE = process.argv.includes('--activate');
const DELIST_GOLDBOT = process.argv.includes('--delist-goldbot');

const LADDER = {
  1: [9, 39, 179, 399, 3999, 39999],
  4: [29, 99, 449, 999, 9999, 99999],
  6: [39, 139, 629, 1399, 13999, 139999],
  11: [59, 199, 899, 1999, 19999, 199999],
};
const TIERS = ['TEN_DAYS', 'ONE_MONTH', 'SIX_MONTHS', 'ONE_YEAR', 'LIFETIME', 'LIFETIME_SOURCE'];

const DELIVERY = 'Delivered as a compiled .ex5 locked to your MT5 account number.';

const ROBOTS = [
  {
    slug: 'gold-breakout-conservative',
    name: 'Gold Breakout Conservative',
    ranges: 1,
    sortOrder: 2,
    shortDescription:
      'One gold breakout a day with tight targets and a light hedge — the steadier of the two Breakout builds.',
    longDescription: [
      'Gold Breakout Conservative marks one session range on XAUUSD each day and trades the first clean break of it. Targets are kept tight and the hedge behind each trade is sized lightly, so it aims for small, frequent wins and a false break costs less.',
      "You set the lot size, the hedge multiplier and the session window (your broker's server time, 07:00–10:00 by default). Stops, targets and the entry buffer are fixed in the build.",
      DELIVERY,
    ],
  },
  {
    slug: 'gold-breakout-aggressive',
    name: 'Gold Breakout Aggressive',
    ranges: 1,
    sortOrder: 3,
    shortDescription:
      'One gold breakout a day with wide targets and a heavy hedge — bigger wins, deeper swings. For larger accounts.',
    longDescription: [
      'Gold Breakout Aggressive trades the daily session breakout on XAUUSD with wider stops and targets, and a hedge sized at 15× the primary lot by default. A false break is recovered hard — which also means a bad day costs more. Size it for a larger account.',
      "You set the lot size, the hedge multiplier and the session window (your broker's server time, 07:00–10:00 by default). Stops, targets and the entry buffer are fixed in the build.",
      DELIVERY,
    ],
  },
  {
    slug: 'gold-multirange-4',
    name: 'Gold MultiRange 4',
    ranges: 4,
    sortOrder: 4,
    shortDescription:
      'Four independent gold session ranges a day, each with its own breakout and hedge — the GoldBot engine, expanded.',
    longDescription: [
      "Gold MultiRange 4 watches four separate session ranges on XAUUSD every day and trades each breakout on its own terms — its own stops, targets and hedge — so one range's result never blocks another.",
      "Choose fixed-lot or risk-percent sizing and switch any of the four ranges off from the inputs. Every range's timing and trade values are fixed in the build. It sits out major US, UK and EU bank holidays.",
      DELIVERY,
    ],
  },
  {
    slug: 'gold-multirange-6-aggressive',
    name: 'Gold MultiRange 6 Aggressive',
    ranges: 6,
    sortOrder: 5,
    shortDescription:
      'Six gold session ranges a day — MultiRange 4 plus both Breakout sessions. The most coverage, and the most risk.',
    longDescription: [
      'Everything in Gold MultiRange 4, plus the morning session traded twice — once with the Breakout Conservative values and once with the Breakout Aggressive values. Six independent ranges, each with its own stops, targets and hedge.',
      'More ranges means more trades and more exposure, and the aggressive range uses a heavy hedge — size it for a larger account. Choose fixed-lot or risk-percent sizing and switch any range off from the inputs; timing and trade values are fixed in the build.',
      DELIVERY,
    ],
  },
  {
    // No source yet — only a compiled .ex5 exists, which cannot be
    // account-locked. Listed as coming soon; prices stay off until the .mq5
    // is released through the pipeline.
    slug: 'gold-multirange-11',
    name: 'Gold MultiRange 11',
    ranges: 11,
    sortOrder: 6,
    comingSoon: true,
    shortDescription: 'Eleven gold session ranges a day — the full MultiRange engine. Coming soon.',
    longDescription: [
      'The complete MultiRange engine: eleven independent session ranges on XAUUSD a day, each with its own breakout, stops and hedge.',
    ],
  },
];

async function main() {
  if (DELIST_GOLDBOT) {
    // Delisted, not deleted: existing GoldBot subscribers keep their licence,
    // MT5 lock, compiles and downloads (none of those require active=true).
    await prisma.robot.update({ where: { slug: 'goldbot' }, data: { active: false } });
    console.log('goldbot delisted');
    return;
  }

  for (const r of ROBOTS) {
    const live = ACTIVATE;
    const data = {
      name: r.name,
      shortDescription: r.shortDescription,
      longDescription: r.longDescription.join('\n\n'),
      sortOrder: r.sortOrder,
      sourceVersion: 1,
      // Staged robots stay hidden; on activation even the coming-soon one is
      // listed (active robot + no active price = "Coming soon" card).
      active: live,
    };
    const robot = await prisma.robot.upsert({
      where: { slug: r.slug },
      update: data,
      create: { slug: r.slug, ...data },
    });

    const amounts = LADDER[r.ranges];
    for (let i = 0; i < TIERS.length; i++) {
      const active = live && !r.comingSoon;
      await prisma.robotPrice.upsert({
        where: { robotId_tier: { robotId: robot.id, tier: TIERS[i] } },
        update: { amount: amounts[i], active },
        create: { robotId: robot.id, tier: TIERS[i], amount: amounts[i], active },
      });
    }
    console.log(`${live ? 'LIVE ' : 'staged'} ${r.slug} (${robot.id}) ${r.comingSoon ? '[coming soon]' : ''}`);
  }

  if (ACTIVATE) {
    // v2 adds the runtime licence check; probes compiled it before this runs.
    await prisma.robot.update({
      where: { slug: 'precision-trader' },
      data: { sourceVersion: 2, sortOrder: 1 },
    });

    await prisma.robot.updateMany({ where: { slug: 'goldshield' }, data: { sortOrder: 7 } });
    await prisma.robot.updateMany({ where: { slug: 'precision-range' }, data: { sortOrder: 8 } });
    await prisma.robot.updateMany({ where: { slug: 'sniper-lite' }, data: { sortOrder: 9 } });

    const rows = await prisma.robot.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        slug: true,
        sortOrder: true,
        sourceVersion: true,
        prices: { where: { active: true, tier: 'ONE_MONTH' }, select: { amount: true } },
      },
    });
    console.log('live catalog:');
    for (const row of rows) {
      const month = row.prices[0]?.amount;
      console.log(`  ${row.sortOrder} ${row.slug} v${row.sourceVersion} ${month ? `$${month}/mo` : 'coming soon'}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
