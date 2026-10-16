"use client";

import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { usePathname } from "@/i18n/routing";
import GiveawayForm from "./GiveawayForm";
import "./rewards.css";

// The exit-intent giveaway pop-up. It only arms when the server says promotions
// are allowed here and a giveaway is live, never for signed-in customers, never
// on checkout/login/dashboard screens, and at most once a week per browser. Every
// piece of browser storage is wrapped: the pop-up must work (or quietly not
// appear) when storage is blocked.

const STORAGE_KEY = "gb_giveaway_popup_v1";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const ENTERED_MS = 90 * 24 * 60 * 60 * 1000;
const ARM_AFTER_MS = 8000;
const MOBILE_FALLBACK_MS = 35000;

const HIDDEN_PATHS = ["/dashboard", "/checkout", "/login", "/forgot-password", "/magic-login", "/giveaway", "/results/submit"];

type Eligible = { eligible: boolean; giveaway: { title: string; prize: string; endsAt: string } | null };

function snoozedUntil(): number {
  try {
    return Number(window.localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function snooze(ms: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now() + ms));
  } catch {
    /* storage blocked: the pop-up may reappear next visit, which is fine */
  }
}

export default function GiveawayPopup() {
  const { status } = useSession();
  const locale = useLocale();
  const pathname = usePathname();
  const [offer, setOffer] = useState<Eligible["giveaway"]>(null);
  const [open, setOpen] = useState(false);
  const shown = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const hiddenHere = HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const suppressed = status !== "unauthenticated" || hiddenHere;

  // Ask the server whether to arm at all (country and language are checked there).
  useEffect(() => {
    if (suppressed || snoozedUntil() > Date.now()) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/promo/eligible?locale=${encodeURIComponent(locale)}`, { cache: "no-store" });
        const data = (await res.json()) as Eligible;
        if (!cancelled && res.ok && data.eligible && data.giveaway) setOffer(data.giveaway);
      } catch {
        /* no offer: nothing to show */
      }
    }, ARM_AFTER_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [suppressed, locale, pathname]);

  const show = useCallback(() => {
    if (shown.current || snoozedUntil() > Date.now()) return;
    shown.current = true;
    lastFocus.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  // Triggers: the pointer leaving through the top of the window (desktop), a quick
  // scroll back up the page, or - on touch screens with no way to "leave" - a long dwell.
  useEffect(() => {
    if (!offer || suppressed) return;

    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) show();
    };

    let maxY = 0;
    let lastY = window.scrollY;
    let lastT = Date.now();
    const onScroll = () => {
      const y = window.scrollY;
      const now = Date.now();
      maxY = Math.max(maxY, y);
      const fastUp = lastY - y > 280 && now - lastT < 500 && maxY > 700;
      if (fastUp) show();
      lastY = y;
      lastT = now;
    };

    const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const dwell = touch ? setTimeout(show, MOBILE_FALLBACK_MS) : undefined;

    document.addEventListener("mouseout", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("scroll", onScroll);
      if (dwell) clearTimeout(dwell);
    };
  }, [offer, suppressed, show]);

  const close = useCallback((entered = false) => {
    snooze(entered ? ENTERED_MS : SNOOZE_MS);
    setOpen(false);
    lastFocus.current?.focus?.();
  }, []);

  // Focus, Escape, and keep Tab inside the dialog.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button, [href], input:not([tabindex='-1']), select, textarea",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || !offer || suppressed) return null;

  return (
    <div
      className="rw-scope rw-popup-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div ref={dialogRef} className="rw-popup" role="dialog" aria-modal="true" aria-labelledby="rw-popup-title">
        <button type="button" className="rw-popup-close" aria-label="Close" onClick={() => close()}>
          ×
        </button>
        <span className="rw-eyebrow">Before you go</span>
        <h2 id="rw-popup-title">Win {offer.prize}</h2>
        <p className="rw-muted" style={{ marginTop: "8px" }}>
          Enter the {offer.title} with just your email. No purchase necessary. Closes{" "}
          {new Date(offer.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.
        </p>
        <GiveawayForm locale={locale} source="exit-intent" onDone={() => snooze(ENTERED_MS)} />
        <p className="rw-small" style={{ marginTop: "12px" }}>
          Results shown on this site differ between accounts. Past results are no guide to future ones.
        </p>
      </div>
    </div>
  );
}
