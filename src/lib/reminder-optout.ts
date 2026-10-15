import jwt from "jsonwebtoken";

// The unsubscribe link in a setup-reminder email. Stateless like
// marketing-unsubscribe.ts - a NEXTAUTH_SECRET-signed JWT, no token table - but
// keyed to a user rather than an email address, and with its own purpose so a
// newsletter unsubscribe token can't be replayed here or the other way round.
// Long expiry because the link in an old email must still work.
const TOKEN_PURPOSE = "mt5-reminder-optout";
const TOKEN_EXPIRY: jwt.SignOptions["expiresIn"] = "5y";

type OptOutTokenPayload = {
  userId: string;
  purpose: typeof TOKEN_PURPOSE;
};

export function createReminderOptOutToken(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to issue reminder unsubscribe links.");
  }
  const payload: OptOutTokenPayload = { userId, purpose: TOKEN_PURPOSE };
  return jwt.sign(payload, secret, { expiresIn: TOKEN_EXPIRY });
}

/** Returns the user id if the token is valid, otherwise null. Fails closed. */
export function verifyReminderOptOutToken(token: string): string | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as Partial<OptOutTokenPayload>;
    if (payload.purpose !== TOKEN_PURPOSE || !payload.userId) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export function buildReminderOptOutUrl(userId: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz";
  const url = new URL("/api/reminders/unsubscribe", baseUrl);
  url.searchParams.set("token", createReminderOptOutToken(userId));
  return url.toString();
}
