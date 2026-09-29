"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowRight, Check, CodeXml, Infinity as InfinityIcon, KeyRound, Mail, Rocket, type LucideIcon } from "lucide-react";

import { buildContactOffers } from "@/lib/pricing-showcase";
import "@/components/site/site-pages.css";

// Icons follow the offer order in buildContactOffers.
const OFFER_ICONS: LucideIcon[] = [InfinityIcon, CodeXml, Rocket];

// High-touch licensing / private-deal options moved off the landing page. This
// is contact-first B2B — it distracts the mass-market buyer, so it lives on its
// own page linked from pricing and the footer.
export default function LicensingPage() {
  const t = useTranslations("Landing");
  const contactOffers = buildContactOffers(t);

  const steps = [
    { title: "Tell us what you need", text: "Lifetime access, source rights, rebranding or a guided rollout — email us the scope." },
    { title: "We talk it through", text: "Each deal is handled through direct contact with the team, not a checkout page." },
    { title: "Private quote", text: "Pricing is quoted privately for your scope rather than listed publicly." },
  ];

  return (
    <main className="main-content sp-shell">
      <header className="sp-hero">
        <div className="sp-hero-art" aria-hidden="true">
          <Image src="/brand/vault-door-16x9.jpg" alt="" fill priority sizes="60vw" />
        </div>
        <motion.div
          className="sp-container"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="sp-eyebrow">
            <KeyRound size={13} aria-hidden="true" />
            {t("customAccessEyebrow")}
          </span>
          <h1>{t("customAccessTitle")}</h1>
          <p className="sp-lead">{t("customAccessCopy")}</p>
          <div className="sp-hero-actions">
            <a href="mailto:support@AL-ai-FX.com" className="sp-btn is-primary is-large">
              <Mail size={16} aria-hidden="true" />
              {t("customAccessPrimaryCta")}
            </a>
            <Link href="/#pricing" className="sp-btn is-large">
              See standard plans
            </Link>
          </div>
        </motion.div>
      </header>

      <section className="sp-section">
        <div className="sp-container">
          <div className="sp-grid">
            {contactOffers.map((offer, index) => {
              const Icon = OFFER_ICONS[index] ?? KeyRound;
              return (
                <motion.article
                  key={offer.title}
                  className="sp-card is-hover"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                >
                  <span className="sp-card-icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3>{offer.title}</h3>
                  <p>{offer.description}</p>
                  <ul className="sp-card-list">
                    {offer.bullets.map((bullet) => (
                      <li key={bullet}>
                        <Check size={14} aria-hidden="true" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <div className="sp-card-foot">
                    <a
                      href={`mailto:support@AL-ai-FX.com?subject=${encodeURIComponent(`${offer.title} enquiry`)}`}
                      className="sp-card-link"
                    >
                      {offer.cta} <ArrowRight size={14} aria-hidden="true" />
                    </a>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="sp-section" style={{ paddingTop: 0 }}>
        <div className="sp-container">
          <div className="sp-heading">
            <span className="sp-eyebrow">How it works</span>
            <h2>
              A private deal in <span>three steps.</span>
            </h2>
          </div>
          <ol className="sp-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <em>{index + 1}</em>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sp-section" style={{ paddingTop: 0, paddingBottom: 96 }}>
        <div className="sp-container sp-cta">
          <div>
            <h2>
              Just want to start trading<span>?</span>
            </h2>
            <p>Standard plans are available now, with account-locked builds ready in minutes.</p>
          </div>
          <div className="sp-cta-actions">
            <Link href="/#pricing" className="sp-btn is-primary">
              See pricing
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/catalog" className="sp-btn">
              Browse robots
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
