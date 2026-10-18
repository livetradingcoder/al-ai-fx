"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import LandingHero from "@/components/marketing/LandingHero";
import VerifiedBadge from "@/components/marketing/VerifiedBadge";
import ProofViewer, { type ProofShot } from "@/components/marketing/ProofViewer";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Lock,
  Maximize2,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";
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

export default function HomeClient({ pricing }: { pricing: ReactNode }) {
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
            {getProofMetrics(t).map((metric, index) => (
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
        <p className="landing-breakdown-link">
          Traders send in their own MT5 results, checked by our team before they appear.{" "}
          <Link href="/results">See results shared by traders</Link>
        </p>
      </div>

      {/* The pricing section is rendered on the server (it reads the live robots and
          prices) and handed in here. */}
      {pricing}

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
