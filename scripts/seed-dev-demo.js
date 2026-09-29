/* eslint-disable @typescript-eslint/no-require-imports */
// LOCAL DEVELOPMENT ONLY — demo users, licences, orders, builds, affiliate
// activity and coupons so every dashboard page has something to show.
//
// Run after the catalog scripts (seed-goldbot, seed-robot-prices,
// onboard-precision-trader, onboard-robots-2026-09 --activate):
//   node scripts/seed-dev-demo.js
//
// Idempotent: demo rows are keyed on *@demo.goldbot.test emails and DEMO*
// coupon codes, and are wiped and recreated on every run. Refuses to run
// against anything but a localhost database.
//
// Dev sign-in (local only, never reuse elsewhere):
//   Admin     admin@demo.goldbot.test   / GoldBotDev!2026
//   Customer  trader@demo.goldbot.test  / GoldBotDev!2026
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEV_PASSWORD = 'GoldBotDev!2026';
const DOMAIN = 'demo.goldbot.test';
const DAY = 24 * 60 * 60 * 1000;

const daysAgo = (n) => new Date(Date.now() - n * DAY);
const daysFromNow = (n) => new Date(Date.now() + n * DAY);

const TIER_DAYS = { FREE_TRIAL: 3, TEN_DAYS: 10, ONE_MONTH: 30, SIX_MONTHS: 182, ONE_YEAR: 365 };

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL || '';
  if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
    console.error('[seed-dev-demo] Refusing to run: DATABASE_URL is not a localhost database.');
    process.exit(1);
  }
}

async function robotBySlug(slug) {
  return prisma.robot.findUniqueOrThrow({ where: { slug }, include: { prices: true } });
}

function priceOf(robot, tier) {
  return robot.prices.find((p) => p.tier === tier)?.amount ?? 0;
}

