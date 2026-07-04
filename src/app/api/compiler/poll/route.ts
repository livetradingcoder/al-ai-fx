import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type ClaimedJob = {
  id: string;
  subscriptionId: string;
  attemptCount: number;
};

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.COMPILER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Heartbeat — always, even on empty poll.
  //    Failure to write must not fail the poll (heartbeat is best-effort).
  try {
    await prisma.workerHeartbeat.upsert({
      where: { id: 'compiler' },
      update: { lastSeenAt: new Date() },
      create: { id: 'compiler', lastSeenAt: new Date() },
    });
  } catch (err) {
    console.error('[Compiler Poll] Heartbeat upsert failed (non-fatal):', err);
  }

  // 2. Atomic dequeue.
  //    Postgres FOR UPDATE SKIP LOCKED locks a single PENDING row and
  //    returns it; concurrent pollers get different rows or none.
  //    Both statements share the same transaction => atomic claim.
  let claimed:
    | (ClaimedJob & {
        subscription: { mt5AccountNumber: string | null; expiresAt: Date | null };
      })
    | null = null;
  try {
    claimed = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "Compilation"
        WHERE status = 'PENDING'
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
      if (rows.length === 0) return null;
      const jobId = rows[0].id;

      await tx.$executeRaw`
        UPDATE "Compilation"
        SET status = 'PROCESSING',
            "attemptedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE id = ${jobId}
      `;

      // Fetch the row + subscription for the response shape.
      const job = await tx.compilation.findUnique({
        where: { id: jobId },
        include: {
          subscription: { select: { mt5AccountNumber: true, expiresAt: true } },
        },
      });
      if (!job || !job.subscription) return null;
      return {
        id: job.id,
        subscriptionId: job.subscriptionId,
        attemptCount: job.attemptCount,
        subscription: job.subscription,
      };
    });
  } catch (err) {
    console.error('[Compiler Poll] Dequeue failed:', err);
    return NextResponse.json({ error: 'Database fail' }, { status: 500 });
  }

  if (!claimed) {
    return NextResponse.json({ job: null }, { status: 200 });
  }

  // 3. Response shape — ADDITIVE ONLY. Existing worker (daemon.js) reads
  //    job.id, job.mt5AccountNumber, job.expiresAt. attemptCount is new;
  //    daemon.js reads it as `job.attemptCount ?? 0`.
  return NextResponse.json({
    job: {
      id: claimed.id,
      mt5AccountNumber: claimed.subscription.mt5AccountNumber,
      expiresAt: claimed.subscription.expiresAt,
      attemptCount: claimed.attemptCount,
    },
  });
}
