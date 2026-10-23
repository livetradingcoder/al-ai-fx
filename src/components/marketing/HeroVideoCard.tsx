"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Play, Volume2 } from "lucide-react";

/**
 * The profit report looping over the hero art — the robot taking a trade and
 * what it made. It plays muted because no browser starts sound on its own, so
 * the whole card is a button: clicking it reopens the same video from the top,
 * with sound, in the hero's pop-up.
 *
 * It is the landscape cut on purpose. The Short (ocmp5cf7dd0) is 9:16 footage
 * and a wide frame would crop it to a strip.
 *
 * The iframe mounts a moment after the page paints rather than with it: it is
 * decoration, and the hero image is what the visitor is waiting for. With
 * reduced motion it never loads at all and the thumbnail stands in.
 */
const VIDEO_ID = "fivmY1wyPD4";

const EMBED =
  `https://www.youtube-nocookie.com/embed/${VIDEO_ID}` +
  // loop needs playlist= to loop a single video; controls/keyboard off because
  // the overlay button owns every click.
  `?autoplay=1&mute=1&loop=1&playlist=${VIDEO_ID}&controls=0&disablekb=1` +
  `&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3`;

export default function HeroVideoCard({ onOpenFull }: { onOpenFull: () => void }) {
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setTimeout(() => setPlaying(true), 1200);
    return () => window.clearTimeout(id);
  }, [reduceMotion]);

  return (
    <div className="hero-clip">
      <div className="hero-clip-frame">
        {playing ? (
          <iframe
            className="hero-clip-video"
            src={EMBED}
            title="GoldBot live profit report"
            allow="autoplay; encrypted-media; picture-in-picture"
            tabIndex={-1}
            aria-hidden="true"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="hero-clip-video"
            src={`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`}
            alt=""
            aria-hidden="true"
          />
        )}

        {/* One button over the whole card: the iframe has no controls, so every
            click belongs here and opens the full video with sound. */}
        <button type="button" className="hero-clip-hit" onClick={onOpenFull}>
          <span className="hero-clip-live">
            <span className="hero-clip-dot" aria-hidden="true" />
            Live profit
          </span>
          <span className="hero-clip-cta">
            {playing ? <Volume2 size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            Watch with sound
          </span>
        </button>
      </div>
    </div>
  );
}
