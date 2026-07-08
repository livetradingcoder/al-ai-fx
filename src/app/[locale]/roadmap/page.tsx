"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { buildComingSoonProducts } from "@/lib/pricing-showcase";
import { GoldGlyph } from "@/components/GoldGlyph";

// Roadmap moved off the landing page so the homepage can focus on selling
// GoldBot now. Future products belong here, not in the conversion path.
export default function RoadmapPage() {
  const t = useTranslations("Landing");
  const comingSoonProducts = buildComingSoonProducts(t);

  return (
    <main className="main-content landing-shell">
      <section className="landing-section coming-soon-section">
        <div className="landing-container">
          <motion.div
            className="coming-soon-shell"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="coming-soon-header">
              <div className="coming-soon-copy">
                <span className="landing-eyebrow">{t("comingSoonEyebrow")}</span>
                <h2 className="section-title section-title-left">
                  {t("comingSoonTitle")}
                </h2>
                <p className="section-copy section-copy-left">
                  {t("comingSoonCopy")}
                </p>
              </div>

              <div className="coming-soon-summary">
                <span className="coming-soon-summary-label">{t("comingSoonSummaryLabel")}</span>
                <strong>{t("comingSoonSummaryTitle")}</strong>
                <p>{t("comingSoonSummaryCopy")}</p>
              </div>
            </div>

            <div className="coming-soon-board-head">
              <span>{t("comingSoonBoardProduct")}</span>
              <span>{t("comingSoonBoardSurface")}</span>
              <span>{t("comingSoonBoardStatus")}</span>
            </div>

            <div className="coming-soon-grid">
              {comingSoonProducts.map((product, index) => (
                <motion.article
                  key={product.title}
                  className={`coming-soon-card coming-soon-card-${product.accent}`}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.6, delay: index * 0.08 }}
                >
                  <div className="coming-soon-card-top">
                    <span className="coming-soon-surface">{product.surfaceLabel}</span>
                    <span className="coming-soon-status">{product.status}</span>
                  </div>

                  <div className="coming-soon-card-head">
                    <GoldGlyph kind={product.glyph} className="coming-soon-card-glyph" />

                    <div>
                      <span className="coming-soon-card-eyebrow">{product.eyebrow}</span>
                      <h3>{product.title}</h3>
                    </div>
                  </div>

                  <p className="coming-soon-card-copy">{product.description}</p>

                  <ul className="coming-soon-card-list">
                    {product.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </motion.article>
              ))}
            </div>

            <div className="landing-hero-actions" style={{ marginTop: "2.5rem" }}>
              <Link href="/#pricing" className="btn-primary large">
                Get GoldBot today
                <ArrowRight size={18} />
              </Link>
              <Link href="/" className="btn-secondary large">
                Back to GoldBot
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
