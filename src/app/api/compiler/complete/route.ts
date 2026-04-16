import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

import { put } from '@vercel/blob';

const prisma = new PrismaClient();

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
    
    const { jobId, fileDataBase64, status } = JSON.parse(rawBody);

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
      } catch (blobError: any) {
        console.error("Vercel Blob put error:", blobError.message || blobError);
        return NextResponse.json({ 
          error: 'Upload Failed', 
          details: `Failed to upload to Vercel Blob: ${blobError.message}` 
        }, { status: 500 });
      }
    } else {
      await prisma.compilation.update({
        where: { id: jobId },
        data: { status: 'FAILED' }
      });
      return NextResponse.json({ success: false }, { status: 200 });
    }
  } catch (error: any) {
    console.error("Compile completion error:", error.message || error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}
