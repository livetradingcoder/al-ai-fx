"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Link, usePathname } from "@/i18n/routing";
import "./rewards.css";

// A slim bar across the top of the public pages while a giveaway is running:
// the prize, a live countdown and a button. It is the always-visible way in,
// next to the exit-intent pop-up, and it shows to everyone including signed-in
// people. Hidden where it would get in the way (checkout, sign-in, the
// dashboard, the giveaway page itself) and wherever the server says promotions
// are not offered. Closing it hides it for the rest of the browser session.

const HIDDEN_PATHS = ["/dashboard", "/checkout", "/login", "/forgot-password", "/magic-login", "/results/submit", "/giveaway"];
const DISMISS_KEY = "gb_announce_dismissed_v1";

type Offer = { slug: string; title: string; prize: string; endsAt: string };

function dismissedSlug(): string | null {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function remaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    done: total <= 0,
  };
}

export default function AnnouncementBar() {
  const locale = useLocale();
  const pathname = usePathname();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  const hiddenHere = HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/promo/eligible?locale=${encodeURIComponent(locale)}`, { cache: "no-store" });
        const data = (await res.json()) as { eligible: boolean; giveaway: Offer | null };
        if (cancelled || !res.ok || !data.eligible || !data.giveaway) return;
        setOffer(data.giveaway);
        setDismissed(dismissedSlug() === data.giveaway.slug);
      } catch {
        /* no bar: nothing to announce */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (!offer) return;
    const end = new Date(offer.endsAt).getTime();
    const tick = () => setLeft(end - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [offer]);

  const visible = !!offer && !dismissed && !hiddenHere && left !== null && left > 0;

  // Make room: the fixed navbar and the page move down by the bar's height.
  useEffect(() => {
    if (!visible) return;
    document.documentElement.classList.add("has-announce");
    return () => document.documentElement.classList.remove("has-announce");
  }, [visible]);

  const close = useCallback(() => {
    try {
      if (offer) window.sessionStorage.setItem(DISMISS_KEY, offer.slug);
    } catch {
      /* storage blocked: it just returns on the next page */
    }
    setDismissed(true);
  }, [offer]);

  if (!visible || !offer || left === null) return null;
  const t = remaining(left);

  return (
    <div className="rw-scope rw-announce" role="region" aria-label="Giveaway">
      <div className="rw-announce-inner">
        <span className="rw-announce-tag">Giveaway</span>
        <span className="rw-announce-text">
          Win <strong>{offer.prize}</strong>
        </span>
        <span className="rw-announce-time" role="timer" aria-label={`${t.days} days ${t.hours} hours left`}>
          <span className="rw-announce-label">Ends in</span>
          <b>
            {t.days > 0 ? `${pad(t.days)}d ` : ""}
            {pad(t.hours)}:{pad(t.minutes)}:{pad(t.seconds)}
          </b>
        </span>
        <Link className="rw-announce-btn" href="/giveaway">
          Enter free →
        </Link>
      </div>
      <button type="button" className="rw-announce-x" onClick={close} aria-label="Close giveaway banner">
        ×
      </button>
    </div>
  );
}
