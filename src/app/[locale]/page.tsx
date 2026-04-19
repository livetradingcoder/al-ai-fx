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
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, X } from "lucide-react";

const TESTIMONIALS = [
  "photo_2026-04-15 9.21.38 p.m..jpeg",
  "photo_2026-04-15 9.21.40 p.m. (1).jpeg",
  "photo_2026-04-15 9.21.41 p.m..jpeg",
  "photo_2026-04-15 9.21.49 p.m..jpeg",
  "photo_2026-04-15 9.21.50 p.m..jpeg",
  "photo_2026-04-15 9.21.56 p.m..jpeg",
  "photo_2026-04-15 9.21.57 p.m..jpeg",
  "photo_2026-04-15 9.21.58 p.m..jpeg",
];

const ALL_IMAGES = [...TESTIMONIALS, ...TESTIMONIALS];

const HERO_PILLS = [
  "Disciplined MT5-only execution",
  "Holiday liquidity protection",
  "Account-locked cloud builds",
];

const PROOF_METRICS = [
  {
    value: "< 15s",
    label: "Personalized compile",
    detail: "From MT5 account lock to download-ready package.",
  },
  {
    value: "1:1",
    label: "License binding",
    detail: "One GoldBot build per approved MT5 account.",
  },
  {
    value: "24/7",
    label: "Automated ruleset",
    detail: "Execution logic that stays on plan around the clock.",
  },
];

const FEATURE_PANELS = [
  {
    eyebrow: "Adaptive Recovery",
    title: "Smart hedging that protects structure when the market gets violent.",
    body:
      "Recovery logic is designed to react with discipline, not panic. GoldBot stays focused on position structure, exposure control, and controlled re-entry instead of brute-force escalation.",
    bullets: [
      "Structured hedge handling",
      "Drawdown-aware exposure logic",
      "Cleaner prop-firm behavior",
    ],
    glyph: "signal",
    layout: "feature-panel-large",
  },
  {
    eyebrow: "Liquidity Guard",
    title: "Holiday filters cut the dead hours before they damage performance.",
    body:
      "UK, US, DE, FR, and IT holiday conditions are screened automatically so the EA stays away from thin, distorted sessions.",
    bullets: ["Bank-holiday screening", "Session-aware execution"],
    glyph: "shield",
    layout: "feature-panel-tall",
  },
  {
    eyebrow: "Private Build",
    title: "Cloud compiled for your account instead of shipped like public slop.",
    body:
      "GoldBot is compiled uniquely for the MT5 account you authorize, avoiding the usual slow web-request license traps inside the EA.",
    bullets: ["Account-specific executable", "No laggy in-bot license ping"],
    glyph: "vault",
    layout: "feature-panel-compact",
  },
  {
    eyebrow: "{t('executionCharacter')}",
    title: "Built for traders who want calm automation, not noisy theatrics.",
    body:
      "Every section of the product is aimed at disciplined execution: fast provisioning, clear risk posture, and a setup path that gets you live without chaos.",
    bullets: ["Fast deployment", "Clear setup path", "MT5-native workflow"],
    glyph: "halo",
    layout: "feature-panel-wide",
  },
];

const SUBSCRIPTION_PLANS = [
  {
    id: "10-days",
    title: "10 Days",
    price: "$51",
    period: "for 10 days",
    note: "Fast validation window",
    features: [
      "Basic feature set",
      "Standard recovery profile",
      "Automated delivery",
    ],
  },
  {
    id: "1-month",
    title: "Monthly",
    price: "$149",
    period: "per month",
    note: "Best place to start",
    featured: true,
    features: [
      "Unlimited downloads",
      "All strategy features",
      "Automated delivery",
    ],
  },
  {
    id: "6-months",
    title: "Biannual",
    price: "$499",
    period: "per 6 months",
    note: "Lower maintenance cadence",
    features: [
      "Unlimited downloads",
      "All strategy features",
      "Priority Liquid Guard",
      "Automated delivery",
    ],
  },
];

