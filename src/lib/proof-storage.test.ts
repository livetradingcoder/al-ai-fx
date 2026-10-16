import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

import { MAX_PROOF_BYTES, processProofImage, proofImageKey, sniffImageType } from "./proof-storage";

async function png(width = 40, height = 30) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 160, b: 40 } } }).png().toBuffer();
}

test("sniffs real image bytes and ignores everything else", async () => {
  assert.equal(sniffImageType(await png()), "png");
  const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).jpeg().toBuffer();
  assert.equal(sniffImageType(jpeg), "jpeg");
  const webp = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).webp().toBuffer();
  assert.equal(sniffImageType(webp), "webp");
  assert.equal(sniffImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), null);
  assert.equal(sniffImageType(Buffer.from("GIF89a....")), null);
  assert.equal(sniffImageType(Buffer.from("MZ executable")), null);
  assert.equal(sniffImageType(Buffer.alloc(0)), null);
});

test("re-encodes to webp and fingerprints the result", async () => {
  const r = await processProofImage(await png());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.contentType, "image/webp");
  assert.equal(sniffImageType(r.data), "webp");
  assert.match(r.sha256, /^[0-9a-f]{64}$/);
  const again = await processProofImage(await png());
  assert.equal(again.ok && again.sha256, r.sha256);
});

test("shrinks a large screenshot to the maximum edge", async () => {
  const r = await processProofImage(await png(3000, 1200));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const meta = await sharp(r.data).metadata();
  assert.equal(meta.width, 1600);
  assert.equal(meta.height, 640);
});

test("drops metadata", async () => {
  const withExif = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#123" } })
    .withExif({ IFD0: { Copyright: "secret-location" } })
    .jpeg()
    .toBuffer();
  assert.ok((await sharp(withExif).metadata()).exif);
  const r = await processProofImage(withExif);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal((await sharp(r.data).metadata()).exif, undefined);
});

test("refuses empty, oversized, non-image and corrupt files", async () => {
  assert.equal((await processProofImage(Buffer.alloc(0))).ok, false);
  assert.equal((await processProofImage(Buffer.alloc(MAX_PROOF_BYTES + 1, 1))).ok, false);
  assert.equal((await processProofImage(Buffer.from("not an image at all"))).ok, false);
  const truncated = (await png()).subarray(0, 30);
  assert.equal((await processProofImage(truncated)).ok, false);
});

test("the storage key lives under proofs/", () => {
  assert.equal(proofImageKey("abc"), "proofs/abc.webp");
});
