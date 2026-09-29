import type { MetadataRoute } from "next";

import {
  buildLocalizedUrl,
  getPathAlternates,
  getPublicSitemapEntries,
  SITE_LAST_MODIFIED,
} from "@/lib/seo";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { CONTENT_PAGES } from "@/lib/content-pages";

// Pages outside seo.ts's PublicPageKey registry (English copy, own canonical).
// Private or gated routes — dashboard, auth screens, checkout, tutorials —
// are deliberately absent: they are noindex and would only waste crawl budget.
const EXTRA_PAGES: {
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
}[] = [
  { path: "/catalog", changeFrequency: "weekly", priority: 0.9 },
  { path: "/features", changeFrequency: "monthly", priority: 0.8 },
  { path: "/affiliates", changeFrequency: "monthly", priority: 0.6 },
  { path: "/licensing", changeFrequency: "monthly", priority: 0.5 },
  { path: "/roadmap", changeFrequency: "weekly", priority: 0.5 },
];

function localizedEntries(
  path: string,
  options: { lastModified: Date; changeFrequency: "daily" | "weekly" | "monthly"; priority: number },
): MetadataRoute.Sitemap {
  const languages = getPathAlternates(path);
  return routing.locales.map((locale) => ({
    url: buildLocalizedUrl(locale, path),
    ...options,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = getPublicSitemapEntries();

  for (const page of EXTRA_PAGES) {
    entries.push(
      ...localizedEntries(page.path, {
        lastModified: SITE_LAST_MODIFIED,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      }),
    );
  }

  // Guides and search landing pages exist in English only, so they are listed
  // once, at their English URL (their other-locale URLs canonicalise to it).
  for (const page of [{ path: "/guides", updated: "2026-09-29" }, ...CONTENT_PAGES]) {
    entries.push({
      url: buildLocalizedUrl(routing.defaultLocale, page.path),
      lastModified: new Date(page.updated),
      changeFrequency: "monthly",
      priority: page.path === "/gold-ea-mt5" ? 0.9 : 0.7,
    });
  }

  // Robot detail pages. Only robots that can actually be bought: a
  // coming-soon robot has no active price and is covered by /roadmap.
  try {
    const robots = await prisma.robot.findMany({
      where: { active: true, prices: { some: { active: true } } },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    });
    for (const robot of robots) {
      entries.push(
        ...localizedEntries(`/robots/${robot.slug}`, {
          lastModified: robot.updatedAt,
          changeFrequency: "weekly",
          priority: 0.8,
        }),
      );
    }
  } catch {
    // DB unavailable at build/render time — ship the static entries alone
    // rather than failing the whole sitemap.
  }

  return entries;
}
