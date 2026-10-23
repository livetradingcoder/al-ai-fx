"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Play, Volume2 } from "lucide-react";

/**
 * The vertical Short that loops over the hero art: a trade being taken and the
 * result. It plays muted because no browser allows sound without a click, so
 * the whole card is a button — clicking it opens the full profit report with
 * sound in the hero's video pop-up.
 *
 * The iframe is mounted a moment after the page paints rather than with it: it
 * is decoration, and the hero image is what the visitor is waiting for. With
 * reduced motion it never loads at all and the thumbnail stands in.
 */
const SHORT_ID = "ocmp5cf7dd0";

const EMBED =
  `https://www.youtube-nocookie.com/embed/${SHORT_ID}` +
  // loop needs playlist= to loop a single video; controls/keyboard off because
  // the overlay button owns every click.
  `?autoplay=1&mute=1&loop=1&playlist=${SHORT_ID}&controls=0&disablekb=1` +
  `&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3`;

export default function HeroShortCard({ onOpenFull }: { onOpenFull: () => void }) {
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setTimeout(() => setPlaying(true), 1200);
    return () => window.clearTimeout(id);
  }, [reduceMotion]);

  return (
    <div className="hero-short">
      <div className="hero-short-frame">
        {playing ? (
          <iframe
            className="hero-short-video"
            src={EMBED}
            title="GoldBot live entry and profit result"
            allow="autoplay; encrypted-media; picture-in-picture"
            tabIndex={-1}
            aria-hidden="true"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="hero-short-video"
            src={`https://i.ytimg.com/vi/${SHORT_ID}/hqdefault.jpg`}
            alt=""
            aria-hidden="true"
          />
        )}

        {/* One button over the whole card: the iframe has no controls, so every
            click belongs here and opens the full video with sound. */}
        <button type="button" className="hero-short-hit" onClick={onOpenFull}>
          <span className="hero-short-live">
            <span className="hero-short-dot" aria-hidden="true" />
            Live result
          </span>
          <span className="hero-short-cta">
            {playing ? <Volume2 size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            Watch with sound
          </span>
        </button>
      </div>
    </div>
  );
}
