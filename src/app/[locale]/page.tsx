"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type SVGProps,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  buildPassPlans,
  buildSubscriptionPlans,
} from "@/lib/pricing-showcase";
import { GoldGlyph } from "@/components/GoldGlyph";
import { getProofMetrics } from "@/lib/landing-data";

const TESTIMONIALS = [
  "photo_2026-07-20-200k-account.jpeg",
  "photo_2026-04-15 9.21.38 p.m..jpeg",
  "photo_2026-04-15 9.21.40 p.m. (1).jpeg",
  "photo_2026-04-15 9.21.41 p.m..jpeg",
  "photo_2026-04-15 9.21.49 p.m..jpeg",
  "photo_2026-04-15 9.21.50 p.m..jpeg",
  "photo_2026-04-15 9.21.57 p.m..jpeg",
];

const ALL_IMAGES = [...TESTIMONIALS, ...TESTIMONIALS];

const HERO_PILLS = [
  "Disciplined MT5-only execution",
  "Holiday liquidity protection",
  "Account-locked cloud builds",
];

function HeroConstellation(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 900 620" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="hero-constellation" x1="78" y1="90" x2="730" y2="450" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f7dda0" />
          <stop offset="1" stopColor="#7a5a1e" stopOpacity=".08" />
        </linearGradient>
      </defs>
      <path
        d="M92 158c88-63 175-94 261-94 96 0 172 31 228 92 54 59 116 89 186 89"
        stroke="url(#hero-constellation)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M138 474c92-79 188-118 288-118 92 0 171 27 238 82"
        stroke="url(#hero-constellation)"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".65"
      />
      {[["92", "158"], ["278", "93"], ["438", "132"], ["620", "237"], ["767", "245"], ["200", "428"], ["426", "356"], ["664", "425"]].map(
        ([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r="9" fill="rgba(250, 222, 165, 0.06)" />
            <circle cx={cx} cy={cy} r="3.5" fill="#f6d48b" />
          </g>
        ),
      )}
    </svg>
  );
}

