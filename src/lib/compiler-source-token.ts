// src/lib/compiler-source-token.ts
//
// Short-TTL HMAC token binding a source-fetch to {robotSlug, version, exp}.
// Mirrors webhook-signature.ts: HMAC-SHA256 keyed by COMPILER_SECRET (no new env
// var), constant-time compare via timingSafeEqual guarded by a length pre-check.
// Fail-closed: a missing secret refuses to sign/verify.
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 5 * 60_000; // 5 minutes

/** Expiry timestamp (ms epoch) for a freshly-minted source token. */
export function sourceTokenExpiry(): number {
  return Date.now() + TTL_MS;
}

function sign(robotSlug: string, version: number, exp: number): string {
  const secret = process.env.COMPILER_SECRET;
  if (!secret) throw new Error("COMPILER_SECRET missing"); // fail-closed
  return createHmac("sha256", secret)
    .update(`${robotSlug}.${version}.${exp}`)
    .digest("hex");
}

/** Sign a source token binding robotSlug + version + exp. */
export function signSourceToken(robotSlug: string, version: number, exp: number): string {
  return sign(robotSlug, version, exp);
}

/**
 * Verify a source token: rejects if expired, if the secret is missing (fail-closed),
 * or if the HMAC does not match. Constant-time compare, length-guarded.
 */
export function verifySourceToken(
  robotSlug: string,
  version: number,
  exp: number,
  token: string,
): boolean {
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  let expected: string;
  try {
    expected = sign(robotSlug, version, exp);
  } catch {
    return false; // missing secret => fail-closed
  }
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
