"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  CreditCard,
  KeyRound,
  LifeBuoy,
  Mail,
  Rocket,
  Search,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";

export type FaqCategory = { id: string; label: string };
export type FaqItem = {
  id: string;
  category: string;
  q: string;
  a: string;
  link?: { href: string; label: string };
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  start: Rocket,
  licence: KeyRound,
  billing: CreditCard,
  trading: TrendingUp,
};

const EASE = [0.22, 1, 0.36, 1] as const;

export default function FaqBrowser({
  title,
  subtitle,
  stillHaveQuestions,
  contactSupport,
  categories,
  items,
}: {
  title: string;
  subtitle: string;
  stillHaveQuestions: string;
  contactSupport: string;
  categories: FaqCategory[];
  items: FaqItem[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);

  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      items.filter(
        (item) =>
          (category === "all" || item.category === category) &&
          (!needle || `${item.q} ${item.a}`.toLowerCase().includes(needle)),
      ),
    [items, category, needle],
  );

  const counts = useMemo(
    () =>
      Object.fromEntries(
        categories.map((c) => [c.id, items.filter((i) => i.category === c.id).length]),
      ),
    [categories, items],
  );

  const groups = categories
    .map((c) => ({ ...c, items: matches.filter((i) => i.category === c.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="fq-container">
      <header className="fq-header">
        <span className="fq-eyebrow">
          <BookOpen size={13} aria-hidden="true" />
          Help center
        </span>
        <h1>{title}</h1>
        <p>{subtitle}</p>

        <label className="fq-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search questions — e.g. refund, MT5, trial"
            aria-label="Search the FAQ"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>
      </header>

      <div className="fq-layout">
        <nav className="fq-nav" aria-label="FAQ categories">
          <button
            type="button"
            className={`fq-nav-item ${category === "all" ? "is-active" : ""}`}
            onClick={() => setCategory("all")}
          >
            <BookOpen size={16} aria-hidden="true" />
            <span>All questions</span>
            <em>{items.length}</em>
          </button>
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.id] ?? BookOpen;
            return (
              <button
                key={c.id}
                type="button"
                className={`fq-nav-item ${category === c.id ? "is-active" : ""}`}
                onClick={() => setCategory(c.id)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{c.label}</span>
                <em>{counts[c.id]}</em>
              </button>
            );
          })}
        </nav>

        <div className="fq-list">
          {groups.length === 0 && (
            <div className="fq-empty">
              <p>No questions match “{query}”.</p>
              <button type="button" onClick={() => { setQuery(""); setCategory("all"); }}>
                Clear filters
              </button>
            </div>
          )}

          {groups.map((group) => {
            const Icon = CATEGORY_ICONS[group.id] ?? BookOpen;
            return (
              <section key={group.id} className="fq-group" aria-labelledby={`fq-group-${group.id}`}>
                <h2 id={`fq-group-${group.id}`}>
                  <Icon size={16} aria-hidden="true" />
                  {group.label}
                </h2>

                <div className="fq-items">
                  {group.items.map((item) => {
                    const isOpen = open === item.id;
                    return (
                      <div key={item.id} id={item.id} className={`fq-item ${isOpen ? "is-open" : ""}`}>
                        <h3>
                          <button
                            type="button"
                            className="fq-question"
                            aria-expanded={isOpen}
                            aria-controls={`${item.id}-answer`}
                            onClick={() => setOpen(isOpen ? null : item.id)}
                          >
                            <span>{item.q}</span>
                            <ChevronDown size={18} className="fq-chevron" aria-hidden="true" />
                          </button>
                        </h3>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              id={`${item.id}-answer`}
                              role="region"
                              className="fq-answer"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: EASE }}
                            >
                              <div className="fq-answer-inner">
                                <p>{item.a}</p>
                                {item.link && (
                                  <Link href={item.link.href} className="fq-answer-link">
                                    {item.link.label}
                                    <ArrowRight size={14} aria-hidden="true" />
                                  </Link>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <section className="fq-contact">
        <span className="fq-contact-icon" aria-hidden="true">
          <LifeBuoy size={22} />
        </span>
        <div>
          <h2>{stillHaveQuestions}</h2>
          <p>Our team answers setup, licensing and billing questions.</p>
        </div>
        <div className="fq-contact-actions">
          <a href="mailto:support@AL-ai-FX.com" className="fq-btn is-primary">
            <Mail size={16} aria-hidden="true" />
            {contactSupport}
          </a>
          <Link href="/support" className="fq-btn">
            Support center
          </Link>
        </div>
      </section>
    </div>
  );
}
