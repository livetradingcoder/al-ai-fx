/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * One-time uploader: fetch GoldBot .mq5 (already pulled to a local path from the VM),
 * encrypt with AES-256-GCM, upload as sources/goldbot/v1.mq5.enc in Vercel Blob.
 * Mirrors scripts/test-blob.js (.env.local loader + BLOB_READ_WRITE_TOKEN).
 * Inlines the crypto (matches source-encryption.ts's [12 IV][16 tag][ct] layout) so this
 * CJS script needs no TS/ESM build step.
 *
 * Usage: node scripts/upload-goldbot-source.js [/path/to/base_ea_source.mq5]
 */
const fs = require('fs');
const path = require('path');
const { createCipheriv, randomBytes } = require('crypto');
const { put } = require('@vercel/blob');

// Load .env.local (same loader as scripts/test-blob.js)
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
  const srcPath = process.argv[2] || '/tmp/goldbot_base_ea_source.mq5';
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN missing (vercel env pull)');
  const mq5 = fs.readFileSync(srcPath);
  const enc = encrypt(mq5);
  const res = await put('sources/goldbot/v1.mq5.enc', enc, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: 'application/octet-stream',
  });
  console.log(`[upload-goldbot-source] uploaded ${enc.length} bytes → ${res.pathname} (${res.url})`);
}

main().catch((e) => { console.error('[upload-goldbot-source] FAILED:', e); process.exit(1); });
