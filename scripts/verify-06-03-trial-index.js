/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const EMAIL = `verify-0603-trial-index-${Date.now()}@al-ai-fx.xyz`;

async function main() {
  const goldbot = await prisma.robot.findUniqueOrThrow({ where: { slug: 'goldbot' } });
  const user = await prisma.user.create({ data: { email: EMAIL, name: 'trial-index-test' } });

  const sub1 = await prisma.subscription.create({
    data: { userId: user.id, robotId: goldbot.id, tier: 'FREE_TRIAL', status: 'ACTIVE', expiresAt: new Date(Date.now() + 3 * 86400000) },
  });
  console.log(`[verify-06-03] first FREE_TRIAL insert OK: subscriptionId=${sub1.id}`);

  // Expire it to prove the guard is existence-ever, not active-ever.
  await prisma.subscription.update({ where: { id: sub1.id }, data: { status: 'EXPIRED' } });
  console.log('[verify-06-03] first subscription marked EXPIRED');

  let caughtP2002 = false;
  try {
    await prisma.subscription.create({
      data: { userId: user.id, robotId: goldbot.id, tier: 'FREE_TRIAL', status: 'ACTIVE', expiresAt: new Date(Date.now() + 3 * 86400000) },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      caughtP2002 = true;
      console.log('[verify-06-03] second FREE_TRIAL insert correctly threw P2002 (partial unique index fired even though first trial is EXPIRED)');
    } else {
      throw err;
    }
  }
  console.log(`[verify-06-03] ASSERT partial-index-blocks-expired-reclaim: ${caughtP2002 ? 'PASS' : 'FAIL'}`);
}

main()
  .catch((err) => { console.error('[verify-06-03] FAILED:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
