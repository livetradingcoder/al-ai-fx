import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  STUCK_JOB_MINUTES,
  MAX_ATTEMPTS,
  HEARTBEAT_DEAD_SECONDS,
} from '@/lib/compiler-config';
import { sendAdminCompilerAlertEmail } from '@/lib/mail';

// Dedup: don't fire more than one alert per event kind within this window
// per WARM serverless instance. Cold starts may cause one duplicate email,
// which is acceptable — the alternative (persistent dedup) needs a DB row
// and locking. Best-effort per-instance dedup keeps operator inbox quiet
// when the same condition persists across many reap ticks.
const ALERT_COOLDOWN_MS = 15 * 60_000;
const lastAlertAt: Record<'stale-heartbeat' | 'job-failed', number> = {
  'stale-heartbeat': 0,
  'job-failed': 0,
};

function tryFireAlert(
  kind: 'stale-heartbeat' | 'job-failed',
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
    select: { id: true, attemptCount: true, errorMessage: true },
  });

  const requeued: string[] = [];
  const failed: string[] = [];
  let firstFailedErrorMessage: string | undefined;

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
      if (!firstFailedErrorMessage) {
        firstFailedErrorMessage = job.errorMessage ?? terminalError;
      }
    }
  }

  // Alert: any job transitioned to permanent FAILED this tick.
  // One email covers the whole batch (uses the first job as representative).
  if (failed.length > 0) {
    const representativeJobId = failed[0];
    const errMsg = firstFailedErrorMessage;
    tryFireAlert('job-failed', () =>
      sendAdminCompilerAlertEmail({
        kind: 'job-failed',
        jobId: representativeJobId,
        attempts: MAX_ATTEMPTS,
        errorMessage: errMsg,
      }),
    );
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
