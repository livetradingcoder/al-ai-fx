"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion, type Variants } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CalendarOff,
  Check,
  Clock3,
  Cpu,
  Gauge,
  KeyRound,
  Link2,
  Lock,
  Rocket,
  ShieldCheck,
  UserPlus,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import {
  getCompareRows,
  getExecutionFlow,
  getFeaturePanels,
  getOpsPillars,
} from "@/lib/landing-data";
import RecoveryChart from "./RecoveryChart";
import "./features.css";

const EASE = [0.22, 1, 0.36, 1] as const;

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

// Icons follow the data order in landing-data.ts.
const PANEL_ICONS: LucideIcon[] = [Activity, CalendarOff, KeyRound, Gauge];
const FLOW_ICONS: LucideIcon[] = [Wallet, UserPlus, Link2, Cpu, Rocket];
const PILLAR_ICONS: LucideIcon[] = [ShieldCheck, Lock, Zap];

// The holiday filter's markets, as named in the Liquidity Guard copy.
const HOLIDAY_MARKETS = ["UK", "US", "DE", "FR", "IT"];

const STEP_WORDS: Record<number, string> = { 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven" };

const SECTION_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#risk", label: "Risk controls" },
  { href: "#compare", label: "Comparison" },
];

// Full product story — features, setup flow, risk posture, and the public-EA
// comparison. Moved off the homepage so the landing can stay a fast, single-job
// sell. Reachable from the nav ("Features") and the landing's "how it works" link.
export default function FeaturesPage() {
  const t = useTranslations("Landing");
  const panels = getFeaturePanels(t);
  const flow = getExecutionFlow(t);
  const pillars = getOpsPillars(t);
  const compareRows = getCompareRows(t);

  return (
    <main className="main-content ft-shell">
      {/* ---------------- Hero ---------------- */}
      <section className="ft-hero">
        <div className="ft-hero-art" aria-hidden="true">
          <Image
            src="/brand/gold-circuit-16x9.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="ft-hero-img"
          />
        </div>

        <motion.div
          className="ft-container ft-hero-copy"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.span className="ft-eyebrow" variants={rise}>
            {t("whyGoldBot")}
          </motion.span>
          <motion.h1 variants={rise}>
            What GoldBot does that
            <span> public robots don&apos;t.</span>
          </motion.h1>
          <motion.p variants={rise}>
            Adaptive recovery, liquidity protection, and an account-locked
            private build — the reasons serious traders run GoldBot instead of a
            shared marketplace EA.
          </motion.p>
          <motion.div className="ft-hero-actions" variants={rise}>
            <Link href="/#pricing" className="ft-btn is-primary">
              Get GoldBot
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/catalog" className="ft-btn">
              Browse robots
            </Link>
          </motion.div>

          <motion.nav className="ft-jump" aria-label="On this page" variants={rise}>
            {SECTION_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </motion.nav>
        </motion.div>
      </section>

      {/* ---------------- Feature bento ---------------- */}
      <section id="features" className="ft-section">
        <div className="ft-container">
          <div className="ft-heading">
            <span className="ft-eyebrow">Core features</span>
            <h2>
              Built differently,
              <span> from entry to licence.</span>
            </h2>
          </div>

          <div className="ft-bento">
            {panels.map((panel, index) => {
              const Icon = PANEL_ICONS[index] ?? Activity;
              return (
                <motion.article
                  key={panel.title}
                  className={`ft-panel ft-panel-${index + 1}`}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.2 }}
                  variants={rise}
                  transition={{ delay: index * 0.06 }}
                >
                  <div className="ft-panel-top">
                    <span className="ft-icon">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="ft-panel-eyebrow">{panel.eyebrow}</span>
                  </div>
                  <h3>{panel.title}</h3>
                  <p>{panel.body}</p>

                  {index === 0 && <RecoveryChart />}
                  {index === 1 && (
                    <ul className="ft-markets" aria-label="Holiday calendars screened">
                      {HOLIDAY_MARKETS.map((market) => (
                        <li key={market}>
                          <CalendarOff size={14} aria-hidden="true" />
                          {market}
                        </li>
                      ))}
                    </ul>
                  )}

                  <ul className="ft-bullets">
                    {panel.bullets.map((bullet) => (
                      <li key={bullet}>
                        <span className="ft-check" aria-hidden="true">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how-it-works" className="ft-section ft-section-alt">
        <div className="ft-container">
          <div className="ft-heading">
            <span className="ft-eyebrow">How it works</span>
            <h2>
              From checkout to live execution
              <span> in {STEP_WORDS[flow.length] ?? flow.length} steps.</span>
            </h2>
            <p>
              No coding, no config files. Lock GoldBot to your MT5 account, drop
              it on XAUUSD, and let the rules run.
            </p>
          </div>

          <ol className="ft-timeline">
            <motion.span
              className="ft-timeline-line"
              aria-hidden="true"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.2, ease: EASE }}
            />
            {flow.map((step, index) => {
              const Icon = FLOW_ICONS[index] ?? Rocket;
              return (
                <motion.li
                  key={step.title}
                  className="ft-step"
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.3 }}
                  variants={rise}
                  transition={{ delay: 0.15 + index * 0.12 }}
                >
                  <span className="ft-step-node">
                    <Icon size={20} aria-hidden="true" />
                    <em>{index + 1}</em>
                  </span>
                  <span className="ft-eta">
                    <Clock3 size={12} aria-hidden="true" />
                    {step.eta.replace(/^ETA\s*/i, "")}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ---------------- Risk-aware automation ---------------- */}
      <section id="risk" className="ft-section">
        <div className="ft-container ft-risk">
          <motion.div
            className="ft-risk-master"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={rise}
          >
            <div className="ft-risk-art" aria-hidden="true">
              <Image
                src="/brand/vault-door-16x9.jpg"
                alt=""
                fill
                sizes="(max-width: 960px) 100vw, 50vw"
                className="ft-risk-img"
              />
            </div>
            <div className="ft-risk-copy">
              <span className="ft-eyebrow">{t("riskAwareAutomation")}</span>
              <h2>
                Clean behavior across
                <span> changing market conditions.</span>
              </h2>
              <p>
                Fixed decision rules, protective recovery logic, and account-level
                locking — the same discipline whether the market is fast, slow, or
                gapping.
              </p>
            </div>
          </motion.div>

          <div className="ft-pillars">
            {pillars.map((pillar, index) => {
              const Icon = PILLAR_ICONS[index] ?? ShieldCheck;
              return (
                <motion.article
                  key={pillar.title}
                  className="ft-pillar"
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.3 }}
                  variants={rise}
                  transition={{ delay: index * 0.08 }}
                >
                  <span className="ft-icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{pillar.title}</h3>
                    <p>{pillar.copy}</p>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- Comparison ---------------- */}
      <section id="compare" className="ft-section ft-section-alt">
        <div className="ft-container">
          <div className="ft-heading">
            <span className="ft-eyebrow">{t("comparisonEyebrow")}</span>
            <h2>
              Why GoldBot isn&apos;t
              <span> another public EA.</span>
            </h2>
            <p>
              Most marketplace robots are shared, unlocked, and never built for
              gold. GoldBot is account-bound, cloud-compiled, and made only for
              XAUUSD.
            </p>
          </div>

          <motion.div
            className="ft-compare"
            role="table"
            aria-label="GoldBot compared with a typical public EA"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={rise}
          >
            <div className="ft-compare-row ft-compare-head" role="row">
              <span role="columnheader">{t("compHead1")}</span>
              <span role="columnheader" className="is-goldbot">
                {t("compHead2")}
              </span>
              <span role="columnheader">{t("compHead3")}</span>
            </div>
            {compareRows.map((row) => (
              <div key={row.capability} className="ft-compare-row" role="row">
                <span role="cell" className="ft-compare-cap">
                  {row.capability}
                </span>
                <span role="cell" className="is-goldbot">
                  <span className="ft-yes" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {row.goldbot}
                </span>
                <span role="cell" className="is-typical">
                  <span className="ft-no" aria-hidden="true">
                    <X size={12} strokeWidth={3} />
                  </span>
                  {row.typical}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="ft-section ft-cta-section">
        <div className="ft-container">
          <motion.div
            className="ft-cta"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={rise}
          >
            <div>
              <h2>
                Ready to run GoldBot<span>?</span>
              </h2>
              <p>
                Pick a plan, lock your MT5 account, and your compiled build is ready
                in minutes.
              </p>
            </div>
            <div className="ft-cta-actions">
              <Link href="/#pricing" className="ft-btn is-primary">
                Get GoldBot
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/" className="ft-btn">
                Back to overview
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
