"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { buildContactOffers } from "@/lib/pricing-showcase";
import { GoldGlyph } from "@/components/GoldGlyph";

// High-touch licensing / private-deal options moved off the landing page. This
// is contact-first B2B — it distracts the mass-market buyer, so it lives on its
// own page linked from pricing and the footer.
export default function LicensingPage() {
  const t = useTranslations("Landing");
  const contactOffers = buildContactOffers(t);

  return (
    <main className="main-content landing-shell">
      <section className="landing-section private-access-section">
        <div className="landing-container">
          <motion.div
            className="private-access-shell"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="private-access-header">
              <div className="private-access-copy">
                <span className="landing-eyebrow">{t("customAccessEyebrow")}</span>
                <h2 className="section-title section-title-left">
                  {t("customAccessTitle")}
                </h2>
                <p className="section-copy section-copy-left">
                  {t("customAccessCopy")}
                </p>
              </div>

              <div className="private-access-actions">
                <Link href="/support" className="btn-primary large">
                  {t("customAccessPrimaryCta")}
                </Link>
                <a href="mailto:support@AL-ai-FX.com" className="btn-secondary large">
                  {t("customAccessSecondaryCta")}
                </a>
              </div>
            </div>

            <div className="private-access-grid">
              {contactOffers.map((offer, index) => (
                <motion.article
                  key={offer.title}
                  className={`private-access-card private-access-card-${offer.accent}`}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, delay: index * 0.08 }}
                >
                  <GoldGlyph kind={offer.glyph} className="private-access-glyph" />
                  <h3>{offer.title}</h3>
                  <p>{offer.description}</p>
                  <ul className="private-access-list">
                    {offer.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </motion.article>
              ))}
            </div>

            <div className="landing-hero-actions" style={{ marginTop: "2.5rem" }}>
              <Link href="/#pricing" className="btn-secondary large">
                <ArrowRight size={18} />
                See standard plans
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