export default function Home() {
  const t = useTranslations("Landing");
  const subscriptionPlans = buildSubscriptionPlans(t);
  const passPlans = buildPassPlans(t);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let frame = 0;

    const loop = () => {
      const track = scrollRef.current;
      if (track) {
        track.scrollLeft += 0.35;
        if (track.scrollLeft >= track.scrollWidth / 2) {
          track.scrollLeft = 0;
        }
      }

      frame = window.requestAnimationFrame(loop);
    };

    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -420, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 420, behavior: "smooth" });
  };

  const nextImage = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setSelectedIndex((current) =>
      current === null ? 0 : (current + 1) % ALL_IMAGES.length,
    );
  };

  const prevImage = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setSelectedIndex((current) =>
      current === null ? 0 : (current - 1 + ALL_IMAGES.length) % ALL_IMAGES.length,
    );
  };

  return (
    <main className="main-content landing-shell">
      <section className="landing-intro">
        {/* Ambient hero backdrop: video on capable screens, still elsewhere.
            The still is also the poster, so nothing flashes while loading. */}
        <video
          className="landing-intro-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/brand/hero-chart-skyline-16x9.jpg"
          aria-hidden="true"
        >
          <source src="/brand/hero-chart-skyline-loop.webm" type="video/webm" />
          <source src="/brand/hero-chart-skyline-loop.mp4" type="video/mp4" />
        </video>
        <div className="landing-intro-photo" aria-hidden="true" />
        <div className="landing-intro-scrim" aria-hidden="true" />
        <div className="landing-intro-orb landing-intro-orb-left" aria-hidden="true" />
        <div className="landing-intro-orb landing-intro-orb-right" aria-hidden="true" />
        <HeroConstellation className="landing-intro-constellation" />

        <div className="landing-container landing-hero">
          <motion.div
            className="landing-hero-copy"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="landing-eyebrow">
              <GoldGlyph kind="halo" className="landing-eyebrow-icon" />
              {t('heroEyebrow')}
            </span>

            <h1 className="landing-hero-title">
              {t.rich("heroTitle", {
                accent: (chunks) => <span>{chunks}</span>,
              })}
            </h1>

            <p className="landing-hero-lead">
              {t("heroSubtitle")}
            </p>

            <div className="landing-hero-actions">
              <Link href="/#pricing" className="btn-primary large">
                {t('getAccess')}
                <ArrowRight size={18} />
              </Link>
              <Link href="/tutorials" className="btn-secondary large">
                {t('watchTutorials')}
              </Link>
            </div>

            {/* <div className="landing-pill-row" aria-label="GoldBot highlights">
              {HERO_PILLS.map((pill) => (
                <span key={pill} className="landing-pill">
                  {pill}
                </span>
              ))}
            </div> */}
          </motion.div>

        </div>

        <div className="landing-container landing-proof-band">
          <motion.div
            className="landing-proof-copy"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.7 }}
          >
            <span className="landing-eyebrow landing-eyebrow-muted">
              {t('designedForPerformance')}
            </span>
            <h2 className="landing-proof-title">
              {t('builtExclusivelyFor')}
              <span>{t('metaTraderSuffix')}</span>
            </h2>
            <p className="landing-proof-text">
              GoldBot cannot be installed on MT4 or other trading platforms. A valid MT5 account with your preferred broker is required, and Broker Time must be set to GMT+3 for license locking.</p>
          </motion.div>

          <div className="landing-metric-grid">
            {getProofMetrics(t).map((metric: any, index: number) => (
              <motion.article
                key={metric.label}
                className="landing-metric-card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.65, delay: index * 0.1 }}
              >
                <span className="landing-metric-value">{metric.value}</span>
                <h3>{metric.label}</h3>
                <p>{metric.detail}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section proof-gallery-section">
        <div className="landing-container proof-gallery-layout">
          <motion.div
            className="section-heading section-heading-left"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            <span className="landing-eyebrow">Verified results</span>
            <h2 className="section-title">
              Real accounts. Real screenshots.
              <span> No stock avatars.</span>
            </h2>
            <p className="section-copy">
              Every capture below is from a live member running GoldBot on MT5 —
              pulled straight from the terminal, not a rendered mockup. Judge it
              on the trades, not the marketing.
            </p>
            <div className="proof-chip-row">
              <span>Verified results</span>
              <span>Account-locked security</span>
              <span>MT5 exclusive</span>
            </div>
          </motion.div>

          <div className="proof-carousel-shell">
            <button
              type="button"
              className="proof-carousel-button proof-carousel-button-left"
              onClick={scrollLeft}
              aria-label="Scroll testimonials left"
            >
              <ChevronLeft size={22} />
            </button>

            <button
              type="button"
              className="proof-carousel-button proof-carousel-button-right"
              onClick={scrollRight}
              aria-label="Scroll testimonials right"
            >
              <ChevronRight size={22} />
            </button>

            <div className="proof-carousel-track" ref={scrollRef}>
              <div className="proof-carousel-strip">
                {ALL_IMAGES.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    className="proof-shot"
                    onClick={() => setSelectedIndex(index)}
                    aria-label={`Open proof image ${index + 1}`}
                  >
                    <div className="proof-shot-image">
                      <Image
                        src={`/testimonials/${image}`}
                        alt={`GoldBot member performance screenshot ${index + 1}`}
                        fill
                        sizes="(max-width: 768px) 72vw, 300px"
                        className="proof-shot-photo"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="landing-container">
        <p className="landing-breakdown-link">
          Want the full breakdown — features, setup, and how GoldBot compares?{" "}
          <Link href="/features">See how GoldBot works</Link>
        </p>
      </div>

      <section id="pricing" className="landing-section pricing-showcase-section">
        <div className="landing-container">
          <motion.div
            className="section-heading"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            <span className="landing-eyebrow">Pricing</span>
            <h2 className="section-title">
              Structured access with a cleaner glass-and-gold pricing system.
            </h2>
            <p className="section-copy">
              Two pricing groups, bigger typography, better spacing, and enough
              visual hierarchy to make the popular plan obvious without shouting.
            </p>
          </motion.div>

          <div className="pricing-group-shell">
            <div className="pricing-group-head">
              <span>Recurring subscriptions</span>
              <p>
                Continuous access, priority support, and the full GoldBot
                execution stack.
              </p>
            </div>

            <div className="pricing-showcase-grid pricing-showcase-grid-four">
              {subscriptionPlans.map((plan) => (
                <article
                  key={plan.id}
                  className={`pricing-tier ${plan.featured ? "pricing-tier-featured" : ""}`}
                >
                  {plan.featured && <div className="pricing-tier-badge">Most Popular</div>}
                  <GoldGlyph kind="halo" className="pricing-tier-glyph" />
                  <span className="pricing-tier-label">{plan.title}</span>
                  <div className="pricing-tier-price">
                    {plan.price}
                    <span>{plan.period}</span>
                  </div>
                  <p className="pricing-tier-note">{plan.note}</p>
                  <ul className="pricing-tier-list">
                    {plan.features.map((feature: string) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link href={`/checkout?tier=${plan.id}&robot=goldbot&name=GoldBot`} className="btn-primary fill">
                    Select Plan
                  </Link>
                </article>
              ))}
            </div>
          </div>

          <div className="pricing-group-shell pricing-group-shell-secondary">
            <div className="pricing-group-head pricing-group-head-with-art">
              <div>
                <span>{t("freeTrialTitle")}</span>
                <p>
                  {t("freeTrialActionCopy", {
                    fallback:
                      "Take a short hands-on pass through the GoldBot experience before moving into a full recurring plan.",
                  })}
                </p>
              </div>
              <Image
                src="/brand/hourglass-chart-16x9.jpg"
                alt=""
                width={280}
                height={158}
                className="pricing-group-art"
              />
            </div>

            <div className="pricing-showcase-grid pricing-showcase-grid-two">
              {passPlans.map((plan) => (
                <article key={plan.id} className="pricing-tier pricing-tier-secondary">
                  <GoldGlyph kind="vault" className="pricing-tier-glyph" />
                  <span className="pricing-tier-label">{plan.title}</span>
                  <div className="pricing-tier-price">
                    {plan.price}
                    <span>{plan.period}</span>
                  </div>
                  <p className="pricing-tier-note">{plan.note}</p>
                  <ul className="pricing-tier-list">
                    {plan.features.map((feature: string) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link href={`/checkout?tier=${plan.id}&robot=goldbot&name=GoldBot`} className="btn-primary fill">
                    Select Plan
                  </Link>
                </article>
              ))}

              <article className="pricing-tier pricing-tier-secondary pricing-tier-preview">
                <div className="pricing-tier-badge pricing-tier-badge-preview">
                  Coming Soon
                </div>
                <GoldGlyph kind="halo" className="pricing-tier-glyph" />
                <span className="pricing-tier-label">
                  Pay After Trial
                </span>
                <p className="pricing-tier-preview-hook">
                  Zero upfront. Pay only if your first 3 days close in profit.
                </p>
                <p className="pricing-tier-note">
                  We&apos;re building the verification behind this so results are checked fairly before anyone is charged.
                </p>
                <ul className="pricing-tier-list">
                  <li>Same 3-day hands-on trial</li>
                  <li>No card required to start</li>
                  <li>Charged only on a profitable trial</li>
                </ul>
                <span className="btn-secondary fill pricing-tier-preview-cta" aria-disabled="true">
                  Notify Me When Ready
                </span>
              </article>
            </div>

            <p className="pricing-licensing-link">
              Need lifetime access, source code, or a private deal?{" "}
              <Link href="/licensing">See licensing options</Link>
            </p>

            <p className="pricing-licensing-link">
              GoldBot is one of several strategies we ship.{" "}
              <Link href="/catalog">Browse all robots</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section final-cta-rebuild">
        <div className="landing-container">
          <motion.div
            className="final-cta-panel"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            <GoldGlyph kind="halo" className="final-cta-glyph" />
            <span className="landing-eyebrow">{t("deployGoldBot")}</span>
            <h2 className="section-title">
              Ready to move from checkout to chart execution in minutes?
            </h2>
            <p className="section-copy">
              Start with the monthly plan, lock the EA to your MT5 account, and
              move through the setup flow without the usual friction.
            </p>

            <div className="landing-hero-actions final-cta-actions">
              <Link href="/checkout?tier=1-month&robot=goldbot&name=GoldBot" className="btn-primary large">
                Start Monthly Plan
                <ArrowRight size={18} />
              </Link>
              <Link href="/tutorials" className="btn-secondary large">
                See Setup Tutorials
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {selectedIndex !== null && (
        <div className="gallery-modal" onClick={() => setSelectedIndex(null)}>
          <div className="gallery-modal-frame" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="gallery-modal-nav gallery-modal-nav-left"
              onClick={prevImage}
              aria-label="Previous proof image"
            >
              <ChevronLeft size={24} />
            </button>

            <button
              type="button"
              className="gallery-modal-nav gallery-modal-nav-right"
              onClick={nextImage}
              aria-label="Next proof image"
            >
              <ChevronRight size={24} />
            </button>

            <button
              type="button"
              className="gallery-modal-close"
              onClick={() => setSelectedIndex(null)}
              aria-label="Close proof image"
            >
              <X size={20} />
            </button>

            <div className="gallery-modal-image">
              <Image
                src={`/testimonials/${ALL_IMAGES[selectedIndex]}`}
                alt="Expanded GoldBot member performance screenshot"
                fill
                sizes="90vw"
                className="gallery-modal-photo"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
