import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  STUCK_JOB_MINUTES,
  MAX_ATTEMPTS,
  HEARTBEAT_DEAD_SECONDS,
} from '@/lib/compiler-config';
import { sendAdminCompilerAlertEmail } from '@/lib/mail';
import { notifyTerminalFailure } from '@/lib/compiler-notify';

// Dedup: don't fire more than one alert per event kind within this window
// per WARM serverless instance. Cold starts may cause one duplicate email,
// which is acceptable — the alternative (persistent dedup) needs a DB row
// and locking. Best-effort per-instance dedup keeps operator inbox quiet
// when the same condition persists across many reap ticks.
//
// Note: the per-job job-failed admin alert now lives in notifyTerminalFailure
// (fired per terminal-FAILED job below), so this cooldown map only guards the
// worker-health 'stale-heartbeat' alert.
const ALERT_COOLDOWN_MS = 15 * 60_000;
const lastAlertAt: Record<'stale-heartbeat', number> = {
  'stale-heartbeat': 0,
};

function tryFireAlert(
  kind: 'stale-heartbeat',
  fire: () => Promise<void>,
) {
  const now = Date.now();
  if (now - lastAlertAt[kind] < ALERT_COOLDOWN_MS) return;
  lastAlertAt[kind] = now;
  // Fire-and-forget: /reap must not block on Mailtrap. If email fails, log it.
  fire().catch((err) => console.error('[Reap] Alert fire failed:', err));
}

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
    select: {
      id: true,
      attemptCount: true,
      errorMessage: true,
      robot: { select: { name: true } },
      subscription: { select: { user: { select: { email: true } } } },
    },
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
      const terminalError = `reaped: exhausted ${MAX_ATTEMPTS} attempts`;
      await prisma.compilation.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          attemptCount: nextAttempt,
          errorMessage: terminalError,
        },
      });
      failed.push(job.id);

      // DLVR-03/04: terminal FAILED — notify the buying user (compile-failed
      // email + support link) AND fire the admin alert, per failed job. Both
      // best-effort; notifyTerminalFailure never throws. This REPLACES the
      // reaper's former single-batch job-failed admin alert (dedup), so a
      // terminal failure is never silent regardless of which path wrote FAILED.
      await notifyTerminalFailure({
        id: job.id,
        attemptCount: nextAttempt,
        errorMessage: job.errorMessage ?? terminalError,
        userEmail: job.subscription?.user?.email ?? null,
        robotName: job.robot?.name ?? null,
      });
    }
  }

  // Alert: heartbeat is past the "dead" threshold. Runs regardless of
  // whether we found stuck jobs — the worker being down is its own event.
  const hb = await prisma.workerHeartbeat.findUnique({ where: { id: 'compiler' } });
  if (hb) {
    const ageSec = Math.floor((Date.now() - hb.lastSeenAt.getTime()) / 1000);
    if (ageSec > HEARTBEAT_DEAD_SECONDS) {
      tryFireAlert('stale-heartbeat', () =>
        sendAdminCompilerAlertEmail({
          kind: 'stale-heartbeat',
          lastSeenAgoSeconds: ageSec,
        }),
      );
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
