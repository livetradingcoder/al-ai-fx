"use client";

import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, usePathname } from "@/i18n/routing";
import type { PublicBanner } from "@/lib/promo-banner";
import { usePromoOffers, type PromoGiveaway } from "./usePromoOffers";
import "./rewards.css";

// The strip across the top of the public pages. It rotates between whatever is
// on: the live giveaway, the admin's promo-bar messages (some carry a coupon
// code to copy) and the share-your-results reward. Everyone sees it, signed in
// or not. Hidden where it would get in the way (checkout, sign-in, the
// dashboard, the giveaway page itself) and wherever the server says promotions
// are not offered. Closing it hides it for the rest of the browser session.

const HIDDEN_PATHS = ["/dashboard", "/checkout", "/login", "/forgot-password", "/magic-login", "/results/submit", "/giveaway"];
const DISMISS_KEY = "gb_announce_dismissed_v2";
const ROTATE_MS = 6500;

type Giveaway = PromoGiveaway;

type Item =
  | { kind: "giveaway"; id: string; giveaway: Giveaway }
  | { kind: "banner"; id: string; banner: PublicBanner }
  | { kind: "game"; id: string; percent: number };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function countdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${days > 0 ? `${pad(days)}d ` : ""}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function endsOf(item: Item): string | null {
  if (item.kind === "giveaway") return item.giveaway.endsAt;
  if (item.kind === "banner") return item.banner.endsAt;
  return null;
}

export default function AnnouncementBar() {
  const locale = useLocale();
  const pathname = usePathname();
  const { status } = useSession();
  const data = usePromoOffers(locale);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  // Read on the client only. Nothing renders until the offers have loaded, so none of
  // this can appear in the server HTML and mismatch it.
  const [now, setNow] = useState<number>(() => Date.now());
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion] = useState(
    () => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false),
  );
  const [copied, setCopied] = useState<string | null>(null);

  const hiddenHere = HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // What is on right now. Order: the giveaway, the admin's messages, the reward game.
  const items: Item[] = useMemo(() => {
    if (!data) return [];
    const live = (iso: string | null) => iso === null || new Date(iso).getTime() > now;
    const out: Item[] = [];
    if (data.giveaway && live(data.giveaway.endsAt)) {
      out.push({ kind: "giveaway", id: `g:${data.giveaway.slug}`, giveaway: data.giveaway });
    }
    for (const banner of data.banners ?? []) {
      if (live(banner.endsAt)) out.push({ kind: "banner", id: `b:${banner.id}`, banner });
    }
    if (data.rewardPercent) out.push({ kind: "game", id: "game", percent: data.rewardPercent });
    return out;
  }, [data, now]);

  const visible = items.length > 0 && !dismissed && !hiddenHere;

  // Make room: the fixed navbar and the page move down by the bar's height.
  useEffect(() => {
    if (!visible) return;
    document.documentElement.classList.add("has-announce");
    return () => document.documentElement.classList.remove("has-announce");
  }, [visible]);

  // Rotate while there is more than one message, unless the pointer or focus is on the bar.
  useEffect(() => {
    if (!visible || items.length < 2 || paused || reduceMotion) return;
    const id = setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [visible, items.length, paused, reduceMotion]);

  const close = useCallback(() => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked: it just returns on the next page */
    }
    setDismissed(true);
  }, []);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    } catch {
      /* clipboard blocked: the code is on screen to copy by hand */
    }
  }

  if (!visible) return null;

  const current = items[index % items.length];
  const ends = endsOf(current);
  const left = ends ? new Date(ends).getTime() - now : null;

  return (
    <div
      className="rw-scope rw-announce"
      role="region"
      aria-label="Offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="rw-announce-inner" key={current.id} aria-live="off">
        {current.kind === "giveaway" && (
          <>
            <span className="rw-announce-tag">Giveaway</span>
            <span className="rw-announce-text">
              {current.giveaway.title}: win <strong>{current.giveaway.prize}</strong>
            </span>
          </>
        )}
        {current.kind === "banner" && (
          <>
            <span className="rw-announce-tag">{current.banner.label ?? "Offer"}</span>
            <span className="rw-announce-text">{current.banner.message}</span>
            {current.banner.code && (
              <button
                type="button"
                className="rw-announce-code"
                onClick={() => void copy(current.banner.code as string)}
                aria-label={`Copy code ${current.banner.code}`}
              >
                <span>{current.banner.code}</span>
                <small>{copied === current.banner.code ? "Copied" : "Copy"}</small>
              </button>
            )}
          </>
        )}
        {current.kind === "game" && (
          <>
            <span className="rw-announce-tag">Rewards game</span>
            <span className="rw-announce-text">
              Share your results, get <strong>{current.percent}% off</strong>
            </span>
          </>
        )}

        {left !== null && left > 0 && (
          <span className="rw-announce-time" role="timer">
            <span className="rw-announce-label">Ends in</span>
            <b>{countdown(left)}</b>
          </span>
        )}

        {current.kind === "giveaway" && (
          <Link className="rw-announce-btn" href="/giveaway">
            Enter free →
          </Link>
        )}
        {current.kind === "banner" && (
          <Link className="rw-announce-btn" href={current.banner.ctaHref}>
            {current.banner.ctaLabel} →
          </Link>
        )}
        {current.kind === "game" && (
          <Link className="rw-announce-btn" href={status === "authenticated" ? "/dashboard/rewards" : "/catalog"}>
            {status === "authenticated" ? "Play now →" : "Try free →"}
          </Link>
        )}
      </div>

      {items.length > 1 && (
        <div className="rw-announce-dots" role="group" aria-label="Choose an offer">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className="rw-announce-dot"
              aria-label={`Show offer ${i + 1} of ${items.length}`}
              aria-current={i === index % items.length}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}

      <button type="button" className="rw-announce-x" onClick={close} aria-label="Close offers bar">
        ×
      </button>
    </div>
  );
}
