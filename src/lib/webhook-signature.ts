import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no-secret" | "no-signature" | "bad-length" | "bad-signature" };

/**
 * Fail-closed HMAC-SHA256 verification for Paygate callbacks.
 *
 * Security invariants:
 * - Missing PAYGATE_WEBHOOK_SECRET => refuse (no-secret) unless a TWO-KEY dev
 *   bypass is explicitly set (NODE_ENV !== "production" AND
 *   PAYGATE_ALLOW_INSECURE_WEBHOOK === "1"). Either key alone is NOT enough.
 * - Constant-time comparison via timingSafeEqual, guarded by a length pre-check
 *   (timingSafeEqual throws on length mismatch, which would itself leak length).
 */
export function verifyPaygateSignature(
  payload: string,
  providedSig: string | null | undefined,
): VerifyResult {
  const secret = process.env.PAYGATE_WEBHOOK_SECRET;

  if (!secret) {
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.PAYGATE_ALLOW_INSECURE_WEBHOOK === "1"
    ) {
      console.warn(
        "[paygate] insecure webhook bypass enabled — DEV ONLY (NODE_ENV=%s)",
        process.env.NODE_ENV,
      );
      return { ok: true };
    }
    console.error(
      "[paygate] PAYGATE_WEBHOOK_SECRET missing — refusing webhook (NODE_ENV=%s)",
      process.env.NODE_ENV,
    );
    return { ok: false, reason: "no-secret" };
  }

  if (!providedSig) return { ok: false, reason: "no-signature" };

  const expected = Buffer.from(
    createHmac("sha256", secret).update(payload).digest("hex"),
    "utf8",
  );
  const provided = Buffer.from(providedSig, "utf8");

  if (expected.length !== provided.length) return { ok: false, reason: "bad-length" };

  return timingSafeEqual(expected, provided)
    ? { ok: true }
    : { ok: false, reason: "bad-signature" };
}
