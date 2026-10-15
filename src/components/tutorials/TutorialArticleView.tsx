import Image from "next/image";
import { ArrowRight, BookOpen, ChevronRight, Clock, Info, LifeBuoy, ShieldAlert } from "lucide-react";

import PropFirmCallout from "@/components/content/PropFirmCallout";
import VpsCallout from "@/components/content/VpsCallout";
import { Link } from "@/i18n/routing";
import type { TutorialBlock } from "@/lib/tutorial-articles";

// One tutorial or help article, in the same layout as the guides (ca-* styles
// from components/content/content.css). The page imports that stylesheet.

export type TutorialRelated = { href: string; title: string };
export type TutorialLink = { label: string; href: string };

function renderBlock(block: TutorialBlock, index: number) {
  switch (block.type) {
    case "h2":
      return (
        <h2 key={index} id={block.id}>
          {block.text}
        </h2>
      );
    case "p":
      return <p key={index}>{block.text}</p>;
    case "list":
      return (
        <ul key={index} className="ca-list">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol key={index} className="ca-steps">
          {block.items.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      );
    case "callout": {
      const Icon = block.tone === "warn" ? ShieldAlert : Info;
      return (
        <aside key={index} className={`ca-callout is-${block.tone}`}>
          <Icon size={18} aria-hidden="true" />
          <div>
            <strong>{block.title}</strong>
            <p>{block.text}</p>
          </div>
        </aside>
      );
    }
    case "vps":
      return <VpsCallout key={index} />;
    case "propfirm":
      return <PropFirmCallout key={index} />;
    case "figure":
      return (
        <figure key={index} className="tu-figure">
          <Image src={block.src} alt={block.alt} width={1200} height={400} unoptimized />
          <figcaption>{block.caption}</figcaption>
        </figure>
      );
    default:
      return null;
  }
}

export default function TutorialArticleView({
  title,
  lead,
  categoryLabel,
  duration,
  blocks,
  links = [],
  related = [],
  lang,
  readLabel,
}: {
  title: string;
  lead?: string;
  categoryLabel: string;
  duration: string;
  blocks: TutorialBlock[];
  links?: TutorialLink[];
  related?: TutorialRelated[];
  /** Set when the article text is in a different language from the page. */
  lang?: string;
  readLabel: string;
}) {
  const toc = blocks.filter((b): b is Extract<TutorialBlock, { type: "h2" }> => b.type === "h2");

  return (
    <main className="main-content ca-shell">
      <header className="ca-hero">
        <div className="ca-container">
          <nav className="ca-crumbs" aria-label="Breadcrumb">
            <span>
              <Link href="/">Home</Link>
              <ChevronRight size={13} aria-hidden="true" />
            </span>
            <span>
              <Link href="/tutorials">Tutorials</Link>
              <ChevronRight size={13} aria-hidden="true" />
            </span>
            <span aria-current="page">{title}</span>
          </nav>
          <span className="ca-eyebrow">{categoryLabel}</span>
          <h1>{title}</h1>
          {lead && <p className="ca-lead">{lead}</p>}
          <p className="ca-meta">
            <Clock size={14} aria-hidden="true" />
            {duration}
          </p>
        </div>
      </header>

      <div className="ca-container ca-layout">
        <article className="ca-body" lang={lang}>
          {blocks.map(renderBlock)}
          {links.length > 0 && (
            <div className="tu-next">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="ca-btn">
                  {link.label}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </article>

        <aside className="ca-side">
          {toc.length > 1 && (
            <nav className="ca-toc" aria-label="On this page">
              <span>On this page</span>
              <ol>
                {toc.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`}>{h.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div className="ca-side-cta">
            <strong>Still stuck?</strong>
            <p>Our team answers setup, licensing and billing questions.</p>
            <Link href="/support" className="ca-btn is-primary">
              <LifeBuoy size={16} aria-hidden="true" />
              Contact support
            </Link>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="ca-container ca-related" aria-labelledby="ca-related-title" style={{ paddingBottom: 96 }}>
          <h2 id="ca-related-title">Keep reading</h2>
          <div className="ca-related-grid">
            {related.map((item) => (
              <Link key={item.href} href={item.href} className="ca-related-card">
                <span className="ca-related-kind">
                  <BookOpen size={13} aria-hidden="true" />
                  Tutorial
                </span>
                <strong>{item.title}</strong>
                <span className="ca-related-more">
                  {readLabel} <ArrowRight size={14} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
