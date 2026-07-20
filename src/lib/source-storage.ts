// src/lib/source-storage.ts
//
// Versioned, immutable encrypted-source storage on S3-compatible object
// storage (MinIO). Layout: sources/<robotSlug>/v<N>.mq5.enc (AES-256-GCM
// ciphertext). Versions are immutable — bump N to publish a new source.
//
// Defence-in-depth: the bucket is private (no public URLs at all) AND the
// bytes are ciphertext; SOURCE_ENCRYPTION_KEY never leaves the server.
import { objectPut, objectGet } from "./object-storage";
import { encryptSource, decryptSource } from "./source-encryption";

/** Deterministic storage key for a robot's encrypted source at a given version. */
export function sourceBlobPathname(robotSlug: string, version: number): string {
  return `sources/${robotSlug}/v${version}.mq5.enc`;
}

/**
 * Encrypt an MQL5 source buffer and upload it as an immutable, versioned object.
 * Do NOT store source bytes or storage URLs in Postgres.
 */
export async function uploadEncryptedSource(
  robotSlug: string,
  version: number,
  mq5: Buffer,
) {
  const enc = encryptSource(mq5);
  return objectPut(sourceBlobPathname(robotSlug, version), enc, {
    contentType: "application/octet-stream",
    immutable: true,
  });
}

/**
 * Read a robot's PRIVATE encrypted source and return DECRYPTED plaintext.
 * Server-only: storage creds and SOURCE_ENCRYPTION_KEY never leave the server.
 * Sources are a few KB, so buffering is correct (GCM needs the full blob anyway).
 */
export async function fetchDecryptedSource(robotSlug: string, version: number): Promise<Buffer> {
  let ciphertext: Buffer;
  try {
    ciphertext = await objectGet(sourceBlobPathname(robotSlug, version));
  } catch {
    throw new Error("source not found");
  }
  return decryptSource(ciphertext); // fail-closed: throws on tamper/wrong key
}
