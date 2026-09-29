import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import { ArrowRight, BookOpen, ChevronRight, Clock, Info, ShieldAlert } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { CATALOG_PUBLIC_TIERS } from "@/lib/catalog-tiers";
import { FLAGSHIP_ROBOT } from "@/config/pricing";
import { getContentPage, type Block, type ContentPage } from "@/lib/content-pages";
import { articleJsonLd, breadcrumbJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/seo";
import "./content.css";

// Robots named "prop firm compatible" in their own descriptions.
const PROP_FIRM_SLUGS = ["gold-multirange-4", "gold-multirange-7"];

async function loadRobots(filter?: "prop-firm") {
  try {
    const rows = await prisma.robot.findMany({
      where: {
        active: true,
        prices: { some: { active: true } },
        ...(filter === "prop-firm" && { slug: { in: PROP_FIRM_SLUGS } }),
      },
      orderBy: { sortOrder: "asc" },
      include: { prices: { where: { active: true, tier: { in: CATALOG_PUBLIC_TIERS } } } },
    });
    return rows.map((r) => {
      const monthly = r.prices.find((p) => p.tier === "ONE_MONTH")?.amount ?? null;
      const from = r.prices.filter((p) => p.amount > 0).sort((a, b) => a.amount - b.amount)[0]?.amount ?? null;
      const bundled = path.join(process.cwd(), "public", "robots", `${r.slug}.jpg`);
      return {
        slug: r.slug,
        name: r.name,
        short: r.shortDescription,
        monthly,
        from,
        trial: r.prices.some((p) => p.amount === 0),
        artwork: r.artworkUrl ?? (existsSync(bundled) ? `/robots/${r.slug}.jpg` : null),
      };
    });
  } catch {
    return [];
  }
}

type RobotCard = Awaited<ReturnType<typeof loadRobots>>[number];

function RobotCards({ robots }: { robots: RobotCard[] }) {
  if (robots.length === 0) return null;
  return (
    <div className="ca-robots">
      {robots.map((robot) => (
        <Link key={robot.slug} href={`/robots/${robot.slug}`} className="ca-robot">
          {robot.artwork ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={robot.artwork} alt="" loading="lazy" />
          ) : (
            <span className="ca-robot-fallback" aria-hidden="true" />
          )}
          <span className="ca-robot-body">
            <strong>
              {robot.name}
              {robot.slug === FLAGSHIP_ROBOT.slug && <em>Flagship</em>}
              {robot.trial && <em className="is-trial">Free trial</em>}
            </strong>
            <small>{robot.short}</small>
            <span className="ca-robot-price">
              {robot.monthly !== null ? `$${robot.monthly} / month` : robot.from !== null ? `From $${robot.from}` : ""}
              <ArrowRight size={14} aria-hidden="true" />
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function renderBlock(block: Block, index: number, robots: Record<string, RobotCard[]>) {
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
    case "table":
      return (
        <div key={index} className="ca-table-wrap">
          <table className="ca-table">
            <thead>
              <tr>
                {block.head.map((cell, i) => (
                  <th key={i} scope="col">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]}>
                  <th scope="row">{row[0]}</th>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "robots":
      return <RobotCards key={index} robots={robots[block.filter ?? "all"] ?? []} />;
  }
}

export default async function ContentArticle({ page }: { page: ContentPage }) {
  const filters = Array.from(
    new Set(page.blocks.filter((b) => b.type === "robots").map((b) => (b.type === "robots" ? b.filter ?? "all" : "all"))),
  );
  const robots: Record<string, RobotCard[]> = {};
  for (const filter of filters) {
    robots[filter] = await loadRobots(filter === "all" ? undefined : filter);
  }

  const toc = page.blocks.filter((b): b is Extract<Block, { type: "h2" }> => b.type === "h2");
  const related = page.related.map(getContentPage).filter((p): p is ContentPage => Boolean(p));
  const trail =
    page.kind === "guide"
      ? [
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: page.h1, path: page.path },
        ]
      : [
          { name: "Home", path: "/" },
          { name: page.eyebrow, path: page.path },
        ];

  const updated = new Date(page.updated).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="main-content ca-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          articleJsonLd({ path: page.path, headline: page.h1, description: page.description, updated: page.updated }),
        )}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbJsonLd("en", trail))} />
      {page.faq.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqPageJsonLd(page.faq))} />
      )}

      <header className="ca-hero">
        <div className="ca-container">
          <nav className="ca-crumbs" aria-label="Breadcrumb">
            {trail.map((crumb, i) => (
              <span key={crumb.path}>
                {i < trail.length - 1 ? <Link href={crumb.path}>{crumb.name}</Link> : <span aria-current="page">{crumb.name}</span>}
                {i < trail.length - 1 && <ChevronRight size={13} aria-hidden="true" />}
              </span>
            ))}
          </nav>
          <span className="ca-eyebrow">{page.eyebrow}</span>
          <h1>{page.h1}</h1>
          <p className="ca-lead">{page.lead}</p>
          <p className="ca-meta">
            <Clock size={14} aria-hidden="true" />
            {page.readingMinutes} min read · Updated <time dateTime={page.updated}>{updated}</time>
          </p>
        </div>
      </header>

      <div className="ca-container ca-layout">
        <article className="ca-body">{page.blocks.map((block, i) => renderBlock(block, i, robots))}</article>

        <aside className="ca-side">
          {toc.length > 0 && (
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
            <strong>Try GoldBot free</strong>
            <p>3-day trial on PrecisionTrader. No card needed.</p>
            <Link href="/catalog" className="ca-btn is-primary">
              Browse robots
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>

      {page.faq.length > 0 && (
        <section className="ca-container ca-faq" aria-labelledby="ca-faq-title">
          <h2 id="ca-faq-title">Frequently asked questions</h2>
          <div className="ca-faq-list">
            {page.faq.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="ca-container ca-related" aria-labelledby="ca-related-title">
          <h2 id="ca-related-title">Keep reading</h2>
          <div className="ca-related-grid">
            {related.map((r) => (
              <Link key={r.slug} href={r.path} className="ca-related-card">
                <span className="ca-related-kind">
                  <BookOpen size={13} aria-hidden="true" />
                  {r.kind === "guide" ? "Guide" : r.eyebrow}
                </span>
                <strong>{r.h1}</strong>
                <span className="ca-related-more">
                  Read <ArrowRight size={14} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="ca-container ca-cta">
        <div>
          <h2>Ready to automate your gold trading?</h2>
          <p>Pick a robot, lock it to your MT5 account, and your build is ready in minutes.</p>
        </div>
        <div className="ca-cta-actions">
          <Link href="/#pricing" className="ca-btn is-primary">
            See pricing
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/features" className="ca-btn">
            How it works
          </Link>
        </div>
      </section>
    </main>
  );
}
