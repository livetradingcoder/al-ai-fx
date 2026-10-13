"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

import {
  ACCOUNT_NAV,
  ADMIN_NAV,
  ADMIN_VIEW_ACCOUNT,
  type NavGroup,
} from "@/components/dashboard/nav";

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
    // An admin's "Overview" is their own customer dashboard; plain /dashboard
    // would send them to the admin home.
    const toItems = (groups: NavGroup[]): Item[] =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          group: t(group.label),
          label: t(item.label),
          href: isAdmin && item.href === "/dashboard" ? ADMIN_VIEW_ACCOUNT : item.href,
        })),
      );

    const account: Item[] = [
      ...toItems(ACCOUNT_NAV),
      { group: t("helpGroup"), label: t("openTutorial"), href: "/tutorials/1" },
    ];
    return isAdmin ? [...toItems(ADMIN_NAV), ...account] : account;
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
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
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
