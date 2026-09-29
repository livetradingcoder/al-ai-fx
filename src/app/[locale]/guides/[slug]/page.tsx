import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ContentArticle from "@/components/content/ContentArticle";
import { getContentPage } from "@/lib/content-pages";
import { buildMetadata } from "@/lib/seo";

// Rendered per request like every other page: the root layout reads the
// session and request headers, so pre-rendering these at build time fails at
// runtime with DYNAMIC_SERVER_USAGE. Unknown slugs still 404 via notFound().

function findGuide(slug: string) {
  const page = getContentPage(slug);
  return page?.kind === "guide" ? page : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = findGuide(slug);
  if (!page) return { title: "Guide not found | GoldBot", robots: { index: false, follow: true } };
  return buildMetadata({
    locale,
    path: page.path,
    title: page.title,
    description: page.description,
    type: "article",
    englishOnly: true,
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = findGuide(slug);
  if (!page) notFound();
  return <ContentArticle page={page} />;
}
