"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import NotifyMeForm from "@/components/marketing/NotifyMeForm";
import LandingHero from "@/components/marketing/LandingHero";
import VerifiedBadge from "@/components/marketing/VerifiedBadge";
import ProofViewer, { type ProofShot } from "@/components/marketing/ProofViewer";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  KeyRound,
  Layers,
  Lock,
  Maximize2,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  buildPassPlans,
  buildSubscriptionPlans,
} from "@/lib/pricing-showcase";
import { FLAGSHIP_ROBOT } from "@/config/pricing";
import { getProofMetrics } from "@/lib/landing-data";
import "./landing-theme.css";

const TESTIMONIALS = [
  "photo_2026-09-11-history-profit-73.jpeg",
  "photo_2026-09-11-history-profit-54.jpeg",
  "photo_2026-09-10-desktop-history.jpeg",
  "photo_2026-09-09-history-profit-730.jpeg",
  "photo_2026-09-09-history-profit-99.jpeg",
  "photo_2026-07-20-200k-account.jpeg",
  "photo_2026-04-15 9.21.38 p.m..jpeg",
  "photo_2026-04-15 9.21.40 p.m. (1).jpeg",
  "photo_2026-04-15 9.21.41 p.m..jpeg",
  "photo_2026-04-15 9.21.49 p.m..jpeg",
  "photo_2026-04-15 9.21.50 p.m..jpeg",
  "photo_2026-04-15 9.21.57 p.m..jpeg",
];

const ALL_IMAGES = [...TESTIMONIALS, ...TESTIMONIALS];

const VERIFIED_POINTS = [
  { icon: ShieldCheck, title: "Straight from the terminal", detail: "Unedited MT5 history captures" },
  { icon: Lock, title: "Account-locked builds", detail: "Each result runs on its own licensed EA" },
  { icon: MonitorSmartphone, title: "Desktop and mobile", detail: "Captured wherever members trade" },
];

const DEPLOY_STEPS = [
  { title: "Pick a plan", detail: "Monthly is the easiest place to start" },
  { title: "Lock your MT5 account", detail: "Your build is bound to one approved account" },
  { title: "Download and attach", detail: "Your compiled EA is ready in seconds" },
];