async function main() {
  assertLocalDatabase();

  // ---- Reset previous demo rows (cascades take subs, orders, sessions, affiliate data)
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
  await prisma.coupon.deleteMany({ where: { code: { startsWith: 'DEMO' } } });
  await prisma.emailSubscriber.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const robots = {
    mr4: await robotBySlug('gold-multirange-4'),
    mr7: await robotBySlug('gold-multirange-7'),
    mr6: await robotBySlug('gold-multirange-6-aggressive'),
    bc: await robotBySlug('gold-breakout-conservative'),
    ba: await robotBySlug('gold-breakout-aggressive'),
    pt: await robotBySlug('precision-trader'),
    goldbot: await robotBySlug('goldbot'),
  };

  // ---- Users
  const admin = await prisma.user.create({
    data: { email: `admin@${DOMAIN}`, name: 'Demo Admin', role: 'ADMIN', passwordHash, createdAt: daysAgo(120) },
  });

  const trader = await prisma.user.create({
    data: { email: `trader@${DOMAIN}`, name: 'Alex Morgan', passwordHash, createdAt: daysAgo(95) },
  });

  const customerSpecs = [
    ['sofia.reyes', 'Sofia Reyes', 80],
    ['liam.chen', 'Liam Chen', 64],
    ['amara.okafor', 'Amara Okafor', 51],
    ['noah.weber', 'Noah Weber', 38],
    ['priya.shah', 'Priya Shah', 27],
    ['mateo.rossi', 'Mateo Rossi', 19],
    ['hana.sato', 'Hana Sato', 11],
    ['omar.haddad', 'Omar Haddad', 6],
    ['ella.novak', 'Ella Novak', 2],
  ];
  const customers = [];
  for (const [handle, name, age] of customerSpecs) {
    customers.push(
      await prisma.user.create({
        data: { email: `${handle}@${DOMAIN}`, name, passwordHash, createdAt: daysAgo(age) },
      }),
    );
  }
  // One blocked account so the admin users table shows that state.
  await prisma.user.update({ where: { id: customers[5].id }, data: { isBlocked: true } });

  // ---- Licences, orders and builds
  let paygateSeq = 1000;
  async function purchase(user, robot, tier, opts = {}) {
    const start = opts.startedDaysAgo != null ? daysAgo(opts.startedDaysAgo) : daysAgo(5);
    const length = TIER_DAYS[tier];
    const expiresAt = length ? new Date(start.getTime() + length * DAY) : null;
    const status = opts.status ?? (expiresAt && expiresAt < new Date() ? 'EXPIRED' : 'ACTIVE');

    const amount = tier === 'FREE_TRIAL' ? 0 : priceOf(robot, tier);
    let order = null;
    if (tier !== 'FREE_TRIAL') {
      order = await prisma.order.create({
        data: {
          userId: user.id,
          amount,
          pricingTier: tier,
          status: opts.orderStatus ?? 'SUCCESS',
          paygateId: `DEMO-PG-${paygateSeq++}`,
          createdAt: start,
        },
      });
    }
    if (opts.orderStatus && opts.orderStatus !== 'SUCCESS') return { order };

    const sub = await prisma.subscription.create({
      data: {
        userId: user.id,
        robotId: robot.id,
        tier,
        status,
        mt5AccountNumber: opts.mt5 ?? null,
        startsAt: start,
        expiresAt,
        createdAt: start,
      },
    });

    for (const build of opts.builds ?? []) {
      await prisma.compilation.create({
        data: {
          subscriptionId: sub.id,
          robotId: robot.id,
          sourceVersion: robot.sourceVersion,
          status: build.status,
          attemptCount: build.status === 'PENDING' ? 0 : 1,
          attemptedAt: build.status === 'PENDING' ? null : daysAgo(build.daysAgo ?? 1),
          errorMessage: build.status === 'FAILED' ? 'MetaEditor exited with code 1 (demo failure)' : null,
          downloadUrl:
            build.status === 'COMPLETED' ? `compiled/AL-ai-FX_${robot.slug}_demo-${sub.id}.ex5` : null,
          sizeBytes: build.status === 'COMPLETED' ? 184_320 : null,
          createdAt: daysAgo(build.daysAgo ?? 1),
        },
      });
    }
    return { order, sub };
  }

  // The demo customer's own account: a mix of every licence state.
  await purchase(trader, robots.mr4, 'ONE_YEAR', {
    startedDaysAgo: 40,
    mt5: '50123487',
    builds: [
      { status: 'COMPLETED', daysAgo: 40 },
      { status: 'COMPLETED', daysAgo: 3 },
    ],
  });
  await purchase(trader, robots.mr7, 'ONE_MONTH', { startedDaysAgo: 2 }); // not yet MT5-locked
  await purchase(trader, robots.pt, 'FREE_TRIAL', {
    startedDaysAgo: 60,
    mt5: '50123487',
    builds: [{ status: 'COMPLETED', daysAgo: 60 }],
  });
  await purchase(trader, robots.goldbot, 'SIX_MONTHS', {
    startedDaysAgo: 90,
    status: 'CANCELLED',
    mt5: '40988121',
    builds: [{ status: 'COMPLETED', daysAgo: 90 }],
  });
  await purchase(trader, robots.bc, 'TEN_DAYS', { startedDaysAgo: 1, orderStatus: 'FAILED' });

  // Everyone else, for admin totals and tables.
  const [sofia, liam, amara, noah, priya, mateo, hana, omar, ella] = customers;
  await purchase(sofia, robots.mr7, 'ONE_YEAR', { startedDaysAgo: 80, mt5: '61002231', builds: [{ status: 'COMPLETED', daysAgo: 80 }] });
  await purchase(liam, robots.mr4, 'SIX_MONTHS', { startedDaysAgo: 64, mt5: '61774410', builds: [{ status: 'COMPLETED', daysAgo: 64 }] });
  await purchase(amara, robots.ba, 'ONE_MONTH', { startedDaysAgo: 51, mt5: '62008815', builds: [{ status: 'COMPLETED', daysAgo: 51 }] });
  await purchase(amara, robots.mr6, 'ONE_MONTH', { startedDaysAgo: 12, mt5: '62008815', builds: [{ status: 'FAILED', daysAgo: 12 }, { status: 'COMPLETED', daysAgo: 11 }] });
  await purchase(noah, robots.mr4, 'ONE_MONTH', { startedDaysAgo: 20, mt5: '63300192', builds: [{ status: 'COMPLETED', daysAgo: 20 }] });
  await purchase(priya, robots.pt, 'FREE_TRIAL', { startedDaysAgo: 2, mt5: '64410027', builds: [{ status: 'PROCESSING', daysAgo: 0 }] });
  await purchase(priya, robots.mr4, 'ONE_YEAR', { startedDaysAgo: 1, orderStatus: 'PENDING' });
  await purchase(mateo, robots.bc, 'TEN_DAYS', { startedDaysAgo: 19, mt5: '65001288', builds: [{ status: 'COMPLETED', daysAgo: 19 }] });
  await purchase(hana, robots.mr7, 'ONE_MONTH', { startedDaysAgo: 11, mt5: '66120993', builds: [{ status: 'PENDING', daysAgo: 0 }] });
  await purchase(omar, robots.mr4, 'ONE_YEAR', { startedDaysAgo: 6, mt5: '67003114', builds: [{ status: 'COMPLETED', daysAgo: 6 }] });
  await purchase(ella, robots.pt, 'FREE_TRIAL', { startedDaysAgo: 2 });

  // ---- Affiliate program: the demo customer refers two buyers.
  await prisma.affiliateSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
  if ((await prisma.affiliateTier.count()) === 0) {
    await prisma.affiliateTier.createMany({
      data: [
        { name: 'Bronze', threshold: 0, rate: 15, sortOrder: 0 },
        { name: 'Silver', threshold: 500, rate: 20, sortOrder: 1 },
        { name: 'Gold', threshold: 2000, rate: 25, sortOrder: 2 },
      ],
    });
  }

  const affiliate = await prisma.affiliate.create({
    data: {
      userId: trader.id,
      code: 'ALEXDEMO',
      payoutMethod: 'USDT TRC20',
      payoutAddress: 'TDemoAddressNotReal000000000000000',
      createdAt: daysAgo(70),
    },
  });
  for (let i = 0; i < 42; i++) {
    await prisma.affiliateClick.create({
      data: {
        affiliateId: affiliate.id,
        landingPath: i % 3 === 0 ? '/catalog' : '/',
        country: ['US', 'GB', 'DE', 'AE', 'IN'][i % 5],
        createdAt: daysAgo(i % 60),
      },
    });
  }

  const payout = await prisma.affiliatePayout.create({
    data: {
      affiliateId: affiliate.id,
      amount: 199.8,
      method: 'USDT TRC20',
      address: 'TDemoAddressNotReal000000000000000',
      reference: 'demo-tx-0001',
      status: 'PAID',
      requestedAt: daysAgo(30),
      paidAt: daysAgo(28),
    },
  });

  async function referAndCommission(user, orderQuery, status, extra = {}) {
    const referral = await prisma.referral.create({
      data: { affiliateId: affiliate.id, referredUserId: user.id, code: affiliate.code, landingPath: '/', createdAt: user.createdAt },
    });
    const order = await prisma.order.findFirstOrThrow({ where: { userId: user.id, ...orderQuery } });
    const rate = 20;
    await prisma.commission.create({
      data: {
        orderId: order.id,
        affiliateId: affiliate.id,
        referralId: referral.id,
        orderAmount: order.amount,
        rate,
        amount: Math.round(order.amount * rate) / 100,
        status,
        holdUntil: new Date(order.createdAt.getTime() + 14 * DAY),
        createdAt: order.createdAt,
        ...extra,
      },
    });
  }
  await referAndCommission(sofia, { status: 'SUCCESS' }, 'PAID', { approvedAt: daysAgo(60), paidAt: daysAgo(28), payoutId: payout.id });
  await referAndCommission(omar, { status: 'SUCCESS' }, 'PENDING');
  await referAndCommission(noah, { status: 'SUCCESS' }, 'APPROVED', { approvedAt: daysAgo(3) });

  // ---- Coupons
  await prisma.coupon.createMany({
    data: [
      { code: 'DEMOWELCOME10', kind: 'PERCENT', value: 10, note: 'Demo: 10% off anything' },
      { code: 'DEMOFIXED50', kind: 'FIXED', value: 50, tier: 'ONE_YEAR', note: 'Demo: $50 off yearly plans' },
      { code: 'DEMOTESTFREE', kind: 'FREE', value: 100, robotId: robots.mr4.id, maxRedemptions: 5, redeemedCount: 1, note: 'Demo: free test build' },
      { code: 'DEMOEXPIRED', kind: 'PERCENT', value: 25, active: false, expiresAt: daysAgo(10), note: 'Demo: expired code' },
    ],
  });

  // ---- Compile worker looks alive; newsletter has a few leads.
  await prisma.workerHeartbeat.upsert({
    where: { id: 'compiler' },
    update: { lastSeenAt: new Date(), workerVersion: 'demo-2.0' },
    create: { id: 'compiler', lastSeenAt: new Date(), workerVersion: 'demo-2.0' },
  });
  await prisma.emailSubscriber.createMany({
    data: ['lead1', 'lead2', 'lead3', 'lead4'].map((h, i) => ({
      email: `${h}@${DOMAIN}`,
      source: 'al-ai-fx:pay-after-trial',
      locale: 'en',
      createdAt: daysAgo(i * 4),
    })),
  });

  const counts = {
    users: await prisma.user.count(),
    subscriptions: await prisma.subscription.count(),
    orders: await prisma.order.count(),
    compilations: await prisma.compilation.count(),
    commissions: await prisma.commission.count(),
    coupons: await prisma.coupon.count(),
  };
  console.log('[seed-dev-demo] done', counts);
  console.log(`[seed-dev-demo] admin=${admin.email} customer=${trader.email} (password in this file's header)`);
}

main()
  .catch((err) => {
    console.error('[seed-dev-demo] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
