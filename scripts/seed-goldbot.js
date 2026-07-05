/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedGoldbot() {
  const robot = await prisma.robot.upsert({
    where: { slug: 'goldbot' },
    update: {}, // idempotent — do not clobber edits on re-run
    create: {
      slug: 'goldbot',
      name: 'GoldBot',
      shortDescription: 'Automated XAUUSD (gold) expert advisor for MetaTrader 5.',
      longDescription:
        'GoldBot is AL-ai-FX\'s flagship automated trading robot for the XAUUSD (gold) market on MetaTrader 5. Each license is locked to a single MT5 account number and delivered as a compiled .ex5 within minutes of checkout.',
      active: true,
      sortOrder: 0,
    },
  });
  console.log(`[seed-goldbot] Robot ready: id=${robot.id} slug=${robot.slug} active=${robot.active}`);
}

seedGoldbot()
  .catch((err) => {
    console.error('[seed-goldbot] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
