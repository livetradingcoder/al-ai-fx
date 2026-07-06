import jwt from "jsonwebtoken";

import { buildLocalizedPath } from "@/lib/seo";

type MagicLinkPurpose = "login" | "reset";

export type MagicLinkPayload = {
  email: string;
  purpose: MagicLinkPurpose;
  userId: string;
};

type BuildMagicLinkUrlInput = {
  baseUrl: string;
  callbackUrl?: string;
  locale?: string;
  token: string;
};

export function createMagicLinkToken(
  payload: MagicLinkPayload,
  secret: string,
  expiresIn: jwt.SignOptions["expiresIn"] = "30m",
) {
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyMagicLinkToken(token: string, secret: string) {
  return jwt.verify(token, secret) as MagicLinkPayload;
}

export function buildMagicLinkUrl({
  baseUrl,
  callbackUrl,
  locale = "en",
  token,
}: BuildMagicLinkUrlInput) {
  const pathname = buildLocalizedPath(locale, "/magic-login");
  const url = new URL(pathname, baseUrl);

  url.searchParams.set("token", token);

  if (callbackUrl) {
    url.searchParams.set("callbackUrl", callbackUrl);
  }

  return url.toString();
}

/**
 * Builds a signed, expiring magic-link URL that lands a user authenticated in
 * their dashboard. Reuses the NEXTAUTH_SECRET-signed magic-link JWT (default
 * 30m expiry). Single implementation reused by subscriptions.ts (purchase
 * confirmation) and the compile-ready delivery email — do NOT hand-roll a new
 * token or public download route.
 */
export function buildDashboardMagicLink(input: { email: string; userId: string }) {
  const secret = process.env.NEXTAUTH_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz";
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to issue magic links.");
  }
  const token = createMagicLinkToken(
    { email: input.email, purpose: "login", userId: input.userId },
    secret,
  );
  return buildMagicLinkUrl({ baseUrl, locale: "en", token });
}
