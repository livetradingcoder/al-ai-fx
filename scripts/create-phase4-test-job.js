/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TEST_EMAIL = 'phase4-smoke-test@al-ai-fx.xyz';
const TEST_MT5_ACCOUNT = '99988877';

async function main() {
  const robot = await prisma.robot.findUniqueOrThrow({ where: { slug: 'goldbot' } });

  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: { email: TEST_EMAIL, name: 'Phase 4 Smoke Test' },
  });

  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      robotId: robot.id,
      tier: 'FREE_TRIAL',
      status: 'ACTIVE',
      mt5AccountNumber: TEST_MT5_ACCOUNT,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  });

  const job = await prisma.compilation.create({
    data: {
      subscriptionId: subscription.id,
      robotId: robot.id,
      sourceVersion: robot.sourceVersion,
      status: 'PENDING',
    },
  });

  console.log(`[phase4-smoke-test] jobId=${job.id} subscriptionId=${subscription.id} robotSlug=${robot.slug} mt5=${TEST_MT5_ACCOUNT}`);
}

main()
  .catch((err) => {
    console.error('[phase4-smoke-test] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
