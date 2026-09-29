"use client";

import { motion, useAnimation, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

// Same shapes as lucide's BadgeCheck, split so each part can animate.
const BADGE_PATH =
  "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z";
const CHECK_PATH = "m9 12 2 2 4-4";

/**
 * Filled "Verified" badge: the badge pops in, the check draws itself, then a
 * ring pulses out once. Plays when scrolled into view, and replays whenever
 * the pointer enters the surrounding card (`hoverTarget` selector).
 */
export default function VerifiedBadge({ hoverTarget }: { hoverTarget?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [replay, setReplay] = useState(0);
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const reduceMotion = useReducedMotion();
  const controls = useAnimation();

  useEffect(() => {
    const card = hoverTarget ? ref.current?.closest(hoverTarget) : null;
    if (!card || reduceMotion) return;
    const onEnter = () => setReplay((count) => count + 1);
    card.addEventListener("mouseenter", onEnter);
    return () => card.removeEventListener("mouseenter", onEnter);
  }, [hoverTarget, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      controls.set("done");
      return;
    }
    if (!inView) return;
    controls.set("hidden");
    controls.start("done");
  }, [inView, replay, reduceMotion, controls]);

  return (
    <span ref={ref} className="vbadge">
      <motion.span
        className="vbadge-ring"
        aria-hidden="true"
        initial="hidden"
        animate={controls}
        variants={{
          hidden: { scale: 0.6, opacity: 0 },
          done: {
            scale: [0.6, 1.9],
            opacity: [0.55, 0],
            transition: { duration: 0.9, delay: 0.55, ease: "easeOut" },
          },
        }}
      />
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <motion.path
          d={BADGE_PATH}
          className="vbadge-shape"
          initial="hidden"
          animate={controls}
          variants={{
            hidden: { scale: 0.4, opacity: 0, rotate: -30 },
            done: {
              scale: 1,
              opacity: 1,
              rotate: 0,
              transition: {
                type: "spring",
                stiffness: 420,
                damping: 18,
                opacity: { duration: 0.2, ease: "easeOut" },
              },
            },
          }}
          style={{ transformOrigin: "12px 12px" }}
        />
        <motion.path
          d={CHECK_PATH}
          className="vbadge-check"
          initial="hidden"
          animate={controls}
          variants={{
            hidden: { pathLength: 0, opacity: 0 },
            done: {
              pathLength: 1,
              opacity: 1,
              transition: { duration: 0.4, delay: 0.25, ease: EASE },
            },
          }}
        />
      </svg>
    </span>
  );
}
