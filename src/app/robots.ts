import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";
import { routing } from "@/i18n/routing";

// Private or transactional routes, in every locale. Auth screens and checkout
// also carry noindex; blocking them here saves crawl budget as well.
const PRIVATE_PATHS = [
  "/api/",
  "/dashboard",
  "/login",
  "/forgot-password",
  "/magic-login",
  "/checkout",
  "/r/",
];

const DISALLOW = [
  ...PRIVATE_PATHS,
  ...routing.locales.flatMap((locale) =>
    PRIVATE_PATHS.filter((p) => p !== "/api/" && p !== "/r/").map((p) => `/${locale}${p}`),
  ),
];

// AI assistants and answer engines. Explicitly allowed so GoldBot can be
// cited in ChatGPT, Claude, Perplexity and Google AI answers; they read
// /llms.txt for a curated summary of the site.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: ["/", "/llms.txt", "/llms-full.txt"], disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: new URL(SITE_URL).host,
  };
}
