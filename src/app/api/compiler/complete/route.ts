import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MAX_ATTEMPTS } from '@/lib/compiler-config';
import { getCompiledBlobPathname } from '@/lib/compiler-filename';
import { objectPut } from '@/lib/object-storage';
import { sendCompileReadyEmail } from '@/lib/mail';
import { buildDashboardMagicLink } from '@/lib/magic-links';
import { notifyTerminalFailure } from '@/lib/compiler-notify';

// 5MB decoded / ~7MB base64 — a compiled .ex5 is well under 1MB.
const MAX_BASE64_CHARS = 10 * 1024 * 1024;
const MAX_DECODED_BYTES = 5 * 1024 * 1024;

type CompletePayload = {
  jobId?: string;
  status?: 'COMPLETED' | 'FAILED';
  /** Daemon uploads the compiled binary inline; the server stores it in S3/MinIO. */
  fileDataBase64?: string;
  /** Legacy Vercel-Blob-era field — no longer accepted for new completions. */
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

  const { jobId, status, fileDataBase64, errorMessage } = body;

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
    // The daemon sends the compiled binary inline (base64); the server owns
    // storage. The daemon never holds storage credentials.
    if (typeof fileDataBase64 !== 'string' || fileDataBase64.length === 0) {
      return NextResponse.json({ error: 'Missing fileDataBase64' }, { status: 400 });
    }
    if (fileDataBase64.length > MAX_BASE64_CHARS) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    const bytes = Buffer.from(fileDataBase64, 'base64');
    if (bytes.length === 0 || bytes.length > MAX_DECODED_BYTES) {
      return NextResponse.json({ error: 'Invalid binary payload' }, { status: 400 });
    }

    // Robot-scoped storage key — /download reads with the SAME slug.
    const storageKey = getCompiledBlobPathname(jobId, { robotSlug: job.robot.slug });
    const digest = createHash('sha256').update(bytes).digest('hex');
    await objectPut(storageKey, bytes, { contentType: 'application/octet-stream' });

    await prisma.compilation.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        downloadUrl: storageKey,
        sha256: digest,
        sizeBytes: bytes.length,
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
