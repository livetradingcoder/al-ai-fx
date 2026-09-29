"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowRight, Check, ChartCandlestick, Layers, MonitorSmartphone, Radio, Shield, type LucideIcon } from "lucide-react";

import { buildComingSoonProducts, type ComingSoonProduct } from "@/lib/pricing-showcase";
import "@/components/site/site-pages.css";

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

const GLYPH_ICON: Record<string, LucideIcon> = {
  shield: Shield,
  signal: Radio,
  halo: ChartCandlestick,
  launch: Layers,
  platform: MonitorSmartphone,
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
  const Icon = GLYPH_ICON[card.glyph] ?? Layers;
  return (
    <motion.article
      className="sp-card is-hover"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
    >
      <div className="sp-pills">
        <span className="sp-pill">{card.surface}</span>
        <span className="sp-pill is-status is-live">{card.status}</span>
      </div>
      <span className="sp-card-icon" style={{ marginTop: 18 }}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="sp-card-eyebrow">{card.eyebrow}</span>
      <h3>{card.title}</h3>
      <p>{card.description}</p>
      {card.bullets && card.bullets.length > 0 && (
        <ul className="sp-card-list">
          {card.bullets.map((bullet) => (
            <li key={bullet}>
              <Check size={14} aria-hidden="true" />
              {bullet}
            </li>
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
    <main className="main-content sp-shell">
      <header className="sp-hero">
        <motion.div
          className="sp-container"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="sp-eyebrow">Roadmap</span>
          <h1>
            What we&apos;re <span>building next.</span>
          </h1>
          <p className="sp-lead">
            {onSale} robots are on sale today. These come next: more gold robots for MT5, and the
            same strategies on TradingView and cTrader.
          </p>
          <div className="sp-stats">
            <div>
              <strong>{onSale}</strong>
              <span>robots on sale now</span>
            </div>
            <div>
              <strong>{robotCards.length}</strong>
              <span>robots in development</span>
            </div>
            <div>
              <strong>{platformCards.length}</strong>
              <span>new platforms</span>
            </div>
          </div>
        </motion.div>
      </header>

      <section className="sp-section">
        <div className="sp-container">
          <div className="sp-heading">
            <span className="sp-eyebrow">Robots in development</span>
            <h2>
              New gold robots <span>for MT5.</span>
            </h2>
            <p>
              Each ships like the robots on sale today: a compiled build locked to your MT5 account,
              ready minutes after checkout.
            </p>
          </div>
          <div className="sp-grid">
            {robotCards.map((card, index) => (
              <RoadmapCard key={card.key} card={card} index={index} />
            ))}
          </div>
        </div>
      </section>

      {platformCards.length > 0 && (
        <section className="sp-section" style={{ paddingTop: 0 }}>
          <div className="sp-container">
            <div className="sp-heading">
              <span className="sp-eyebrow">New platforms</span>
              <h2>
                Beyond <span>MetaTrader 5.</span>
              </h2>
              <p>The same gold strategies, on the platforms more traders use.</p>
            </div>
            <div className="sp-grid">
              {platformCards.map((card, index) => (
                <RoadmapCard key={card.key} card={{ ...card, glyph: "platform" }} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="sp-section" style={{ paddingTop: 0, paddingBottom: 96 }}>
        <div className="sp-container sp-cta">
          <div>
            <h2>
              Don&apos;t want to wait<span>?</span>
            </h2>
            <p>{onSale} robots are ready today, each delivered as an account-locked MT5 build.</p>
          </div>
          <div className="sp-cta-actions">
            <Link href="/catalog" className="sp-btn is-primary">
              Browse robots on sale
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/#pricing" className="sp-btn">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
