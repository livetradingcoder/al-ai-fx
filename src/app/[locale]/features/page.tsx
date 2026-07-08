"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowRight, Clock3 } from "lucide-react";

import { GoldGlyph, SectionWireframe } from "@/components/GoldGlyph";
import {
  getCompareRows,
  getExecutionFlow,
  getFeaturePanels,
  getOpsPillars,
} from "@/lib/landing-data";

// Full product story — features, setup flow, risk posture, and the public-EA
// comparison. Moved off the homepage so the landing can stay a fast, single-job
// sell. Reachable from the nav ("Features") and the landing's "how it works" link.
export default function FeaturesPage() {
  const t = useTranslations("Landing");

  return (
    <main className="main-content landing-shell">
      <section id="features" className="landing-section feature-showcase-section">
        <div className="landing-container">
          <motion.div
            className="section-heading"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="landing-eyebrow">{t("whyGoldBot")}</span>
            <h2 className="section-title">
              What GoldBot does that public robots don&apos;t.
            </h2>
            <p className="section-copy">
              Adaptive recovery, liquidity protection, and an account-locked
              private build — the reasons serious traders run GoldBot instead of
              a shared marketplace EA.
            </p>
          </motion.div>

          <div className="feature-mosaic">
            {getFeaturePanels(t).map((panel, index) => (
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
              From checkout to live execution
              <span> in four steps.</span>
            </h2>
            <p className="section-copy">
              No coding, no config files. Lock GoldBot to your MT5 account, drop
              it on XAUUSD, and let the rules run.
            </p>
          </motion.div>

          <SectionWireframe className="process-wireframe" />

          <div className="process-grid">
            {getExecutionFlow(t).map((step, index) => (
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
            <span className="landing-eyebrow">{t("riskAwareAutomation")}</span>
            <h2 className="section-title section-title-left">
              Built for traders who want clean behavior across changing market conditions.
            </h2>
            <p className="section-copy section-copy-left">
              Fixed decision rules, protective recovery logic, and account-level
              locking — the same discipline whether the market is fast, slow, or
              gapping.
            </p>
            <GoldGlyph kind="signal" className="ops-master-glyph" />
          </motion.div>

          <div className="ops-pillar-stack">
            {getOpsPillars(t).map((pillar, index) => (
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
            <span className="landing-eyebrow">{t("comparisonEyebrow")}</span>
            <h2 className="section-title">
              Why GoldBot isn&apos;t another public EA.
            </h2>
            <p className="section-copy">
              Most marketplace robots are shared, unlocked, and never built for
              gold. GoldBot is account-bound, cloud-compiled, and made only for
              XAUUSD.
            </p>
          </motion.div>

          <div className="compare-board">
            <div className="compare-board-head">
              <span>{t("compHead1")}</span>
              <span>{t("compHead2")}</span>
              <span>{t("compHead3")}</span>
            </div>

            {getCompareRows(t).map((row) => (
              <div key={row.capability} className="compare-board-row">
                <span className="compare-board-capability">{row.capability}</span>
                <span className="compare-board-good">{row.goldbot}</span>
                <span className="compare-board-bad">{row.typical}</span>
              </div>
            ))}
          </div>

          <div className="landing-hero-actions" style={{ marginTop: "2.5rem" }}>
            <Link href="/#pricing" className="btn-primary large">
              Get GoldBot
              <ArrowRight size={18} />
            </Link>
            <Link href="/" className="btn-secondary large">
              Back to overview
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
