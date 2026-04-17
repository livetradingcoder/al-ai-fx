"use client";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: -340, behavior: 'smooth' });
  };

  const scrollRight = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 340, behavior: 'smooth' });
  };

  return (
    <main className="main-content">
      <section className="hero">
        <div className="hero-backdrop hero-backdrop-left" aria-hidden="true" />
        <div className="hero-backdrop hero-backdrop-right" aria-hidden="true" />

        <motion.div
          className="hero-text"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="hero-kicker">AI-ASSISTED MT5 EXECUTION ENGINE</span>
          <h1>Deploy <span>GoldBot (EA)</span> and trade with disciplined automation.</h1>
          <p>From checkout to live chart in under a minute. Your EA is uniquely compiled for your account, with built-in risk filters and recovery logic.</p>

          <div className="hero-actions">
            <a href="#pricing" className="btn-primary large">Get Started Now</a>
            <Link href="/tutorials" className="btn-secondary large">Watch Tutorials</Link>
          </div>

          <div className="disclaimer-banner">
            <span className="disclaimer-icon">⚠️</span>
            <div className="disclaimer-text">
              <strong>Built exclusively for MetaTrader 5 (MT5).</strong>
              <p>GoldBot cannot be installed on MT4 or other trading platforms. A valid MT5 account with your preferred broker (Broker Time must be GMT+3) is required for license locking.</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="hero-graphic"
          initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          <div className="glass-panel hero-visual-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <img src="/goldbotmt5.avif" alt="GoldBot Dashboard Visual" className="hero-visual" />
            <div className="hero-overlay-card hero-overlay-top">
              <span>Signal Quality</span>
              <strong>High confidence</strong>
            </div>
            <div className="hero-overlay-card hero-overlay-bottom">
              <span>Risk Profile</span>
              <strong>Adaptive shield on</strong>
            </div>
          </div>
          <div className="hero-graphic-caption">
            <h3>Built for controlled execution</h3>
            <p>GoldBot focuses on consistent decision rules, protective recovery logic, and account-level license security from day one.</p>
            <div className="hero-graphic-points">
              <span>Disciplined entries</span>
              <span>Drawdown-aware hedging</span>
              <span>One-account license lock</span>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="testimonials-section">
        <h2>Verified Results</h2>
        <p className="section-subtitle">Numbers matter more than word testimonials. Real performance from AL-ai-FX members.</p>
        <div className="testimonials-wrapper">
          <button className="nav-arrow left-arrow" onClick={scrollLeft}>‹</button>
          <button className="nav-arrow right-arrow" onClick={scrollRight}>›</button>
          <div className="testimonials-track-container" ref={scrollRef}>
            <div className="testimonials-track">
              {[
                "photo_2026-04-15 9.21.38 p.m..jpeg",
                "photo_2026-04-15 9.21.40 p.m. (1).jpeg",
                "photo_2026-04-15 9.21.41 p.m..jpeg",
                "photo_2026-04-15 9.21.49 p.m..jpeg",
                "photo_2026-04-15 9.21.50 p.m..jpeg",
                "photo_2026-04-15 9.21.56 p.m..jpeg",
                "photo_2026-04-15 9.21.57 p.m..jpeg",
                "photo_2026-04-15 9.21.58 p.m..jpeg"
              ].map((img, idx) => (
                <img
                  key={idx}
                  src={`/testimonials/${img}`}
                  alt={`User Result ${idx}`}
                  className="testimonial-img"
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedImage(img)}
                />
              ))}
              {[
                "photo_2026-04-15 9.21.38 p.m..jpeg",
                "photo_2026-04-15 9.21.40 p.m. (1).jpeg",
                "photo_2026-04-15 9.21.41 p.m..jpeg",
                "photo_2026-04-15 9.21.49 p.m..jpeg",
                "photo_2026-04-15 9.21.50 p.m..jpeg",
                "photo_2026-04-15 9.21.56 p.m..jpeg",
                "photo_2026-04-15 9.21.57 p.m..jpeg",
                "photo_2026-04-15 9.21.58 p.m..jpeg"
              ].map((img, idx) => (
                <img
                  key={`dup-${idx}`}
                  src={`/testimonials/${img}`}
                  alt={`User Result ${idx}`}
                  className="testimonial-img"
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedImage(img)}
                />
              ))}
            </div>
          </div>
      </section>

      <section id="features" className="features-section">
        <h2>Why GoldBot?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Smart Hedging Mode</h3>
            <p>Advanced recovery dynamics that intelligently manage drawdowns without excessive risk multipliers.</p>
          </div>
          <div className="feature-card">
            <h3>Holiday Filters</h3>
            <p>Global Liquidity Guard built-in. Automatically pauses trading during UK, US, DE, FR, and IT bank holidays.</p>
          </div>
          <div className="feature-card">
            <h3>Custom Compiled</h3>
            <p>Your EA is compiled uniquely for you. No slow, vulnerable web-requests to verify licensing inside the bot.</p>
          </div>
        </div>
      </section>

      <section id="pricing" className="pricing-section">
        <h2>Pricing Plans</h2>
        <div className="pricing-grid">
          {[
            { id: "free-trial", title: "Free Trial", price: "$0", period: "for 3 days", features: ["Basic Features", "Standard Recovery", "Automated Delivery"] },
            { id: "1-month", title: "Monthly", price: "$149", period: "per month", featured: true, features: ["Unlimited Downloads", "All Strategy Features", "Automated Delivery"] },
            { id: "6-months", title: "Biannual", price: "$499", period: "per 6 months", features: ["Unlimited Downloads", "All Strategy Features", "Priority Liquid Guard", "Automated Delivery"] },
            { id: "lifetime", title: "Lifetime", price: "$999", period: "one-time", features: ["Unlimited Source Copies", "All Strategy Features", "VIP Setup Support", "Automated Delivery"] },
          ].map(plan => (
            <div key={plan.id} className={`pricing-card ${plan.featured ? 'featured' : ''}`}>
              {plan.featured && <div className="badge">Most Popular</div>}
              <h3>{plan.title}</h3>
              <div className="price">{plan.price}<span>/{plan.period}</span></div>
              <ul className="plan-features">
                {plan.features.map((feature, idx) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
              <a href={`/checkout?tier=${plan.id}`} className="btn-primary fill">Select Plan</a>
            </div>
          ))}
        </div>
      </section>

      <section className="how-section">
        <h2>How It Works</h2>
        <p className="section-subtitle">We optimized provisioning so your licensed EA can be ready in minutes.</p>
        <div className="how-grid">
          {[
            { step: "01", title: "Choose Plan", text: "Select your plan and complete checkout through Paygate with secure processing.", eta: "ETA: 1 min" },
            { step: "02", title: "Account Provisioning", text: "Your dashboard account is created instantly and tied to your purchase email.", eta: "ETA: instant" },
            { step: "03", title: "Set MT5 Account", text: "Add the MT5 account number you want the EA to be locked to for secure usage.", eta: "ETA: 30 sec" },
            { step: "04", title: "Compile & Download", text: "We cloud-compile your EA and prepare your personalized executable package.", eta: "ETA: < 15 sec" },
            { step: "05", title: "Install & Launch", text: "Drop the file into your MT5 Experts folder, attach to chart, and configure risk.", eta: "ETA: 2 min" },
          ].map((item) => (
            <div key={item.step} className="how-card">
              <span className="how-step">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <span className="how-eta">{item.eta}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ops-section">
        <div className="ops-copy">
          <h2>Built For Risk-Aware Automation</h2>
          <p>GoldBot combines execution speed with protective logic so your strategy behaves consistently in changing market conditions.</p>
        </div>
        <div className="ops-grid">
          <div className="ops-card">
            <h3>Liquidity Guard</h3>
            <p>Trading is automatically restricted during low-liquidity bank holidays and risky sessions.</p>
          </div>
          <div className="ops-card">
            <h3>Account-Level Locking</h3>
            <p>Each build is tied to your MT5 account to protect distribution and keep licensing clean.</p>
          </div>
          <div className="ops-card">
            <h3>Fast Deployment</h3>
            <p>Provisioning and compilation are engineered for speed so setup does not block execution.</p>
          </div>
        </div>
      </section>

      <section className="compare-section">
        <h2>Why Traders Pick GoldBot</h2>
        <div className="compare-table">
          <div className="compare-row compare-head">
            <span>Capability</span>
            <span>GoldBot</span>
            <span>Typical Public EA</span>
          </div>
          <div className="compare-row">
            <span>Account-specific executable</span>
            <span className="good">Included</span>
            <span className="bad">Rare</span>
          </div>
          <div className="compare-row">
            <span>Holiday liquidity protection</span>
            <span className="good">Built-in</span>
            <span className="bad">Manual setup</span>
          </div>
          <div className="compare-row">
            <span>Provisioning speed</span>
            <span className="good">Minutes</span>
            <span className="bad">Hours or days</span>
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <h2>Ready to Deploy GoldBot?</h2>
        <p>Start with the monthly plan and move from setup to chart execution quickly.</p>
        <div className="landing-cta-actions">
          <a href="/checkout?tier=1-month" className="btn-primary large">Start Monthly Plan</a>
          <Link href="/tutorials" className="btn-secondary large">See Setup Tutorials</Link>
        </div>
      </section>

      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedImage(null)}>✕</button>
            <img src={`/testimonials/${selectedImage}`} alt="Verified Result" className="modal-img" />
          </div>
        </div>
      )}

    </main>
  );
}
