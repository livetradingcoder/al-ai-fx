import type { MetadataRoute } from "next";

import { getPublicSitemapEntries, buildLocalizedUrl } from "@/lib/seo";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";

// Catalog + per-robot pages are DB-driven (English-only copy, no PublicPageKey),
// so they're appended here instead of living in seo.ts's static page registry.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = getPublicSitemapEntries();

  let robotSlugs: string[] = [];
  try {
    const robots = await prisma.robot.findMany({
      where: { active: true },
      select: { slug: true },
    });
    robotSlugs = robots.map((r) => r.slug);
  } catch {
    // DB unavailable at build/render time — ship the static entries alone
    // rather than failing the whole sitemap.
  }

  const dynamicPaths = ["/catalog", ...robotSlugs.map((slug) => `/robots/${slug}`)];
  const lastModified = new Date();

  for (const pathname of dynamicPaths) {
    for (const locale of routing.locales) {
      entries.push({
        url: buildLocalizedUrl(locale, pathname),
        lastModified,
        changeFrequency: "weekly",
        priority: pathname === "/catalog" ? 0.8 : 0.7,
      });
    }
  }

  return entries;
}
