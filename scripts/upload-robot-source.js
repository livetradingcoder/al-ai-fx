/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * General-purpose source uploader for onboarding a robot's versioned .mq5.
 * AES-256-GCM layout [12 IV][16 tag][ct] at sources/<slug>/v<N>.mq5.enc on
 * S3-compatible storage (MinIO). Post-Vercel migration: uses S3_* env, not
 * @vercel/blob.
 *
 * Usage: node scripts/upload-robot-source.js <slug> </path/to/source.mq5> [version]
 * Env:   S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET,
 *        SOURCE_ENCRYPTION_KEY  (loaded from .env.local when present)
 */
const fs = require('fs');
const path = require('path');
const { createCipheriv, randomBytes } = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      let v = m[2] || '';
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  });
}

function encrypt(plain) {
  const hex = process.env.SOURCE_ENCRYPTION_KEY;
  if (!hex) throw new Error('SOURCE_ENCRYPTION_KEY missing');
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('SOURCE_ENCRYPTION_KEY must be 32 bytes (64 hex)');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]); // [12 IV][16 tag][ct]
}

async function main() {
  const slug = process.argv[2];
  const srcPath = process.argv[3];
  const version = Number(process.argv[4] || 1);
  if (!slug || !srcPath) throw new Error('Usage: node scripts/upload-robot-source.js <slug> <path.mq5> [version]');
  for (const k of ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET']) {
    if (!process.env[k]) throw new Error(`${k} missing`);
  }

  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  const mq5 = fs.readFileSync(srcPath);
  const enc = encrypt(mq5);
  const key = `sources/${slug}/v${version}.mq5.enc`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: enc,
    ContentType: 'application/octet-stream',
    IfNoneMatch: '*', // immutable versions — bump N to publish a new source
  }));
  console.log(`[upload-robot-source] ${slug}: uploaded ${enc.length} bytes (plain ${mq5.length}) -> ${key}`);
}

main().catch((e) => { console.error('[upload-robot-source] FAILED:', e); process.exit(1); });
