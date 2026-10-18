import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import TutorialArticleView from "@/components/tutorials/TutorialArticleView";
import { authOptions } from "@/lib/auth";
import { buildMetadata, noIndexMetadata } from "@/lib/seo";
import { loadPricingFacts } from "@/lib/pricing-facts";
import { tutorialGate, tutorialLoginPath } from "@/lib/tutorial-access";
import {
  getTutorialArticle,
  readingTime,
  TUTORIAL_CATEGORIES,
} from "@/lib/tutorial-articles";
import "@/components/content/content.css";
import "../tutorials.css";
import { isLegacyId, LEGACY_ACCESS, LEGACY_IDS, legacyBlocks, legacyCard } from "../legacy";

// A public article is indexed under its English URL (the text is English-only);
// everything else here is members-only and stays out of search results.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const article = getTutorialArticle(id, await loadPricingFacts());
  if (article?.access === "public") {
    return buildMetadata({
      locale,
      path: `/tutorials/${article.slug}`,
      title: `${article.title} | GoldBot by AL-ai-FX`,
      description: article.summary,
      type: "article",
      englishOnly: true,
    });
  }
  return noIndexMetadata(`${article ? article.title : "Tutorial"} | GoldBot by AL-ai-FX`);
}

const categoryLabel = (id: string) => TUTORIAL_CATEGORIES.find((c) => c.id === id)?.label ?? "Tutorial";

export default async function TutorialDetail({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params;
  const session = await getServerSession(authOptions);
  const signedIn = Boolean(session?.user?.id);

  const t = await getTranslations("Tutorials");

  // A help article (English text). Its prices come from the live catalog.
  const facts = await loadPricingFacts();
  const article = getTutorialArticle(id, facts);

  const gate = tutorialGate(article ? article.access : isLegacyId(id) ? LEGACY_ACCESS : undefined, signedIn);
  if (gate === "not-found") notFound();
  if (gate === "login") redirect(tutorialLoginPath(locale, id));

  if (article) {
    // Members-only neighbours are still offered to a signed-out reader, marked
    // and pointing at the login.
    const related = (article.related ?? [])
      .map((slug) => getTutorialArticle(slug, facts))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) =>
        tutorialGate(a.access, signedIn) === "login"
          ? { href: tutorialLoginPath(locale, a.slug), title: a.title, locked: true }
          : { href: `/tutorials/${a.slug}`, title: a.title },
      );

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
        membersLabel={t("membersBadge")}
        signInLabel={t("signInToRead")}
      />
    );
  }

  // One of the three original, translated tutorials (members-only, so only
  // reached signed in).
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
