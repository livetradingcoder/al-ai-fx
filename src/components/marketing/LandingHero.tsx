"use client";

import { useRef, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import { GoldGlyph } from "@/components/GoldGlyph";

const EASE = [0.22, 1, 0.36, 1] as const;

const HERO_POINTS = ["Holiday liquidity protection", "Account-locked cloud builds"];

const copyVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.25 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: EASE },
  },
};

export default function LandingHero() {
  const t = useTranslations("Landing");
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);

  // Scroll parallax: artwork drifts down slower than the page while the
  // copy lifts and fades, so leaving the hero feels layered, not flat.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const mediaY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  // Cursor parallax: a few pixels of counter-movement on the artwork.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 60, damping: 20 });
  const springY = useSpring(pointerY, { stiffness: 60, damping: 20 });
  const mediaX = useTransform(springX, (v) => v * -18);
  const mediaTilt = useTransform(springY, (v) => v * -12);
  const badgeX = useTransform(springX, (v) => v * 14);
  const badgeY = useTransform(springY, (v) => v * 10);

  const handlePointer = (event: MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <div
      ref={sectionRef}
      className="hero-robot"
      onMouseMove={handlePointer}
      onMouseLeave={resetPointer}
    >
      <motion.div
        className="hero-robot-media"
        style={reduceMotion ? undefined : { y: mediaY }}
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: EASE }}
        aria-hidden="true"
      >
        <motion.div
          className="hero-robot-media-inner"
          style={reduceMotion ? undefined : { x: mediaX, y: mediaTilt }}
        >
          <Image
            src="/brand/hero-robot-gold.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="hero-robot-img"
          />
        </motion.div>
      </motion.div>
      <div className="hero-robot-scrim" aria-hidden="true" />

      <motion.div
        className="landing-container landing-hero hero-robot-content"
        style={reduceMotion ? undefined : { y: copyY, opacity: copyOpacity }}
      >
        <motion.div
          className="landing-hero-copy"
          variants={copyVariants}
          initial="hidden"
          animate="show"
        >
          <motion.span className="landing-eyebrow" variants={itemVariants}>
            <GoldGlyph kind="halo" className="landing-eyebrow-icon" />
            {t("heroEyebrow")}
          </motion.span>

          <motion.h1 className="landing-hero-title" variants={itemVariants}>
            {t.rich("heroTitle", {
              accent: (chunks) => (
                <motion.span
                  className="hero-robot-accent"
                  initial={{ clipPath: "inset(0 100% 0 0)" }}
                  animate={{ clipPath: "inset(0 0% 0 0)" }}
                  transition={{ duration: 1, delay: 0.75, ease: EASE }}
                >
                  {chunks}
                </motion.span>
              ),
            })}
          </motion.h1>

          <motion.p className="landing-hero-lead" variants={itemVariants}>
            {t("heroSubtitle")}
          </motion.p>

          <motion.div className="landing-hero-actions" variants={itemVariants}>
            <Link href="/#pricing" className="btn-primary large hero-robot-cta">
              {t("getAccess")}
              <ArrowRight size={18} />
            </Link>
            <Link href="/tutorials" className="btn-secondary large">
              {t("watchTutorials")}
            </Link>
          </motion.div>

          <motion.ul
            className="hero-robot-trust"
            aria-label="GoldBot highlights"
            variants={itemVariants}
          >
            <li className="hero-robot-trust-mt5">
              <Image
                src="/brand/metatrader-5.png"
                alt=""
                width={22}
                height={22}
              />
              Built for MetaTrader 5
            </li>
            {HERO_POINTS.map((point) => (
              <li key={point}>
                <span className="hero-robot-trust-dot" aria-hidden="true" />
                {point}
              </li>
            ))}
          </motion.ul>
        </motion.div>
      </motion.div>

      <motion.div
        className="hero-robot-badge-wrap"
        style={reduceMotion ? undefined : { x: badgeX, y: badgeY }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 1.1, ease: EASE }}
      >
        <div className="hero-robot-badge">
          <Image
            src="/brand/metatrader-5.png"
            alt="MetaTrader 5"
            width={40}
            height={40}
          />
          <span>
            <strong>MetaTrader 5</strong>
            <small>Native EA · XAUUSD</small>
          </span>
          <span className="hero-robot-badge-live">
            <span aria-hidden="true" />
            Ready
          </span>
        </div>
      </motion.div>

      <div className="hero-robot-scroll" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