const PASS_PLANS = [
  {
    id: "free-trial",
    title: "Free Trial",
    price: "$0",
    period: "for 3 days",
    note: "Short hands-on test",
    features: [
      "Basic feature set",
      "Standard recovery profile",
      "Automated delivery",
    ],
  },
  {
    id: "lifetime",
    title: "Lifetime",
    price: "$999",
    period: "one-time",
    note: "Permanent access",
    features: [
      "Unlimited source copies",
      "All strategy features",
      "VIP setup support",
      "Automated delivery",
    ],
  },
];

const EXECUTION_FLOW = [
  {
    title: "Choose a plan",
    copy: "Pick the access window that matches your trading cadence and clear checkout securely.",
    eta: "ETA 1 min",
    glyph: "wallet",
  },
  {
    title: "Create dashboard access",
    copy: "Your dashboard account is provisioned immediately against the purchase email you used.",
    eta: "Instant",
    glyph: "halo",
  },
  {
    title: "Bind your MT5 account",
    copy: "Enter the MT5 account number that should own the build and keep licensing clean.",
    eta: "ETA 30 sec",
    glyph: "vault",
  },
  {
    title: "Compile in the cloud",
    copy: "GoldBot is compiled into a personalized executable package tuned to that approved account.",
    eta: "ETA < 15 sec",
    glyph: "signal",
  },
  {
    title: "Install and launch",
    copy: "Drop the file into MT5, attach it to chart, set your risk profile, and go live.",
    eta: "ETA 2 min",
    glyph: "launch",
  },
];

const OPS_PILLARS = [
  {
    title: "Liquidity guard",
    copy: "Execution is restricted during low-liquidity holiday windows and fragile sessions.",
    glyph: "shield",
  },
  {
    title: "Account-level locking",
    copy: "Each build is tied to your MT5 account so licensing stays clean and distribution stays controlled.",
    glyph: "vault",
  },
  {
    title: "Fast deployment",
    copy: "Provisioning and compilation are engineered to be quick enough that setup does not drag on.",
    glyph: "launch",
  },
];

const COMPARE_ROWS = [
  {
    capability: "Account-specific executable",
    goldbot: "Included by default",
    typical: "Rare or missing",
  },
  {
    capability: "Holiday liquidity protection",
    goldbot: "Built into the workflow",
    typical: "Usually manual",
  },
  {
    capability: "Provisioning speed",
    goldbot: "Ready in minutes",
    typical: "Hours or days",
  },
  {
    capability: "License integrity",
    goldbot: "Cloud compiled + account bound",
    typical: "Shared files and weak checks",
  },
];

