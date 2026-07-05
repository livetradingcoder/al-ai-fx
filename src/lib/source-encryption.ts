// src/lib/source-encryption.ts
//
// AES-256-GCM authenticated encryption for MQL5 source-at-rest.
// GCM is authenticated encryption in one primitive — do NOT hand-roll CBC + HMAC.
// Blob layout: [12-byte IV][16-byte authTag][ciphertext].
// Key comes from SOURCE_ENCRYPTION_KEY (64 hex chars = 32 bytes); fail-closed.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV — GCM standard, random per encryption, never reused
const TAG_BYTES = 16;

function getKey(): Buffer {
  const hex = process.env.SOURCE_ENCRYPTION_KEY;
  if (!hex) throw new Error("SOURCE_ENCRYPTION_KEY missing"); // fail-closed
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("SOURCE_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  }
  return key;
}

// Layout: [12-byte IV][16-byte authTag][ciphertext]
export function encryptSource(plaintext: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decryptSource(blob: Buffer): Buffer {
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = blob.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]); // throws on tamper
}
