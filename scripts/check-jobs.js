const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const pending = await prisma.compilation.count({
      where: { status: 'PENDING' }
    });
    const processing = await prisma.compilation.count({
      where: { status: 'PROCESSING' }
    });
    const all = await prisma.compilation.count();
    
    console.log(`Compilation jobs in DB:`);
    console.log(`Total: ${all}`);
    console.log(`Pending: ${pending}`);
    console.log(`Processing: ${processing}`);

    if (all > 0) {
      const latest = await prisma.compilation.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      console.log('Latest job:', latest);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
