import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";

import { authOptions } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";
import { loadPricingFacts } from "@/lib/pricing-facts";
import { tutorialGate, tutorialLoginPath, type TutorialAccess } from "@/lib/tutorial-access";
import { buildTutorialArticles, readingTime, TUTORIAL_CATEGORIES } from "@/lib/tutorial-articles";
import "@/components/content/content.css";
import "./tutorials.css";
import { LEGACY_ACCESS, LEGACY_IDS, legacyCard } from "./legacy";
import TutorialsBrowser, { type TutorialIndexItem } from "./TutorialsBrowser";

// The list is open to everyone, so it is indexed. The help articles are
// English-only, so every locale's canonical is the English index.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    path: "/tutorials",
    title: "GoldBot tutorials and help articles | GoldBot by AL-ai-FX",
    description:
      "Plain answers on GoldBot trials, plans and prices, payments and renewals, refunds, prop firm use and trading risk, plus the setup tutorials for customers.",
    englishOnly: true,
  });
}

export default async function Tutorials({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  const signedIn = Boolean(session?.user?.id);

  const t = await getTranslations("Tutorials");

  // A members-only entry is listed for a signed-out visitor too, marked as
  // such and linking to the login, which brings them back to it.
  const entry = (id: string, access: TutorialAccess) =>
    tutorialGate(access, signedIn) === "login"
      ? { href: tutorialLoginPath(locale, id), locked: true }
      : { href: `/tutorials/${id}`, locked: false };

  // The three original tutorials are translated. The help articles are
  // English-only, so (like the FAQ's extra answers) they are listed only on
  // the English site.
  const tutorials: TutorialIndexItem[] = LEGACY_IDS.map((id) => ({
    ...entry(id, LEGACY_ACCESS),
    category: "setup",
    ...legacyCard(id, t),
  }));
  const articles: TutorialIndexItem[] =
    locale === "en"
      ? buildTutorialArticles(await loadPricingFacts()).map((article) => ({
          ...entry(article.slug, article.access),
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
        membersLabel={t("membersBadge")}
        signInLabel={t("signInToRead")}
        categories={categories}
        items={items}
      />
    </main>
  );
}
