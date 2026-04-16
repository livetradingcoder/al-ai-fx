import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.COMPILER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { jobId, fileDataBase64, status } = await req.json();

    if (status === 'COMPLETED' && fileDataBase64) {
      const buffer = Buffer.from(fileDataBase64, 'base64');
      const fileName = `AL-ai-FX_GoldBot_${jobId}.ex5`;
      const uploadsDir = path.join(process.cwd(), 'public', 'compiled');
      const publicPath = path.join(uploadsDir, fileName);
      
      if (!fs.existsSync(uploadsDir)){
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.writeFileSync(publicPath, buffer);

      await prisma.compilation.update({
        where: { id: jobId },
        data: { 
          status: 'COMPLETED',
          downloadUrl: `/compiled/${fileName}`
        }
      });

      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      await prisma.compilation.update({
        where: { id: jobId },
        data: { status: 'FAILED' }
      });
      return NextResponse.json({ success: false }, { status: 200 });
    }
  } catch (error) {
    console.error("Compile completion error", error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
