import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ContentArticle from "@/components/content/ContentArticle";
import { getContentPage } from "@/lib/content-pages";
import { buildMetadata } from "@/lib/seo";

const SLUG = "prop-firm-gold-ea";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const page = getContentPage(SLUG)!;
  return buildMetadata({
    locale,
    path: page.path,
    title: page.title,
    description: page.description,
    type: "article",
    englishOnly: true,
  });
}

export default function Page() {
  const page = getContentPage(SLUG);
  if (!page) notFound();
  return <ContentArticle page={page} />;
}
