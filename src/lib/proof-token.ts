import jwt from "jsonwebtoken";

// The secret link a trial user follows to submit their results. Stateless like
// reminder-optout.ts - a NEXTAUTH_SECRET-signed JWT, no token table - with its
// own purpose so no other token (magic link, unsubscribe) can be replayed here.
// It identifies the person and the licence, and lets them upload a screenshot
// and a share link without signing in. It cannot read anything but their own
// submission status.
const TOKEN_PURPOSE = "results-portal";
const TOKEN_EXPIRY: jwt.SignOptions["expiresIn"] = "45d";

export type ProofTokenPayload = {
  userId: string;
  subscriptionId: string;
  purpose: typeof TOKEN_PURPOSE;
};

export function createProofToken(input: { userId: string; subscriptionId: string }): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to issue results portal links.");
  }
  const payload: ProofTokenPayload = {
    userId: input.userId,
    subscriptionId: input.subscriptionId,
    purpose: TOKEN_PURPOSE,
  };
  return jwt.sign(payload, secret, { expiresIn: TOKEN_EXPIRY });
}

/** Returns the person and licence if the token is valid, otherwise null. Fails closed. */
export function verifyProofToken(token: string): { userId: string; subscriptionId: string } | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret) as Partial<ProofTokenPayload>;
    if (payload.purpose !== TOKEN_PURPOSE || !payload.userId || !payload.subscriptionId) return null;
    return { userId: payload.userId, subscriptionId: payload.subscriptionId };
  } catch {
    return null;
  }
}

export function buildProofPortalUrl(input: { userId: string; subscriptionId: string }): string {
  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz").replace(/\/+$/, "");
  const url = new URL("/results/submit", baseUrl);
  url.searchParams.set("token", createProofToken(input));
  return url.toString();
}
