import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import TutorialArticleView from "@/components/tutorials/TutorialArticleView";
import { authOptions } from "@/lib/auth";
import { buildLoginRedirectPath } from "@/lib/auth-redirects";
import { noIndexMetadata } from "@/lib/seo";
import {
  getTutorialArticle,
  readingTime,
  TUTORIAL_CATEGORIES,
} from "@/lib/tutorial-articles";
import "@/components/content/content.css";
import "../tutorials.css";
import { isLegacyId, LEGACY_IDS, legacyBlocks, legacyCard } from "../legacy";

// Members-only (redirects to login), so keep it out of search results.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const article = getTutorialArticle(id);
  return noIndexMetadata(`${article ? article.title : "Tutorial"} | GoldBot by AL-ai-FX`);
}

const categoryLabel = (id: string) => TUTORIAL_CATEGORIES.find((c) => c.id === id)?.label ?? "Tutorial";

export default async function TutorialDetail({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(
      buildLoginRedirectPath(
        locale,
        locale === "en" ? `/tutorials/${id}` : `/${locale}/tutorials/${id}`,
      ),
    );
  }

  const t = await getTranslations("Tutorials");

  // A help article (English text).
  const article = getTutorialArticle(id);
  if (article) {
    const related = (article.related ?? [])
      .map(getTutorialArticle)
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => ({ href: `/tutorials/${a.slug}`, title: a.title }));

    return (
      <TutorialArticleView
        title={article.title}
        lead={article.summary}
        categoryLabel={categoryLabel(article.category)}
        duration={readingTime(article)}
        blocks={article.blocks}
        links={article.links}
        related={related}
        lang={locale === "en" ? undefined : "en"}
        readLabel={t("readArticle")}
      />
    );
  }

  // One of the three original, translated tutorials.
  if (isLegacyId(id)) {
    const card = legacyCard(id, t);
    return (
      <TutorialArticleView
        title={card.title}
        lead={card.summary}
        categoryLabel={categoryLabel("setup")}
        duration={card.duration}
        blocks={legacyBlocks(id, t)}
        related={LEGACY_IDS.filter((other) => other !== id).map((other) => ({
          href: `/tutorials/${other}`,
          title: legacyCard(other, t).title,
        }))}
        readLabel={t("readArticle")}
      />
    );
  }

  notFound();
}
