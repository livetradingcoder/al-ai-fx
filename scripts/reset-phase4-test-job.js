/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const jobId = process.argv[2];
  const job = await prisma.compilation.update({
    where: { id: jobId },
    data: { status: 'PENDING', attemptCount: 0, attemptedAt: null, errorMessage: null },
  });
  console.log('[reset-phase4-test-job]', JSON.stringify(job));
}

main()
  .catch((err) => {
    console.error('[reset-phase4-test-job] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
