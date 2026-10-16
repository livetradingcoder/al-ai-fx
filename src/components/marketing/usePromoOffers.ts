"use client";

import { useEffect, useState } from "react";

import type { PublicBanner } from "@/lib/promo-banner";

// What is on right now (live giveaway, the admin's promo-bar messages, the reward
// size), shared by the top bar and the exit pop-up. One request serves both, and
// the answer is reused for a minute across page changes.

export type PromoGiveaway = { slug: string; title: string; prize: string; endsAt: string };
export type PromoOffers = {
  eligible: boolean;
  rewardPercent?: number;
  giveaway: PromoGiveaway | null;
  banners: PublicBanner[];
};

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; request: Promise<PromoOffers | null> }>();

export function loadPromoOffers(locale: string): Promise<PromoOffers | null> {
  const hit = cache.get(locale);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.request;

  const request = (async () => {
    try {
      const res = await fetch(`/api/promo/eligible?locale=${encodeURIComponent(locale)}`, { cache: "no-store" });
      const data = (await res.json()) as Partial<PromoOffers>;
      if (!res.ok || !data.eligible) return null;
      return {
        eligible: true,
        rewardPercent: data.rewardPercent,
        giveaway: data.giveaway ?? null,
        banners: data.banners ?? [],
      } satisfies PromoOffers;
    } catch {
      return null;
    }
  })();

  cache.set(locale, { at: Date.now(), request });
  return request;
}

/** The offers once loaded (null until then, and where promotions are not offered). */
export function usePromoOffers(locale: string, delayMs = 0): PromoOffers | null {
  const [offers, setOffers] = useState<PromoOffers | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await loadPromoOffers(locale);
      if (!cancelled) setOffers(result);
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locale, delayMs]);

  return offers;
}
