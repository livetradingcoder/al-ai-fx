import jwt from "jsonwebtoken";

// One-click unsubscribe for marketing sends (EmailSubscriber list only —
// never used for transactional/account mail). Stateless: no DB-backed token
// table, same NEXTAUTH_SECRET-signed-JWT pattern as magic-links.ts. Long
// expiry because an unsubscribe link in an old email must still work.
const TOKEN_PURPOSE = "marketing-unsubscribe";
const TOKEN_EXPIRY: jwt.SignOptions["expiresIn"] = "5y";

type UnsubscribeTokenPayload = {
  email: string;
  purpose: typeof TOKEN_PURPOSE;
};

export function createUnsubscribeToken(email: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to issue unsubscribe links.");
  }
  const payload: UnsubscribeTokenPayload = { email, purpose: TOKEN_PURPOSE };
  return jwt.sign(payload, secret, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Returns the subscriber's email if the token is valid, otherwise null.
 * Fails closed on any error (expired, malformed, wrong purpose, no secret).
 */
export function verifyUnsubscribeToken(token: string): string | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as UnsubscribeTokenPayload;
    if (payload.purpose !== TOKEN_PURPOSE || !payload.email) return null;
    return payload.email;
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(email: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz";
  const token = createUnsubscribeToken(email);
  const url = new URL("/api/marketing/unsubscribe", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
