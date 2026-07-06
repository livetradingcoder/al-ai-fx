import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MAX_ATTEMPTS } from '@/lib/compiler-config';
import { getCompiledBlobPathname } from '@/lib/compiler-filename';
import { sendCompileReadyEmail } from '@/lib/mail';
import { buildDashboardMagicLink } from '@/lib/magic-links';
import { notifyTerminalFailure } from '@/lib/compiler-notify';

type CompletePayload = {
  jobId?: string;
  status?: 'COMPLETED' | 'FAILED';
  blobUrl?: string;
  sha256?: string;
  sizeBytes?: number;
  errorMessage?: string;
};

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.COMPILER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CompletePayload;
  try {
    body = (await req.json()) as CompletePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { jobId, status, blobUrl, sha256, sizeBytes, errorMessage } = body;

  if (!jobId || (status !== 'COMPLETED' && status !== 'FAILED')) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const job = await prisma.compilation.findUnique({
    where: { id: jobId },
    include: {
      robot: { select: { slug: true, name: true } },
      subscription: { include: { user: { select: { id: true, email: true } } } },
    },
  });
  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (status === 'COMPLETED') {
    if (!blobUrl) {
      return NextResponse.json({ error: 'Missing blobUrl' }, { status: 400 });
    }
    // Soft consistency check: the daemon (Plan 04-03) uploads to the
    // robot-scoped pathname getCompiledBlobPathname(jobId, { robotSlug }).
    // /download reads with the SAME slug. Warn on mismatch — never reject a
    // good compile over a naming nit.
    const expectedPath = getCompiledBlobPathname(jobId, { robotSlug: job.robot.slug });
    if (!blobUrl.includes(expectedPath)) {
      console.warn(`[complete] blobUrl pathname mismatch for job ${jobId}: expected .../${expectedPath}`);
    }
    await prisma.compilation.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        downloadUrl: blobUrl,
        sha256: sha256 ?? null,
        sizeBytes: sizeBytes ?? null,
        errorMessage: null,
      },
    });

    // DLVR-01: notify the buying user their build is ready — best-effort, never
    // fail /complete. Email path is no-op-safe when Mailtrap is unconfigured.
    try {
      const user = job.subscription?.user;
      if (user?.email) {
        const magicLinkUrl = buildDashboardMagicLink({ email: user.email, userId: user.id });
        await sendCompileReadyEmail(user.email, job.robot.name, magicLinkUrl);
      }
    } catch (e) {
      console.error(`[complete] compile-ready email failed for job ${jobId}:`, e);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  }

  // FAILED path: bounded retry via attemptCount vs MAX_ATTEMPTS.
  const nextAttempt = job.attemptCount + 1;
  if (nextAttempt < MAX_ATTEMPTS) {
    await prisma.compilation.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        attemptCount: nextAttempt,
        attemptedAt: null,
        errorMessage: errorMessage ?? null,
      },
    });
    return NextResponse.json({ success: false, requeued: true, attempt: nextAttempt }, { status: 200 });
  }

  await prisma.compilation.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      attemptCount: nextAttempt,
      errorMessage: errorMessage ?? null,
    },
  });

  // DLVR-03/04: terminal FAILED — notify the buying user (compile-failed email +
  // support link) AND fire the admin alert. Both best-effort; notifyTerminalFailure
  // never throws, so the response contract below is unchanged.
  await notifyTerminalFailure({
    id: jobId,
    attemptCount: nextAttempt,
    errorMessage: errorMessage ?? null,
    userEmail: job.subscription?.user?.email ?? null,
    robotName: job.robot?.name ?? null,
  });

  return NextResponse.json({ success: false, requeued: false, attempt: nextAttempt }, { status: 200 });
}
