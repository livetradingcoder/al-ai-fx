import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { put } from '@vercel/blob';

const prisma = new PrismaClient();

type CompilationCompletePayload = {
  jobId?: string;
  fileDataBase64?: string;
  status?: string;
};

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.COMPILER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      console.error("[Compiler Complete] ERROR: BLOB_READ_WRITE_TOKEN is missing from environment variables.");
      return NextResponse.json({ 
        error: 'Configuration Error', 
        details: 'Vercel Blob storage is not configured. BLOB_READ_WRITE_TOKEN is missing.' 
      }, { status: 500 });
    }

    const rawBody = await req.text();
    console.log(`[Compiler Complete] Received body size: ${rawBody.length} bytes`);
    
    const { jobId, fileDataBase64, status } = JSON.parse(rawBody) as CompilationCompletePayload;

    if (!jobId || !status) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (status === 'COMPLETED' && fileDataBase64) {
      const buffer = Buffer.from(fileDataBase64, 'base64');
      const fileName = `AL-ai-FX_GoldBot_${jobId}.ex5`;
      
      console.log(`[Compiler Complete] Uploading ${fileName} to Vercel Blob...`);
      
      try {
        const blob = await put(`compiled/${fileName}`, buffer, {
          access: 'private',
          contentType: 'application/octet-stream',
          token: blobToken // Explicitly pass the token
        });

        console.log(`[Compiler Complete] Upload successful: ${blob.url}`);

        await prisma.compilation.update({
          where: { id: jobId },
          data: { 
            status: 'COMPLETED',
            downloadUrl: blob.url
          }
        });

        return NextResponse.json({ success: true, url: blob.url }, { status: 200 });
      } catch (blobError) {
        const details = blobError instanceof Error ? blobError.message : String(blobError);
        console.error("Vercel Blob put error:", details);
        return NextResponse.json({ 
          error: 'Upload Failed', 
          details: `Failed to upload to Vercel Blob: ${details}` 
        }, { status: 500 });
      }
    } else {
      await prisma.compilation.update({
        where: { id: jobId },
        data: { status: 'FAILED' }
      });
      return NextResponse.json({ success: false }, { status: 200 });
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("Compile completion error:", details);
    return NextResponse.json({ error: 'Failed', details }, { status: 500 });
  }
}
