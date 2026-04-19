import { buildLocalizedPath } from "@/lib/seo";

export function buildLoginRedirectPath(locale: string, callbackUrl: string) {
  const loginPath = buildLocalizedPath(locale, "/login");
  return `${loginPath}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
