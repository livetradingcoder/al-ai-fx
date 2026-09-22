"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { buildComingSoonProducts, type ComingSoonProduct } from "@/lib/pricing-showcase";
import { GoldGlyph } from "@/components/GoldGlyph";

export type RoadmapRobot = { slug: string; name: string; shortDescription: string };

type Card = {
  key: string;
  surface: string;
  status: string;
  glyph: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
};

const ROBOT_GLYPH: Record<string, string> = {
  goldshield: "shield",
  "precision-range": "signal",
  "sniper-lite": "halo",
};

function fromProduct(product: ComingSoonProduct): Card {
  return {
    key: product.title,
    surface: product.surfaceLabel,
    status: product.status,
    glyph: product.glyph,
    eyebrow: product.eyebrow,
    title: product.title,
    description: product.description,
    bullets: product.bullets,
  };
}

function RoadmapCard({ card, index }: { card: Card; index: number }) {
  return (
    <motion.article
      className="roadmap-card"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay: index * 0.06 }}
    >
      <div className="roadmap-card-top">
        <span className="roadmap-pill">{card.surface}</span>
        <span className="roadmap-pill roadmap-pill-status">{card.status}</span>
      </div>

      <div className="roadmap-card-head">
        <GoldGlyph kind={card.glyph} className="roadmap-card-glyph" />
        <div>
          <span className="roadmap-card-eyebrow">{card.eyebrow}</span>
          <h3>{card.title}</h3>
        </div>
      </div>

      <p className="roadmap-card-copy">{card.description}</p>

      {card.bullets && card.bullets.length > 0 && (
        <ul className="pricing-tier-list roadmap-card-list">
          {card.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      )}
    </motion.article>
  );
}

export default function RoadmapBoard({
  robots,
  onSale,
}: {
  robots: RoadmapRobot[];
  onSale: number;
}) {
  const t = useTranslations("Landing");
  const products = buildComingSoonProducts(t);

  // Robots in the catalog as "Coming soon" first, then GoldGap (also an MT5
  // robot); TradingView and cTrader are platforms, not robots.
  const robotCards: Card[] = [
    ...robots.map((robot) => ({
      key: robot.slug,
      surface: "MT5 native",
      status: "Coming soon",
      glyph: ROBOT_GLYPH[robot.slug] ?? "launch",
      eyebrow: "Expert advisor",
      title: robot.name,
      description: robot.shortDescription,
    })),
    ...products.filter((product) => product.accent === "gold").map(fromProduct),
  ];
  const platformCards = products.filter((product) => product.accent !== "gold").map(fromProduct);

  return (
    <main className="main-content landing-shell">
      <section className="landing-section">
        <div className="landing-container">
          <motion.div
            className="section-heading"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="landing-eyebrow">Roadmap</span>
            <h1 className="section-title">What we&apos;re building next.</h1>
            <p className="section-copy">
              {onSale} robots are on sale today. These come next: more gold robots for
              MT5, and the same strategies on TradingView and cTrader.
            </p>
            <div className="roadmap-stats">
              <span>
                <strong>{robotCards.length}</strong> robots in development
              </span>
              <span>
                <strong>{platformCards.length}</strong> new platforms
              </span>
            </div>
          </motion.div>

          <div className="roadmap-group">
            <div className="pricing-group-head">
              <span>Robots in development</span>
              <p>
                Each ships like the robots on sale today: a compiled build locked to your
                MT5 account, ready minutes after checkout.
              </p>
            </div>
            <div className="roadmap-grid">
              {robotCards.map((card, index) => (
                <RoadmapCard key={card.key} card={card} index={index} />
              ))}
            </div>
          </div>

          {platformCards.length > 0 && (
            <div className="roadmap-group">
              <div className="pricing-group-head">
                <span>New platforms</span>
                <p>The same gold strategies, beyond MetaTrader 5.</p>
              </div>
              <div className="roadmap-grid">
                {platformCards.map((card, index) => (
                  <RoadmapCard key={card.key} card={card} index={index} />
                ))}
              </div>
            </div>
          )}

          <div className="landing-hero-actions roadmap-actions">
            <Link href="/catalog" className="btn-primary large">
              Browse robots on sale
              <ArrowRight size={18} />
            </Link>
            <Link href="/#pricing" className="btn-secondary large">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
