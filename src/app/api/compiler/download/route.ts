import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompiledFilename } from "@/lib/compiler-filename";
import { objectGet } from "@/lib/object-storage";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return new Response('Missing jobId', { status: 400 });
  }

  try {
    const job = await prisma.compilation.findUnique({
      where: { id: jobId },
      include: { subscription: true, robot: { select: { slug: true } } }
    });

    if (!job || job.subscription.userId !== session.user.id) {
      return new Response('Not Found', { status: 404 });
    }

    if (!job.downloadUrl) {
      return new Response('File not ready', { status: 404 });
    }

    // downloadUrl is a storage KEY (e.g. "compiled/AL-ai-FX_<slug>_<job>.ex5")
    // on S3/MinIO. Legacy rows from the Vercel Blob era hold a full https URL —
    // those artifacts live in the old store and are treated as expired.
    if (job.downloadUrl.startsWith("http")) {
      return new Response('Build artifact expired — request a recompile', { status: 410 });
    }

    const bytes = await objectGet(job.downloadUrl);
    const fileName = getCompiledFilename(jobId, { robotSlug: job.robot.slug });

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
