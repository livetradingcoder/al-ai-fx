// src/lib/source-storage.ts
//
// Versioned, immutable encrypted-source upload helper.
// Mirrors the Phase 1 @vercel/blob put() convention (addRandomSuffix:false,
// deterministic pathname), but sources are versioned + immutable so allowOverwrite:false.
//
// access:"private" because the Blob store is configured private-access (the store now
// rejects public puts). Combined with AES-256-GCM ciphertext this is defence-in-depth:
// authenticated retrieval AND encrypted bytes. Signed-URL read-path is Phase 4/SRCE-02.
import { put } from "@vercel/blob";
import { encryptSource } from "./source-encryption";

/** Deterministic Blob pathname for a robot's encrypted source at a given version. */
export function sourceBlobPathname(robotSlug: string, version: number): string {
  return `sources/${robotSlug}/v${version}.mq5.enc`;
}

/**
 * Encrypt an MQL5 source buffer and upload it as an immutable, versioned Blob object.
 * Layout: sources/<robotSlug>/v<N>.mq5.enc  (AES-256-GCM ciphertext).
 * access:"private" — the store is private-access; the bytes are also ciphertext, so this
 * is defence-in-depth. Signed-URL read-path hardening is deferred to Phase 4/SRCE-02.
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
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/octet-stream",
  });
}
