import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { head } from '@vercel/blob';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions) as any;
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
      include: { subscription: true }
    });

    if (!job || job.subscription.userId !== session.user.id) {
      return new Response('Not Found', { status: 404 });
    }

    if (!job.downloadUrl) {
      return new Response('File not ready', { status: 404 });
    }

    // Fetch the blob metadata to get the actual direct URL if needed, 
    // or just fetch the blob and stream it.
    // For Vercel Blob private, we can fetch the blob content with the token.
    
    const response = await fetch(job.downloadUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.statusText}`);
    }

    const blob = await response.blob();
    const fileName = `GoldBot_v2.0_${jobId}.ex5`;

    return new Response(blob, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Download error:", error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
