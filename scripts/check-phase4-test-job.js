/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const jobId = process.argv[2];
  const job = await prisma.compilation.findUnique({
    where: { id: jobId },
    include: { robot: { select: { slug: true } } },
  });
  console.log('[check-phase4-test-job]', JSON.stringify(job, null, 2));
}

main()
  .catch((err) => {
    console.error('[check-phase4-test-job] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
