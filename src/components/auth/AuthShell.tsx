"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Download, Eye, EyeOff, KeyRound, LineChart, type LucideIcon } from "lucide-react";
import "./auth.css";

const EASE = [0.22, 1, 0.36, 1] as const;

const BRAND_POINTS = [
  { icon: Download, text: "Download your account-locked builds" },
  { icon: KeyRound, text: "Manage licences and your MT5 account" },
  { icon: LineChart, text: "Track affiliate clicks, sales and payouts" },
];

/**
 * Shared frame for every auth screen: a brand panel beside the form card on
 * wide screens, the card alone on narrow ones. `compact` drops the brand panel
 * for screens that already sit inside the dashboard.
 */
export function AuthShell({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  compact = false,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
}) {
  const card = (
    <motion.section
      className="au-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="au-card-head">
        <span className="au-card-icon" aria-hidden="true">
          <Icon size={22} />
        </span>
        <span className="au-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
      {footer && <div className="au-card-foot">{footer}</div>}
    </motion.section>
  );

  if (compact) {
    return <div className="au-compact">{card}</div>;
  }

  return (
    <main className="main-content au-shell">
      <div className="au-layout">
        <aside className="au-brand" aria-hidden="true">
          <Image
            src="/brand/hero-robot-gold.png"
            alt=""
            fill
            priority
            sizes="(max-width: 960px) 0px, 50vw"
            className="au-brand-img"
          />
          <div className="au-brand-copy">
            <span className="au-brand-tag">
              <Image src="/brand/metatrader-5.png" alt="" width={16} height={16} />
              Built for MetaTrader 5
            </span>
            <h2>
              Your GoldBot
              <span> command center.</span>
            </h2>
            <ul>
              {BRAND_POINTS.map(({ icon: PointIcon, text }) => (
                <li key={text}>
                  <PointIcon size={16} />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="au-form-side">{card}</div>
      </div>
    </main>
  );
}

/** Labelled input with a leading icon; password fields get a show/hide toggle. */
export function AuthField({
  label,
  icon: Icon,
  type = "text",
  hint,
  trailing,
  ...input
}: {
  label: string;
  icon: LucideIcon;
  hint?: ReactNode;
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";

  return (
    <label className="au-field">
      <span className="au-label">
        {label}
        {trailing}
      </span>
      <span className="au-input">
        <Icon size={16} aria-hidden="true" />
        <input {...input} type={isPassword && reveal ? "text" : type} />
        {isPassword && (
          <button
            type="button"
            className="au-reveal"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? "Hide password" : "Show password"}
          >
            {reveal ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        )}
      </span>
      {hint && <span className="au-hint">{hint}</span>}
    </label>
  );
}

export function AuthAlert({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <motion.div
      className={`au-alert is-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
