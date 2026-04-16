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
    }

    const { jobId, fileDataBase64, status } = await req.json();

    if (status === 'COMPLETED' && fileDataBase64) {
      const buffer = Buffer.from(fileDataBase64, 'base64');
      const fileName = `AL-ai-FX_GoldBot_${jobId}.ex5`;
      
      console.log(`[Compiler Complete] Uploading ${fileName} to Vercel Blob...`);
      
      const blob = await put(`compiled/${fileName}`, buffer, {
        access: 'public',
        contentType: 'application/octet-stream',
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
