"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { Check, ChevronDown, Globe, LoaderCircle } from "lucide-react";
import { useRouter, usePathname } from "../i18n/routing";
import "./language-switcher.css";

// Native names instead of flags: a language isn't a country (English, Spanish
// and Arabic span many), and flag emoji don't render on Windows at all.
const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "de", name: "Deutsch" },
  { code: "ar", name: "العربية" },
  { code: "hi", name: "हिन्दी" },
  { code: "bn", name: "বাংলা" },
  { code: "ur", name: "اردو" },
] as const;

export default function LanguageSwitcher({ placement = "down" }: { placement?: "down" | "up" }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  const choose = (code: string) => {
    setOpen(false);
    if (code === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: code });
    });
  };

  // Close on outside click / Escape; move focus into the list when it opens.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>(".ls-button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Arrow keys move between options.
  const onListKey = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const options = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const at = options.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (at + 1) % options.length : (at - 1 + options.length) % options.length;
    options[next]?.focus();
  };

  return (
    <div className="ls" ref={rootRef}>
      <button
        type="button"
        className="ls-button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current.name}`}
        disabled={isPending}
      >
        {isPending ? (
          <LoaderCircle size={15} className="ls-spin" aria-hidden="true" />
        ) : (
          <Globe size={15} aria-hidden="true" />
        )}
        <span className="ls-code">{current.code.toUpperCase()}</span>
        <ChevronDown size={14} className={`ls-chevron ${open ? "is-open" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <ul
          ref={listRef}
          className={`ls-menu is-${placement}`}
          role="listbox"
          aria-label="Choose language"
          onKeyDown={onListKey}
        >
          {LANGUAGES.map((lang) => {
            const selected = lang.code === locale;
            return (
              <li key={lang.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`ls-option ${selected ? "is-selected" : ""}`}
                  onClick={() => choose(lang.code)}
                  lang={lang.code}
                >
                  <span className="ls-option-code">{lang.code.toUpperCase()}</span>
                  <span className="ls-option-name">{lang.name}</span>
                  {selected && <Check size={14} className="ls-check" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
