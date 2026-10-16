import { createHash } from "node:crypto";

import { getSharp } from "@/lib/image-tools";
import { objectGet, objectPut } from "@/lib/object-storage";

// Results screenshots. They arrive from a signed-link visitor, so nothing is
// trusted: the bytes are sniffed (not the filename or the declared type),
// decoded and re-encoded - which drops EXIF/GPS and anything hidden in the
// file - and shrunk. Only the re-encoded image is stored, in the private
// bucket; it is served by /api/proofs/[id]/image after review.

export const MAX_PROOF_BYTES = 4 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_EDGE = 1600;

export type ImageKind = "jpeg" | "png" | "webp";

/** The real type of an image from its first bytes, or null if it is not one we accept. */
export function sniffImageType(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export type ProcessedProof =
  | { ok: true; data: Buffer; sha256: string; contentType: "image/webp" }
  | { ok: false; error: string };

export async function processProofImage(input: Buffer): Promise<ProcessedProof> {
  if (input.length === 0) return { ok: false, error: "That file is empty." };
  if (input.length > MAX_PROOF_BYTES) {
    return { ok: false, error: "That image is too large. Use one under 4 MB." };
  }
  if (!sniffImageType(input)) {
    return { ok: false, error: "Upload a JPG, PNG or WebP screenshot." };
  }

  const sharp = await getSharp();
  // Without sharp we cannot strip metadata, so refuse rather than store raw bytes.
  if (!sharp) return { ok: false, error: "Image uploads are unavailable right now. Please try again later." };

  try {
    const data = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate() // apply the EXIF orientation, then metadata is dropped on output
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return {
      ok: true,
      data,
      sha256: createHash("sha256").update(data).digest("hex"),
      contentType: "image/webp",
    };
  } catch {
    return { ok: false, error: "We could not read that image. Try another screenshot." };
  }
}

export function proofImageKey(id: string): string {
  return `proofs/${id}.webp`;
}

export async function storeProofImage(id: string, data: Buffer): Promise<string> {
  const key = proofImageKey(id);
  await objectPut(key, data, { contentType: "image/webp", immutable: true });
  return key;
}

export async function readProofImage(key: string): Promise<Buffer> {
  return objectGet(key);
}
