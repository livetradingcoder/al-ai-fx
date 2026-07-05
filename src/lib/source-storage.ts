// src/lib/source-storage.ts
//
// Versioned, immutable encrypted-source upload helper.
// Mirrors the Phase 1 @vercel/blob put() convention (addRandomSuffix:false,
// deterministic pathname), but sources are versioned + immutable so allowOverwrite:false.
import { put } from "@vercel/blob";
import { encryptSource } from "./source-encryption";

/** Deterministic Blob pathname for a robot's encrypted source at a given version. */
export function sourceBlobPathname(robotSlug: string, version: number): string {
  return `sources/${robotSlug}/v${version}.mq5.enc`;
}

/**
 * Encrypt an MQL5 source buffer and upload it as an immutable, versioned Blob object.
 * Layout: sources/<robotSlug>/v<N>.mq5.enc  (AES-256-GCM ciphertext).
 * access:"public" is acceptable because the bytes are ciphertext — the encryption IS
 * the access control (matches 01-02 deferred-hardening posture; signed URLs are Phase 4).
 * allowOverwrite:false makes versions immutable — bump N to publish a new source.
 * Do NOT store source bytes or the returned Blob URL in Postgres.
 */
export async function uploadEncryptedSource(
  robotSlug: string,
  version: number,
  mq5: Buffer,
) {
  const enc = encryptSource(mq5);
  return put(sourceBlobPathname(robotSlug, version), enc, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/octet-stream",
  });
}
