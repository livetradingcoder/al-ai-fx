import Link from "next/link";
import { ArrowRight, FileText, LifeBuoy, Mail } from "lucide-react";
import "./site-pages.css";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

const LEGAL_PAGES = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-conditions", label: "Terms & Conditions" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/disclaimer", label: "Disclaimer" },
];

/**
 * Shared layout for the legal pages. It only presents the text: every page
 * passes its own wording through unchanged.
 */
export default function LegalDocument({
  path,
  title,
  updated,
  intro,
  sections,
  highlight,
}: {
  path: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  /** Optional key point shown above the sections (e.g. the refund guarantee). */
  highlight?: { title: string; text: string };
}) {
  return (
    <main className="main-content sp-shell">
      <header className="sp-hero">
        <div className="sp-container">
          <span className="sp-eyebrow">
            <FileText size={13} aria-hidden="true" />
            Legal
          </span>
          <h1>{title}</h1>
          <p className="sp-lead">{intro}</p>
          <p className="sp-meta">Last updated: {updated}</p>
        </div>
      </header>

      <div className="sp-container sp-doc-layout">
        <aside className="sp-doc-side">
          <nav className="sp-toc" aria-label="On this page">
            <span>On this page</span>
            <ol>
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>
                    <em>{String(index + 1).padStart(2, "0")}</em>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <nav className="sp-toc" aria-label="Other policies">
            <span>Policies</span>
            <ul>
              {LEGAL_PAGES.map((page) => (
                <li key={page.href}>
                  <Link href={page.href} aria-current={page.href === path ? "page" : undefined}>
                    {page.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <article className="sp-doc">
          {highlight && (
            <div className="sp-highlight">
              <strong>{highlight.title}</strong>
              <p>{highlight.text}</p>
            </div>
          )}

          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="sp-doc-section">
              <h2>
                <em>{String(index + 1).padStart(2, "0")}</em>
                {section.title}
              </h2>
              <div className="sp-doc-body">{section.body}</div>
            </section>
          ))}

          <div className="sp-doc-contact">
            <LifeBuoy size={20} aria-hidden="true" />
            <div>
              <strong>Questions about this policy?</strong>
              <p>Our team will explain anything here in plain language.</p>
            </div>
            <div className="sp-doc-contact-actions">
              <a href="mailto:support@AL-ai-FX.com" className="sp-btn">
                <Mail size={15} aria-hidden="true" />
                Email us
              </a>
              <Link href="/support" className="sp-btn is-primary">
                Support center
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
