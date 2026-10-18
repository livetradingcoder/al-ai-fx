import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { buildLoginRedirectPath } from "@/lib/auth-redirects";
import { noIndexMetadata } from "@/lib/seo";
import { loadPricingFacts } from "@/lib/pricing-facts";
import { buildTutorialArticles, readingTime, TUTORIAL_CATEGORIES } from "@/lib/tutorial-articles";
import "@/components/content/content.css";
import "./tutorials.css";
import { LEGACY_IDS, legacyCard } from "./legacy";
import TutorialsBrowser, { type TutorialIndexItem } from "./TutorialsBrowser";

// Members-only (redirects to login), so keep it out of search results.
export const metadata = noIndexMetadata("Tutorials | GoldBot by AL-ai-FX");

export default async function Tutorials({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(buildLoginRedirectPath(locale, locale === "en" ? "/tutorials" : `/${locale}/tutorials`));
  }

  const t = await getTranslations("Tutorials");

  // The three original tutorials are translated. The help articles are
  // English-only, so (like the FAQ's extra answers) they are listed only on
  // the English site.
  const tutorials: TutorialIndexItem[] = LEGACY_IDS.map((id) => ({
    href: `/tutorials/${id}`,
    category: "setup",
    ...legacyCard(id, t),
  }));
  const articles: TutorialIndexItem[] =
    locale === "en"
      ? buildTutorialArticles(await loadPricingFacts()).map((article) => ({
          href: `/tutorials/${article.slug}`,
          category: article.category,
          title: article.title,
          summary: article.summary,
          duration: readingTime(article),
        }))
      : [];

  const items = [...tutorials, ...articles];
  const categories = TUTORIAL_CATEGORIES.filter((c) => items.some((i) => i.category === c.id));

  return (
    <main className="main-content ca-shell">
      <TutorialsBrowser
        title={t("platformTutorials")}
        subtitle={t("platformTutorialsSubtitle")}
        readLabel={t("readArticle")}
        categories={categories}
        items={items}
      />
    </main>
  );
}
