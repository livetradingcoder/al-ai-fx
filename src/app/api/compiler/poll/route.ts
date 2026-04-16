import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.COMPILER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const job = await prisma.compilation.findFirst({
      where: { status: 'PENDING' },
      include: { subscription: true },
      orderBy: { createdAt: 'asc' }
    });

    if (!job) {
      return NextResponse.json({ job: null }, { status: 200 });
    }

    await prisma.compilation.update({
      where: { id: job.id },
      data: { status: 'PROCESSING' }
    });

    return NextResponse.json({ 
      job: {
        id: job.id,
        mt5AccountNumber: job.subscription.mt5AccountNumber,
        expiresAt: job.subscription.expiresAt
      } 
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Database fail' }, { status: 500 });
  }
}
