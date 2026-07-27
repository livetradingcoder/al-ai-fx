"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

type Item = { group: string; label: string; href: string };

/**
 * ⌘K navigator. It jumps to pages — it does not pretend to search content we
 * don't index. Keyboard-first: arrows move, Enter opens, Esc closes.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Dashboard");
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const items: Item[] = useMemo(() => {
    const base: Item[] = [
      { group: t("menu"), label: t("overview"), href: "/dashboard" },
      { group: t("menu"), label: t("myLicenses"), href: "/dashboard/licenses" },
      { group: t("menu"), label: t("downloads"), href: "/dashboard/downloads" },
      { group: t("accountGroup"), label: t("billing"), href: "/dashboard/billing" },
      { group: t("accountGroup"), label: t("profile"), href: "/dashboard/profile" },
      { group: t("accountGroup"), label: t("settings"), href: "/dashboard/settings" },
      { group: t("helpGroup"), label: t("support"), href: "/dashboard/support" },
      { group: t("helpGroup"), label: t("openTutorial"), href: "/tutorials/1" },
    ];
    if (isAdmin) {
      base.push(
        { group: t("administration"), label: t("adminOverview"), href: "/dashboard/admin" },
        { group: t("administration"), label: t("manageUsers"), href: "/dashboard/admin/users" },
        { group: t("administration"), label: t("manageRobots"), href: "/dashboard/admin/robots" },
      );
    }
    return base;
  }, [isAdmin, t]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.href.toLowerCase().includes(q),
    );
  }, [items, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  const go = useCallback(
    (item: Item) => {
      close();
      router.push(locale === "en" ? item.href : `/${locale}${item.href}`);
    },
    [close, locale, router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter" && results[cursor]) {
        e.preventDefault();
        go(results[cursor]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, cursor, close, go]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  let lastGroup = "";

  return (
    <>
      <button
        type="button"
        className="topbar-search"
        onClick={() => setOpen(true)}
        aria-label={t("searchPlaceholder")}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" />
        </svg>
        <span>{t("searchPlaceholder")}</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div className="palette-backdrop" onClick={close} role="presentation">
          <div
            className="palette"
            role="dialog"
            aria-modal="true"
            aria-label={t("searchPlaceholder")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="palette-input">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
              />
              <kbd>esc</kbd>
            </div>

            <div className="palette-results">
              {results.length === 0 ? (
                <p className="palette-empty">{t("searchNoResults")}</p>
              ) : (
                results.map((item, i) => {
                  const header = item.group !== lastGroup ? item.group : null;
                  lastGroup = item.group;
                  return (
                    <div key={item.href}>
                      {header && <p className="palette-group">{header}</p>}
                      <button
                        type="button"
                        className="palette-item"
                        data-active={i === cursor ? "true" : undefined}
                        onMouseEnter={() => setCursor(i)}
                        onClick={() => go(item)}
                      >
                        <span>{item.label}</span>
                        <span className="palette-path">{item.href}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="palette-foot">
              <span>↑↓ {t("searchNavigate")}</span>
              <span>↵ {t("searchSelect")}</span>
              <span>esc {t("searchClose")}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
