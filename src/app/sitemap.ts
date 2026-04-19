import type { MetadataRoute } from "next";

import { getPublicSitemapEntries } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return getPublicSitemapEntries();
}
