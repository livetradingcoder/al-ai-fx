import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";

import { CONTENT_PAGES, GUIDES } from "@/lib/content-pages";
import { breadcrumbJsonLd, buildMetadata, jsonLdScript } from "@/lib/seo";
import "@/components/content/content.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    path: "/guides",
    title: "Gold trading EA guides for MetaTrader 5 | GoldBot",
    description:
      "Practical guides to automated gold trading on MT5: installing an EA, the session breakout strategy, hedging vs martingale, and choosing an EA for a prop firm account.",
    englishOnly: true,
  });
}

export default function GuidesIndex() {
  const landings = CONTENT_PAGES.filter((p) => p.kind === "landing");

  return (
    <main className="main-content ca-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd("en", [
            { name: "Home", path: "/" },
            { name: "Guides", path: "/guides" },
          ]),
        )}
      />
      <header className="ca-hero">
        <div className="ca-container">
          <span className="ca-eyebrow">
            <BookOpen size={13} aria-hidden="true" /> Guides
          </span>
          <h1>Automated gold trading on MT5, explained</h1>
          <p className="ca-lead">
            Plain-English guides to installing an Expert Advisor, how the gold session breakout
            works, and what separates a safe EA from one that can empty an account.
          </p>
        </div>
      </header>

      <section className="ca-container ca-guides">
        {GUIDES.map((guide) => (
          <Link key={guide.slug} href={guide.path} className="ca-guide-card">
            <span className="ca-related-kind">
              <Clock size={13} aria-hidden="true" /> {guide.readingMinutes} min read
            </span>
            <strong>{guide.h1}</strong>
            <p>{guide.description}</p>
            <span className="ca-related-more">
              Read the guide <ArrowRight size={14} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </section>

      <section className="ca-container ca-related" aria-labelledby="ca-more-title">
        <h2 id="ca-more-title">Looking for a robot?</h2>
        <div className="ca-related-grid">
          {landings.map((page) => (
            <Link key={page.slug} href={page.path} className="ca-related-card">
              <span className="ca-related-kind">{page.eyebrow}</span>
              <strong>{page.h1}</strong>
              <span className="ca-related-more">
                Read <ArrowRight size={14} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
