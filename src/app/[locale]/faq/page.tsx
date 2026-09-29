import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getPageMetadata } from "@/lib/seo";
import FaqBrowser, { type FaqItem } from "./FaqBrowser";
import { CATEGORIES, EXTRA_EN } from "@/lib/faq-content";
import "./faq.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("faq", locale);
}

export default async function FAQ() {
  const t = await getTranslations("FAQ");
  const locale = await getLocale();

  const translated: FaqItem[] = [
    { id: "compilation", category: "start", q: t("q1"), a: t("a1") },
    { id: "accounts", category: "licence", q: t("q2"), a: t("a2") },
    { id: "expiry", category: "licence", q: t("q3"), a: t("a3") },
    { id: "prop-firms", category: "trading", q: t("q4"), a: t("a4") },
  ];

  const items = locale === "en" ? [...translated, ...EXTRA_EN] : translated;
  // Keep each category's questions together, in category order.
  const ordered = CATEGORIES.flatMap((c) => items.filter((i) => i.category === c.id));
  const categories = CATEGORIES.filter((c) => ordered.some((i) => i.category === c.id));

  // FAQPage structured data so search engines can show these answers.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: ordered.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <main className="main-content fq-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <FaqBrowser
        title={t("title")}
        subtitle={t("subtitle")}
        stillHaveQuestions={t("stillHaveQuestions")}
        contactSupport={t("contactSupport")}
        categories={categories}
        items={ordered}
      />
    </main>
  );
}
