import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ContentArticle from "@/components/content/ContentArticle";
import { GUIDES, getContentPage } from "@/lib/content-pages";
import { buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

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
