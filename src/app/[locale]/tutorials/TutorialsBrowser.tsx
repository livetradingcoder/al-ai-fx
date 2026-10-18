"use client";

import { useMemo, useState, type ReactNode } from "react";
import NextLink from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock,
  CreditCard,
  LifeBuoy,
  Lock,
  Rocket,
  Search,
  TrendingUp,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import { Link } from "@/i18n/routing";

export type TutorialIndexCategory = { id: string; label: string };
export type TutorialIndexItem = {
  href: string;
  category: string;
  title: string;
  summary: string;
  duration: string;
  /** Members-only and the visitor is signed out: `href` is the login, which returns here. */
  locked?: boolean;
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  start: Rocket,
  setup: Wrench,
  billing: CreditCard,
  trading: TrendingUp,
};

// A locked card's href already carries the locale (it is the login path), so
// it uses the plain Link; the locale-aware one would prefix it a second time.
function CardLink({ item, children }: { item: TutorialIndexItem; children: ReactNode }) {
  return item.locked ? (
    <NextLink href={item.href} className="ca-guide-card is-locked">
      {children}
    </NextLink>
  ) : (
    <Link href={item.href} className="ca-guide-card">
      {children}
    </Link>
  );
}

export default function TutorialsBrowser({
  title,
  subtitle,
  readLabel,
  membersLabel,
  signInLabel,
  categories,
  items,
}: {
  title: string;
  subtitle: string;
  readLabel: string;
  membersLabel: string;
  signInLabel: string;
  categories: TutorialIndexCategory[];
  items: TutorialIndexItem[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      items.filter(
        (item) =>
          (category === "all" || item.category === category) &&
          (!needle || `${item.title} ${item.summary}`.toLowerCase().includes(needle)),
      ),
    [items, category, needle],
  );

  const counts = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, items.filter((i) => i.category === c.id).length])),
    [categories, items],
  );

  const groups = categories
    .map((c) => ({ ...c, items: matches.filter((i) => i.category === c.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="tu-container">
      <header className="tu-header">
        <span className="ca-eyebrow">
          <BookOpen size={13} aria-hidden="true" />
          Tutorials
        </span>
        <h1>{title}</h1>
        <p>{subtitle}</p>

        <label className="tu-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tutorials — e.g. install, trial, refund"
            aria-label="Search tutorials"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>
      </header>

      <div className="tu-layout">
        <nav className="tu-nav" aria-label="Tutorial categories">
          <button
            type="button"
            className={`tu-nav-item ${category === "all" ? "is-active" : ""}`}
            onClick={() => setCategory("all")}
          >
            <BookOpen size={16} aria-hidden="true" />
            <span>All tutorials</span>
            <em>{items.length}</em>
          </button>
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.id] ?? BookOpen;
            return (
              <button
                key={c.id}
                type="button"
                className={`tu-nav-item ${category === c.id ? "is-active" : ""}`}
                onClick={() => setCategory(c.id)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{c.label}</span>
                <em>{counts[c.id]}</em>
              </button>
            );
          })}
        </nav>

        <div className="tu-list">
          {groups.length === 0 && (
            <div className="tu-empty">
              <p>No tutorials match “{query}”.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                Clear filters
              </button>
            </div>
          )}

          {groups.map((group) => {
            const Icon = CATEGORY_ICONS[group.id] ?? BookOpen;
            return (
              <section key={group.id} className="tu-group" aria-labelledby={`tu-group-${group.id}`}>
                <h2 id={`tu-group-${group.id}`}>
                  <Icon size={16} aria-hidden="true" />
                  {group.label}
                </h2>

                <div className="tu-grid">
                  {group.items.map((item) => (
                    <CardLink key={item.href} item={item}>
                      <span className="tu-card-top">
                        <span className="ca-related-kind">
                          <Clock size={13} aria-hidden="true" />
                          {item.duration}
                        </span>
                        {item.locked && (
                          <span className="tu-badge">
                            <Lock size={11} aria-hidden="true" />
                            {membersLabel}
                          </span>
                        )}
                      </span>
                      <strong>{item.title}</strong>
                      <p>{item.summary}</p>
                      <span className="ca-related-more">
                        {item.locked ? signInLabel : readLabel} <ArrowRight size={14} aria-hidden="true" />
                      </span>
                    </CardLink>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <section className="tu-help">
        <span className="tu-help-icon" aria-hidden="true">
          <LifeBuoy size={22} />
        </span>
        <div>
          <h2>Can&apos;t find what you need?</h2>
          <p>The FAQ covers the quick questions, and our team answers setup, licensing and billing.</p>
        </div>
        <div className="tu-help-actions">
          <Link href="/faq" className="ca-btn">
            Read the FAQ
          </Link>
          <Link href="/support" className="ca-btn is-primary">
            Contact support
          </Link>
        </div>
      </section>
    </div>
  );
}