function GoldGlyph({
  kind,
  ...props
}: { kind: string } & SVGProps<SVGSVGElement>) {
  switch (kind) {
    case "halo":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <circle cx="32" cy="32" r="21" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="32" cy="32" r="11" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M32 5v10M32 49v10M5 32h10M49 32h10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "signal":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <path
            d="M8 44c6-10 12-15 18-15s10 6 16 6 8-4 14-15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M8 52c6-10 12-15 18-15s10 6 16 6 8-4 14-15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".45"
          />
          <circle cx="26" cy="29" r="4" fill="currentColor" />
          <circle cx="42" cy="35" r="4" fill="currentColor" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <path
            d="M32 8l18 7v13c0 13-7.6 22.7-18 28-10.4-5.3-18-15-18-28V15l18-7Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="m24 32 5.5 5.5L41 25"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "vault":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <rect x="10" y="14" width="44" height="36" rx="10" stroke="currentColor" strokeWidth="2" />
          <circle cx="32" cy="32" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M32 24v16M24 32h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <path
            d="M12 22c0-4.4 3.6-8 8-8h28c2.2 0 4 1.8 4 4v6H20c-4.4 0-8 3.6-8 8v-10Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect x="12" y="24" width="40" height="26" rx="10" stroke="currentColor" strokeWidth="2" />
          <circle cx="41.5" cy="37" r="2.5" fill="currentColor" />
        </svg>
      );
    case "launch":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <path
            d="M36 12c10 3 16 13 16 24-10 0-20 6-24 16-7-11-6-27 8-40Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M20 44c-3 1-6 4-7 8 4-1 7-4 8-7M26 38l-8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="39" cy="25" r="3" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <circle cx="32" cy="32" r="21" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

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

function SectionWireframe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 320 72" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 36h76l18-18h124l18 18h76"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity=".7"
      />
      <circle cx="160" cy="18" r="6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="160" cy="54" r="6" fill="currentColor" />
      <path d="M160 24v24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function Home() {
  const t = useTranslations("Landing");

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
              {t('heroTitlePrefix')}
              <span>{t('heroTitleSuffix')}</span>
            </h1>

            <p className="landing-hero-lead">
              GoldBot is an MT5 EA with account-bound cloud compilation, and
              risk-aware execution logic designed for controlled MetaTrader 5
              deployment.
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

          <motion.div
            className="landing-hero-stage"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15 }}
          >
            <div className="hero-stage-backplate" aria-hidden="true" />
            <div className="hero-stage-frame">
              <div className="hero-stage-image-shell">
                <Image
                  src="/goldbotmt5.avif"
                  alt="GoldBot MT5 dashboard preview"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  className="hero-stage-image"
                />
              </div>

              <div className="hero-floating-card hero-floating-card-top">
                <div className="hero-floating-meta">
                  <span>Signal quality</span>
                  <strong>High confidence</strong>
                </div>
                <GoldGlyph kind="signal" className="hero-floating-glyph" />
              </div>

              {/* <div className="hero-floating-card hero-floating-card-bottom">
                <div className="hero-floating-meta">
                  <span>Risk posture</span>
                  <strong>Adaptive shield on</strong>
                </div>
                <GoldGlyph kind="shield" className="hero-floating-glyph" />
              </div> */}

              <div className="hero-stage-caption">
                <span className="hero-caption-kicker">{t('executionCharacter')}</span>
                <h2>{t('builtForControlled')}</h2>
                <p>
                  Consistent decision rules, protective recovery logic, and
                  account-level security are designed into the experience from
                  the start.
                </p>
              </div>
            </div>
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
            <SectionWireframe className="landing-proof-wireframe" />
          </motion.div>

          <div className="landing-metric-grid">
            {PROOF_METRICS.map((metric, index) => (
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
            <span className="landing-eyebrow">Verified proof</span>
            <h2 className="section-title">
              Screenshots over slogans.
              <span> Real member performance, framed properly.</span>
            </h2>
            <p className="section-copy">
              Social proof does not need fake avatars and generic microcards.
              This section leads with actual result captures and a cleaner,
              wider gallery treatment.
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

      <section id="features" className="landing-section feature-showcase-section">
        <div className="landing-container">
          <motion.div
            className="section-heading"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            <span className="landing-eyebrow">Why GoldBot</span>
            <h2 className="section-title">
              A bigger, more modern surface for the reasons traders actually care.
            </h2>
            <p className="section-copy">
              The old equal-size cards are gone. This section now reads like a
              product story with hierarchy, asymmetry, and purpose-built SVG
              detail.
            </p>
          </motion.div>

          <div className="feature-mosaic">
            {FEATURE_PANELS.map((panel, index) => (
              <motion.article
                key={panel.title}
                className={`feature-panel ${panel.layout}`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.65, delay: index * 0.06 }}
              >
                <div className="feature-panel-glyph-wrap">
                  <GoldGlyph kind={panel.glyph} className="feature-panel-glyph" />
                </div>
                <span className="feature-panel-eyebrow">{panel.eyebrow}</span>
                <h3>{panel.title}</h3>
                <p>{panel.body}</p>
                <ul className="feature-panel-bullets">
                  {panel.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

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

            <div className="pricing-showcase-grid pricing-showcase-grid-three">
              {SUBSCRIPTION_PLANS.map((plan) => (
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
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link href={`/checkout?tier=${plan.id}`} className="btn-primary fill">
                    Select Plan
                  </Link>
                </article>
              ))}
            </div>
          </div>

          <div className="pricing-group-shell pricing-group-shell-secondary">
            <div className="pricing-group-head">
              <span>Passes & lifetime</span>
              <p>
                One-time payment options for short validation or permanent
                access.
              </p>
            </div>

            <div className="pricing-showcase-grid pricing-showcase-grid-two">
              {PASS_PLANS.map((plan) => (
                <article key={plan.id} className="pricing-tier pricing-tier-secondary">
                  <GoldGlyph kind="vault" className="pricing-tier-glyph" />
                  <span className="pricing-tier-label">{plan.title}</span>
                  <div className="pricing-tier-price">
                    {plan.price}
                    <span>{plan.period}</span>
                  </div>
                  <p className="pricing-tier-note">{plan.note}</p>
                  <ul className="pricing-tier-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link href={`/checkout?tier=${plan.id}`} className="btn-primary fill">
                    Select Plan
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section process-section">
        <div className="landing-container process-shell">
          <motion.div
            className="section-heading"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            <span className="landing-eyebrow">How it works</span>
            <h2 className="section-title">
              The numbered bubbles are gone.
              <span> The flow is now glass, gold, and editorial.</span>
            </h2>
            <p className="section-copy">
              Provisioning is presented as a polished setup sequence instead of
              five generic boxes with giant step numbers.
            </p>
          </motion.div>

          <SectionWireframe className="process-wireframe" />

          <div className="process-grid">
            {EXECUTION_FLOW.map((step, index) => (
              <motion.article
                key={step.title}
                className="process-card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: index * 0.06 }}
              >
                <div className="process-card-top">
                  <GoldGlyph kind={step.glyph} className="process-card-glyph" />
                  <span className="process-eta">
                    <Clock3 size={14} />
                    {step.eta}
                  </span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section ops-rebuild-section">
        <div className="landing-container ops-rebuild-layout">
          <motion.div
            className="ops-master-panel"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            <span className="landing-eyebrow">Risk-aware automation</span>
            <h2 className="section-title section-title-left">
              Built for traders who want clean behavior across changing market conditions.
            </h2>
            <p className="section-copy section-copy-left">
              This section is no longer a basic row of cards. It now anchors the
              landing with a larger statement panel and supporting operational
              pillars that feel consistent with the hero.
            </p>
            <GoldGlyph kind="signal" className="ops-master-glyph" />
          </motion.div>

          <div className="ops-pillar-stack">
            {OPS_PILLARS.map((pillar, index) => (
              <motion.article
                key={pillar.title}
                className="ops-pillar-card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: index * 0.08 }}
              >
                <GoldGlyph kind={pillar.glyph} className="ops-pillar-glyph" />
                <h3>{pillar.title}</h3>
                <p>{pillar.copy}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section compare-rebuild-section">
        <div className="landing-container">
          <motion.div
            className="section-heading"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            <span className="landing-eyebrow">Comparison</span>
            <h2 className="section-title">
              The last comparison block is rebuilt into a proper modern board.
            </h2>
            <p className="section-copy">
              Same message, better hierarchy. GoldBot is visually separated from
              the generic public-EA category without relying on a flat default
              table.
            </p>
          </motion.div>

          <div className="compare-board">
            <div className="compare-board-head">
              <span>Capability</span>
              <span>GoldBot</span>
              <span>Typical public EA</span>
            </div>

            {COMPARE_ROWS.map((row) => (
              <div key={row.capability} className="compare-board-row">
                <span className="compare-board-capability">{row.capability}</span>
                <span className="compare-board-good">{row.goldbot}</span>
                <span className="compare-board-bad">{row.typical}</span>
              </div>
            ))}
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
            <span className="landing-eyebrow">Deploy GoldBot</span>
            <h2 className="section-title">
              Ready to move from checkout to chart execution in minutes?
            </h2>
            <p className="section-copy">
              Start with the monthly plan, lock the EA to your MT5 account, and
              move through the setup flow without the usual friction.
            </p>

            <div className="landing-hero-actions final-cta-actions">
              <Link href="/checkout?tier=1-month" className="btn-primary large">
                Start Monthly Plan
                <ArrowRight size={18} />
              </Link>
              <Link href="/tutorials" className="btn-secondary large">
                See Setup Tutorials
              </Link>
            </div>

            <div className="final-cta-footnotes">
              <span>MT5 only</span>
              <span>Account-bound builds</span>
              <span>Cloud compiled delivery</span>
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
