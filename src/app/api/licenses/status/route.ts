import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  try {
    const job = await prisma.compilation.findUnique({
      where: { id: jobId },
      include: { subscription: true }
    });

    if (!job || job.subscription.userId !== session.user.id) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      downloadUrl: job.downloadUrl,
      updatedAt: job.updatedAt
    }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Database fail' }, { status: 500 });
  }
}
