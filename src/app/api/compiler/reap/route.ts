import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STUCK_JOB_MINUTES, MAX_ATTEMPTS } from '@/lib/compiler-config';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const cutoff = new Date(Date.now() - STUCK_JOB_MINUTES * 60_000);

  const stuck = await prisma.compilation.findMany({
    where: {
      status: 'PROCESSING',
      attemptedAt: { lt: cutoff },
    },
    select: { id: true, attemptCount: true },
  });

  const requeued: string[] = [];
  const failed: string[] = [];

  for (const job of stuck) {
    const nextAttempt = job.attemptCount + 1;
    if (nextAttempt < MAX_ATTEMPTS) {
      await prisma.compilation.update({
        where: { id: job.id },
        data: {
          status: 'PENDING',
          attemptCount: nextAttempt,
          attemptedAt: null,
          errorMessage: `reaped: stuck in PROCESSING > ${STUCK_JOB_MINUTES}m`,
        },
      });
      requeued.push(job.id);
    } else {
      await prisma.compilation.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          attemptCount: nextAttempt,
          errorMessage: `reaped: exhausted ${MAX_ATTEMPTS} attempts`,
        },
      });
      failed.push(job.id);
    }
  }

  return Response.json({
    scanned: stuck.length,
    requeued: requeued.length,
    failed: failed.length,
    stuckJobMinutes: STUCK_JOB_MINUTES,
    maxAttempts: MAX_ATTEMPTS,
  });
}
