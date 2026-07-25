import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signSourceToken, sourceTokenExpiry } from '@/lib/compiler-source-token';

type ClaimedJob = {
  id: string;
  subscriptionId: string;
  attemptCount: number;
  sourceVersion: number;
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
        sourceVersion: number;
        subscription: { mt5AccountNumber: string | null; expiresAt: Date | null };
        robot: { slug: string };
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
          robot: { select: { slug: true } },
        },
      });
      if (!job || !job.subscription || !job.robot) return null;
      return {
        id: job.id,
        subscriptionId: job.subscriptionId,
        attemptCount: job.attemptCount,
        sourceVersion: job.sourceVersion,
        subscription: job.subscription,
        robot: job.robot,
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
  //    daemon.js reads it as `job.attemptCount ?? 0`. robotSlug is additive
  //    (Phase 3). sourceVersion + sourceUrl are additive (Phase 4) — the new
  //    daemon (Plan 04-03) fetches the .mq5 from sourceUrl (a short-TTL signed
  //    URL, never source bytes) with Authorization: Bearer COMPILER_SECRET.
  // Behind Traefik, req.url resolves to the internal origin
  // (https://localhost:3330) — the daemon would dial its own localhost and
  // ECONNREFUSED. Always prefer the configured public base URL.
  const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || new URL(req.url).origin;
  console.log(
    `[pipeline] JOB CLAIMED job=${claimed.id} robot=${claimed.robot.slug} ` +
    `v${claimed.sourceVersion} mt5=${claimed.subscription.mt5AccountNumber} origin=${origin}`,
  );
  const exp = sourceTokenExpiry();
  const token = signSourceToken(claimed.robot.slug, claimed.sourceVersion, exp);
  const sourceUrl =
    `${origin}/api/compiler/source` +
    `?robotSlug=${encodeURIComponent(claimed.robot.slug)}` +
    `&version=${claimed.sourceVersion}` +
    `&exp=${exp}` +
    `&token=${token}`;

  return NextResponse.json({
    job: {
      id: claimed.id,
      mt5AccountNumber: claimed.subscription.mt5AccountNumber,
      expiresAt: claimed.subscription.expiresAt,
      attemptCount: claimed.attemptCount,
      robotSlug: claimed.robot.slug,           // additive (Phase 3)
      sourceVersion: claimed.sourceVersion,    // additive (Phase 4)
      sourceUrl,                               // additive (Phase 4) — URL, never source bytes
    },
  });
}
