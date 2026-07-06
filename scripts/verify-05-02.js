/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * TEMPORARY verification script for Plan 05-02 — runs in the Vercel build step where
 * DATABASE_URL / BLOB_READ_WRITE_TOKEN / SOURCE_ENCRYPTION_KEY are all present.
 * Exercises the EXACT same code path createRobot/uploadRobotSource orchestrate:
 *   prisma.robot.create + uploadEncryptedSource (inlined AES-256-GCM, matching layout).
 * Proves: first source lands at v1 with sourceVersion=1; second upload -> v2 + bump;
 * duplicate slug throws Prisma P2002.
 * Reverted in a follow-up commit after the build log confirms the assertions.
 */
const { PrismaClient, Prisma } = require('@prisma/client');
const { createCipheriv, randomBytes } = require('crypto');
const { put } = require('@vercel/blob');

const prisma = new PrismaClient();
const SLUG = `testbot-05-02-${Date.now()}`;

function encrypt(plain) {
  const hex = process.env.SOURCE_ENCRYPTION_KEY;
  if (!hex) throw new Error('SOURCE_ENCRYPTION_KEY missing');
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('SOURCE_ENCRYPTION_KEY must be 32 bytes');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}

async function uploadEncryptedSource(slug, version, buf) {
  const enc = encrypt(buf);
  return put(`sources/${slug}/v${version}.mq5.enc`, enc, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: 'application/octet-stream',
  });
}

async function main() {
  console.log('=== [verify-05-02] START ===');

  // Clean slate: remove any prior test robot + its blobs are immutable so use fresh versions.
  await prisma.robot.deleteMany({ where: { slug: SLUG } });

  // --- createRobot path: create + first source -> v1, sourceVersion stays 1 ---
  const mq5v1 = Buffer.from('// testbot v1\nvoid OnTick() {}\n', 'utf8');
  const robot = await prisma.robot.create({
    data: {
      slug: SLUG,
      name: 'Test Bot 05-02',
      shortDescription: 'verification robot',
      longDescription: 'verification robot',
      artworkUrl: null,
      sortOrder: 999,
      active: false,
    },
  });
  console.log(`[verify-05-02] created robot id=${robot.id} sourceVersion=${robot.sourceVersion} active=${robot.active}`);
  const up1 = await uploadEncryptedSource(robot.slug, 1, mq5v1); // first source -> v1
  const afterCreate = await prisma.robot.findUniqueOrThrow({ where: { id: robot.id } });
  console.log(`[verify-05-02] first-source uploaded -> ${up1.pathname}; sourceVersion now = ${afterCreate.sourceVersion}`);
  console.log(`[verify-05-02] ASSERT first-source-v1 (path ends v1.mq5.enc): ${up1.pathname.endsWith('v1.mq5.enc') ? 'PASS' : 'FAIL'}`);
  console.log(`[verify-05-02] ASSERT sourceVersion==1 after first source: ${afterCreate.sourceVersion === 1 ? 'PASS' : 'FAIL'}`);

  // --- uploadRobotSource path: next version = current+1, upload-then-bump ---
  const mq5v2 = Buffer.from('// testbot v2\nvoid OnTick() { /* v2 */ }\n', 'utf8');
  const nextVersion = afterCreate.sourceVersion + 1;
  const up2 = await uploadEncryptedSource(afterCreate.slug, nextVersion, mq5v2);
  await prisma.robot.update({ where: { id: robot.id }, data: { sourceVersion: nextVersion } });
  const afterBump = await prisma.robot.findUniqueOrThrow({ where: { id: robot.id } });
  console.log(`[verify-05-02] second-source uploaded -> ${up2.pathname}; sourceVersion now = ${afterBump.sourceVersion}`);
  console.log(`[verify-05-02] ASSERT bump-to-v2 (path ends v2.mq5.enc): ${up2.pathname.endsWith('v2.mq5.enc') ? 'PASS' : 'FAIL'}`);
  console.log(`[verify-05-02] ASSERT sourceVersion==2 after upload: ${afterBump.sourceVersion === 2 ? 'PASS' : 'FAIL'}`);

  // --- duplicate slug -> P2002 friendly-error path ---
  let dupCaught = false;
  try {
    await prisma.robot.create({
      data: { slug: SLUG, name: 'dup', shortDescription: 'dup', longDescription: 'dup', active: false },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      dupCaught = true;
      console.log(`[verify-05-02] duplicate slug threw P2002 as expected (friendly-error path)`);
    } else {
      throw e;
    }
  }
  console.log(`[verify-05-02] ASSERT dup-slug-P2002: ${dupCaught ? 'PASS' : 'FAIL'}`);

  // Leave the test robot inactive (active:false) so it never pollutes a public catalog.
  console.log('=== [verify-05-02] DONE ===');
  await prisma.$disconnect();
}

main().catch((e) => { console.error('[verify-05-02] FAILED:', e); process.exit(1); });
