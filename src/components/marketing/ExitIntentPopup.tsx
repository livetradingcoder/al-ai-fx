"use client";

import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Link, usePathname } from "@/i18n/routing";
import { formatDate } from "@/lib/format-date";
import GiveawayForm from "./GiveawayForm";
import { useModal } from "./useModal";
import { usePromoOffers } from "./usePromoOffers";
import "./rewards.css";

// The "before you go" pop-up. When someone looks about to leave (the pointer
// heads out through the top of the window, a quick scroll back up the page, or
// a long dwell on a touch screen) it offers what is on right now: a public
// discount code from the promo bar and/or the giveaway entry. It arms only when
// there is something to offer, never on checkout/sign-in/dashboard screens, and
// at most once a week per browser. Signed-in people see it too, with their email
// filled in. Every piece of browser storage is wrapped: with it blocked the
// pop-up still works, it just may reappear.
//
// To look at it: open any public page with ?exitpopup=1 (arms at once and
// ignores the one-a-week rule), then move the pointer out through the top.

const STORAGE_KEY = "gb_exit_popup_v2";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const ENTERED_MS = 90 * 24 * 60 * 60 * 1000;
const ARM_AFTER_MS = 8000;
const MOBILE_FALLBACK_MS = 35000;

const HIDDEN_PATHS = ["/dashboard", "/checkout", "/login", "/forgot-password", "/magic-login", "/giveaway", "/results/submit"];

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
    /* storage blocked: may reappear next visit, which is fine */
  }
}

export default function ExitIntentPopup() {
  const { data: session } = useSession();
  const locale = useLocale();
  const pathname = usePathname();
  const [force] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("exitpopup") === "1",
  );
  const offers = usePromoOffers(locale, force ? 0 : ARM_AFTER_MS);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shown = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const hiddenHere = HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // What there is to offer: the first public code, and the live giveaway.
  const coupon = offers?.banners.find((b) => b.code) ?? null;
  const giveaway = offers?.giveaway ?? null;
  const hasOffer = !!(coupon || giveaway);
  const armed = hasOffer && !hiddenHere;

  const show = useCallback(() => {
    if (shown.current || (!force && snoozedUntil() > Date.now())) return;
    shown.current = true;
    setOpen(true);
  }, [force]);

  useEffect(() => {
    if (!armed) return;

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
      if (lastY - y > 280 && now - lastT < 500 && maxY > 700) show();
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
  }, [armed, show]);

  const close = useCallback((ms: number = SNOOZE_MS) => {
    snooze(ms);
    setOpen(false);
  }, []);

  useModal(open, close, dialogRef);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code is on screen to copy by hand */
    }
  }

  if (!open || !armed) return null;

  return (
    <div
      className="rw-scope rw-popup-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div ref={dialogRef} className="rw-popup rw-popup--wide" role="dialog" aria-modal="true" aria-labelledby="rw-exit-title">
        <button type="button" className="rw-popup-close" aria-label="Close" onClick={() => close()}>
          ×
        </button>
        <span className="rw-eyebrow">Before you go</span>

        {coupon && (
          <section>
            <h2 id="rw-exit-title">{coupon.label ? `Take ${coupon.label} with you` : coupon.message}</h2>
            <p className="rw-muted" style={{ marginTop: "8px" }}>
              {coupon.label ? `${coupon.message.replace(/[.\s]+$/, "")}.` : "Use this code at checkout."}
              {coupon.endsAt ? ` Ends ${formatDate(coupon.endsAt)}.` : ""}
            </p>
            <div className="rw-row" style={{ margin: "16px 0 4px" }}>
              <span className="rw-code">{coupon.code}</span>
              <button type="button" className="rw-btn rw-btn--ghost rw-btn--small" onClick={() => void copy(coupon.code as string)}>
                {copied ? "Copied" : "Copy"}
              </button>
              <Link className="rw-btn rw-btn--small" href={coupon.ctaHref} onClick={() => close()}>
                {coupon.ctaLabel} →
              </Link>
            </div>
          </section>
        )}

        {giveaway && (
          <section style={coupon ? { marginTop: "22px", paddingTop: "20px", borderTop: "1px solid var(--rw-hairline)" } : undefined}>
            {coupon ? (
              <h3 style={{ fontSize: "1.2rem", color: "#fff" }}>Or win {giveaway.prize}</h3>
            ) : (
              <h2 id="rw-exit-title">Win {giveaway.prize}</h2>
            )}
            <p className="rw-muted" style={{ marginTop: "8px" }}>
              Enter the {giveaway.title} with just your email. No purchase necessary. Closes{" "}
              {new Date(giveaway.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}.
            </p>
            <GiveawayForm
              locale={locale}
              source="exit-intent"
              defaultEmail={session?.user?.email ?? ""}
              onDone={() => snooze(ENTERED_MS)}
            />
          </section>
        )}

        <p className="rw-small" style={{ marginTop: "14px" }}>
          Results shown on this site differ between accounts. Past results are no guide to future ones.
        </p>
      </div>
    </div>
  );
}
