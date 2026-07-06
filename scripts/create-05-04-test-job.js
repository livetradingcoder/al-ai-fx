/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const TEST_EMAIL = 'phase5-notify-test@al-ai-fx.xyz';

async function main() {
  const robot = await prisma.robot.findUniqueOrThrow({ where: { slug: 'goldbot' } });
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: { email: TEST_EMAIL, name: '05-04 Notify Test' },
  });
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      robotId: robot.id,
      tier: 'FREE_TRIAL',
      status: 'ACTIVE',
      mt5AccountNumber: '11122233',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  });
  // attemptCount=2 so the NEXT /complete FAILED report (nextAttempt=3) hits MAX_ATTEMPTS and goes terminal.
  const job = await prisma.compilation.create({
    data: {
      subscriptionId: subscription.id,
      robotId: robot.id,
      sourceVersion: robot.sourceVersion,
      status: 'PROCESSING',
      attemptCount: 2,
      attemptedAt: new Date(),
    },
  });
  console.log(`[create-05-04-test-job] jobId=${job.id} attemptCount=${job.attemptCount}`);
}

main()
  .catch((err) => { console.error('[create-05-04-test-job] FAILED:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
