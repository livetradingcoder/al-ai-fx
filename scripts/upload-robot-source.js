/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * General-purpose source uploader for onboarding a new robot's v1 .mq5.
 * Mirrors scripts/upload-goldbot-source.js (same AES-256-GCM layout, same .env.local loader).
 *
 * Usage: node scripts/upload-robot-source.js <slug> </path/to/source.mq5>
 */
const fs = require('fs');
const path = require('path');
const { createCipheriv, randomBytes } = require('crypto');
const { put } = require('@vercel/blob');

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
  if (!slug || !srcPath) throw new Error('Usage: node scripts/upload-robot-source.js <slug> <path.mq5>');
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN missing (vercel env pull)');

  const mq5 = fs.readFileSync(srcPath);
  const enc = encrypt(mq5);
  const pathname = `sources/${slug}/v1.mq5.enc`;
  const res = await put(pathname, enc, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: 'application/octet-stream',
  });
  console.log(`[upload-robot-source] ${slug}: uploaded ${enc.length} bytes (plain ${mq5.length}) → ${res.pathname}`);
}

main().catch((e) => { console.error('[upload-robot-source] FAILED:', e); process.exit(1); });