const SHOT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Captions come from the capture filenames, so they never claim more than
// the file itself records.
function shotDate(file: string) {
  const match = file.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${SHOT_MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

function describeShot(file: string) {
  if (file.includes("desktop")) return "Desktop history";
  if (file.includes("account")) return "Account overview";
  return "Trade history";
}

// The carousel doubles the list for its seamless loop; the viewer shows each
// screenshot once.
const PROOF_SHOTS: ProofShot[] = TESTIMONIALS.map((file) => ({
  file,
  label: describeShot(file),
  date: shotDate(file),
}));

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

  // The free trial belongs to whichever robot prices it at zero — and may be
  // unavailable to this visitor entirely (per-IP cooldown or monthly cap), so
  // the card has to ask rather than assume.
  const [trial, setTrial] = useState<{
    offered: boolean;
    robotSlug?: string;
    robotName?: string;
    available: boolean;
    message?: string;
    resetsAt?: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/checkout/free-trial/availability")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setTrial(data);
      })
      .catch(() => {
        /* the card falls back to its default link */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -420, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 420, behavior: "smooth" });
  };


  return (
    <main className="main-content landing-shell">
      <section className="landing-intro">
        <LandingHero />

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
              <span className="mt5-inline">
                <Image
                  src="/brand/metatrader-5.png"
                  alt=""
                  width={48}
                  height={48}
                  className="mt5-inline-logo"
                />
                {t('metaTraderSuffix')}
              </span>
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

      <section className="landing-section vr-section">
        <div className="landing-container vr-head">
          <motion.div
            className="vr-head-copy"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            <span className="vr-eyebrow">
              <span className="vr-live-dot" aria-hidden="true" />
              Verified results
            </span>
            <h2 className="section-title">
              Real accounts. Real screenshots.
              <span> No stock avatars.</span>
            </h2>
            <p className="section-copy">
              Every capture below is from a live member running GoldBot on MT5 —
              pulled straight from the terminal, not a rendered mockup. Judge it
              on the trades, not the marketing.
            </p>
          </motion.div>

          <ul className="vr-points">
            {VERIFIED_POINTS.map(({ icon: Icon, title, detail }, index) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              >
                <span className="vr-point-icon">
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="vr-rail">
          <div className="vr-track" ref={scrollRef}>
            <div className="vr-strip">
              {ALL_IMAGES.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  className="vr-card"
                  onClick={() => setSelectedIndex(index)}
                  aria-label={`Open proof image ${index + 1}`}
                >
                  <span className="vr-card-top">
                    <span className="vr-card-tag">
                      <Image src="/brand/metatrader-5.png" alt="" width={14} height={14} />
                      MT5
                    </span>
                    <span className="vr-card-verified">
                      <VerifiedBadge hoverTarget=".vr-card" />
                      Verified
                    </span>
                  </span>
                  <span className="vr-card-frame">
                    <Image
                      src={`/testimonials/${image}`}
                      alt={`GoldBot member performance screenshot ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 70vw, 280px"
                      className="vr-card-photo"
                    />
                    <span className="vr-card-zoom" aria-hidden="true">
                      <Maximize2 size={16} />
                    </span>
                  </span>
                  <span className="vr-card-meta">
                    <span>{describeShot(image)}</span>
                    <time>{shotDate(image)}</time>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="landing-container vr-foot">
          <p>
            <span className="vr-count">Proof of results</span> · straight from
            live MT5 terminals · tap any capture to enlarge
          </p>
          <div className="vr-controls">
            <button type="button" onClick={scrollLeft} aria-label="Scroll testimonials left">
              <ChevronLeft size={20} />
            </button>
            <button type="button" onClick={scrollRight} aria-label="Scroll testimonials right">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </section>

      <div className="landing-container">
        <p className="landing-breakdown-link">
          Want the full breakdown — features, setup, and how GoldBot compares?{" "}
          <Link href="/features">See how GoldBot works</Link>
        </p>
      </div>

      <section id="pricing" className="landing-section pc-section">
        <div className="landing-container">
          <motion.div
            className="section-heading pc-heading"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            <span className="landing-eyebrow">Pricing</span>
            <h2 className="section-title">
              Simple plans.
              <span> Serious execution.</span>
            </h2>
            <p className="section-copy">
              Every plan delivers a GoldBot build compiled for your MT5 account.
              Prices shown are for {FLAGSHIP_ROBOT.name}, our four-range
              flagship — robots trading one to seven ranges are in the{" "}
              <Link href="/catalog">catalog</Link>.
            </p>
          </motion.div>

          <div className="pc-grid">
            {subscriptionPlans.map((plan, index) => (
              <motion.article
                key={plan.id}
                className={`pc-card ${plan.featured ? "is-featured" : ""}`}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="pc-card-head">
                  <h3>{plan.title}</h3>
                  {plan.featured && <span className="pc-badge">Most popular</span>}
                </div>
                <p className="pc-tagline">{plan.note.replace(/[()]/g, "")}</p>

                <div className="pc-price">
                  <strong>{plan.price}</strong>
                  <span>{plan.period}</span>
                </div>

                <Link
                  href={`/checkout?tier=${plan.id}&robot=${FLAGSHIP_ROBOT.slug}&name=${encodeURIComponent(FLAGSHIP_ROBOT.name)}`}
                  className={`pc-cta ${plan.featured ? "is-primary" : ""}`}
                >
                  Get MultiRange 4
                  <ArrowRight size={16} />
                </Link>

                <div className="pc-divider" />

                <ul className="pc-features">
                  {plan.features.map((feature: string) => (
                    <li key={feature}>
                      <span className="pc-check" aria-hidden="true">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </div>

          <ul className="pc-assurances">
            <li>
              <KeyRound size={16} aria-hidden="true" />
              Account-locked build
            </li>
            <li>
              <Zap size={16} aria-hidden="true" />
              Delivered automatically after checkout
            </li>
            <li>
              <Image src="/brand/metatrader-5.png" alt="" width={16} height={16} />
              Runs on MetaTrader 5
            </li>
          </ul>

          <div className="pc-trial">
            <motion.div
              className="pc-trial-intro"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
            >
              <span className="landing-eyebrow">
                <Clock size={14} aria-hidden="true" />
                Try it first
              </span>
              <h3>Not ready to commit?</h3>
              <p>
                {t("freeTrialActionCopy", {
                  fallback:
                    "Take a short hands-on pass through the GoldBot experience before moving into a full recurring plan.",
                })}
              </p>
              <Image
                src="/brand/hourglass-chart-16x9.jpg"
                alt=""
                width={560}
                height={315}
                className="pc-trial-art"
              />
            </motion.div>

            {passPlans.map((plan) => (
              <motion.article
                key={plan.id}
                className="pc-card pc-card-trial"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: 0.08 }}
              >
                <div className="pc-card-head">
                  <h3>{plan.title}</h3>
                </div>
                <p className="pc-tagline">{plan.note}</p>
                <div className="pc-price">
                  <strong>{plan.price}</strong>
                  <span>{plan.period}</span>
                </div>

                {trial && trial.offered && !trial.available ? (
                  <>
                    <span className="pc-cta is-disabled" aria-disabled="true">
                      Currently unavailable
                    </span>
                    <p className="pc-fineprint">
                      {trial.message}
                      {trial.resetsAt
                        ? ` Try again after ${new Date(trial.resetsAt).toLocaleDateString()}.`
                        : ""}
                    </p>
                  </>
                ) : trial && !trial.offered ? (
                  <span className="pc-cta is-disabled" aria-disabled="true">
                    No trial available right now
                  </span>
                ) : (
                  <Link
                    href={`/checkout?tier=${plan.id}&robot=${trial?.robotSlug ?? "precision-trader"}&name=${encodeURIComponent(trial?.robotName ?? "PrecisionTrader")}`}
                    className="pc-cta is-primary"
                  >
                    Start free trial{trial?.robotName ? ` — ${trial.robotName}` : ""}
                    <ArrowRight size={16} />
                  </Link>
                )}

                <div className="pc-divider" />

                <ul className="pc-features">
                  {plan.features.map((feature: string) => (
                    <li key={feature}>
                      <span className="pc-check" aria-hidden="true">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.article>
            ))}

            <motion.article
              className="pc-card pc-card-soon"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: 0.16 }}
            >
              <div className="pc-card-head">
                <h3>Pay After Trial</h3>
                <span className="pc-badge is-muted">
                  <Sparkles size={12} aria-hidden="true" />
                  Coming soon
                </span>
              </div>
              <p className="pc-soon-hook">
                Zero upfront. Pay only if your first 3 days close in profit.
              </p>
              <p className="pc-tagline">
                We&apos;re building the verification behind this so results are
                checked fairly before anyone is charged.
              </p>
              <ul className="pc-features">
                {[
                  "Same 3-day hands-on trial",
                  "No card required to start",
                  "Charged only on a profitable trial",
                ].map((feature) => (
                  <li key={feature}>
                    <span className="pc-check is-muted" aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="pc-notify">
                <NotifyMeForm source="al-ai-fx:pay-after-trial" />
              </div>
            </motion.article>
          </div>

          <div className="pc-more">
            <Link href="/licensing" className="pc-more-link">
              <KeyRound size={18} aria-hidden="true" />
              <span>
                <strong>Lifetime, source code, or a private deal?</strong>
                <small>See licensing options</small>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/catalog" className="pc-more-link">
              <Layers size={18} aria-hidden="true" />
              <span>
                <strong>GoldBot is one of several strategies</strong>
                <small>Browse all robots</small>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-section dp-section">
        <div className="landing-container">
          <motion.div
            className="dp-panel"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="dp-art" aria-hidden="true">
              <Image
                src="/brand/hero-robot-gold.png"
                alt=""
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                className="dp-art-img"
              />
            </div>

            <div className="dp-copy">
              <span className="landing-eyebrow">{t("deployGoldBot")}</span>
              <h2 className="section-title">
                From checkout to chart
                <span> in minutes.</span>
              </h2>
              <p className="section-copy">
                Start with the monthly plan, lock the EA to your MT5 account, and
                move through the setup flow without the usual friction.
              </p>

              <ol className="dp-steps">
                {DEPLOY_STEPS.map((step, index) => (
                  <motion.li
                    key={step.title}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.5, delay: 0.2 + index * 0.12 }}
                  >
                    <span className="dp-step-num">{index + 1}</span>
                    <span>
                      <strong>{step.title}</strong>
                      <small>{step.detail}</small>
                    </span>
                  </motion.li>
                ))}
              </ol>

              <div className="dp-actions">
                <Link
                  href={`/checkout?tier=1-month&robot=${FLAGSHIP_ROBOT.slug}&name=${encodeURIComponent(FLAGSHIP_ROBOT.name)}`}
                  className="btn-primary large"
                >
                  Start Monthly Plan
                  <ArrowRight size={18} />
                </Link>
                <Link href="/tutorials" className="btn-secondary large">
                  See Setup Tutorials
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <AnimatePresence>
        {selectedIndex !== null && (
          <ProofViewer
            shots={PROOF_SHOTS}
            index={selectedIndex % PROOF_SHOTS.length}
            onIndexChange={setSelectedIndex}
            onClose={() => setSelectedIndex(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
