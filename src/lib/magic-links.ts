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
