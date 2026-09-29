// Pages that run the new flat design system and therefore get the landing
// navbar and footer. Every other page keeps the classic chrome until it is
// redesigned too — add a route here when its page is converted.
const EXACT = ["/", "/catalog", "/features", "/faq", "/affiliates", "/login", "/forgot-password", "/magic-login", "/gold-ea-mt5", "/prop-firm-gold-ea",
  "/privacy-policy", "/terms-conditions", "/refund-policy", "/disclaimer", "/support", "/licensing", "/roadmap"];
const PREFIXES = ["/checkout", "/guides"];

export function usesNewDesign(pathname: string): boolean {
  return EXACT.includes(pathname) || PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
