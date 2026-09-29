"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUp, ShieldAlert } from "lucide-react";
import { CookieSettingsButton } from "@/components/marketing/ConsentBanner";
import { usePathname } from "@/i18n/routing";
import { usesNewDesign } from "@/lib/redesigned-routes";
import "./landing-footer.css";

// The landing page runs its own design system, so it gets its own footer;
// every other page keeps the classic one.
export default function SiteFooter() {
  const pathname = usePathname();
  return usesNewDesign(pathname) ? <LandingFooter /> : <ClassicFooter />;
}

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/catalog", label: "Robots" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/roadmap", label: "Roadmap" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/guides", label: "Guides" },
      { href: "/gold-ea-mt5", label: "Gold EA for MT5" },
      { href: "/prop-firm-gold-ea", label: "Prop firm gold EA" },
      { href: "/tutorials", label: "Tutorials" },
      { href: "/faq", label: "FAQ" },
      { href: "/support", label: "Support" },
      { href: "/licensing", label: "Licensing & source" },
      { href: "/affiliates", label: "Refer & earn" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy-policy", label: "Privacy Policy" },
      { href: "/terms-conditions", label: "Terms & Conditions" },
      { href: "/refund-policy", label: "Refund Policy" },
      { href: "/disclaimer", label: "Disclaimer" },
    ],
  },
];

function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="lfoot">
      <div className="lfoot-inner">
        <div className="lfoot-top">
          <div className="lfoot-brand">
            <Link href="/" className="lfoot-logo">
              <span className="lfoot-logo-mark" aria-hidden="true">
                <Image src="/favicon.png" alt="" width={24} height={24} />
              </span>
              <span>
                <strong>GoldBot</strong>
                <small>by AL-ai-FX</small>
              </span>
            </Link>
            <p>
              Algorithmic tooling for MT5 automation workflows and
              account-specific deployment.
            </p>
            <span className="lfoot-mt5">
              <Image src="/brand/metatrader-5.png" alt="" width={20} height={20} />
              Built for MetaTrader 5
            </span>
          </div>

          <nav className="lfoot-columns" aria-label="Footer">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title} className="lfoot-column">
                <h4>{column.title}</h4>
                <ul>
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                  {column.title === "Legal" && (
                    <li>
                      <CookieSettingsButton />
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="lfoot-risk">
          <ShieldAlert size={18} aria-hidden="true" />
          <p>
            <strong>Risk warning.</strong> Trading leveraged products such as
            gold (XAUUSD) carries a high level of risk and may not be suitable
            for all investors. Past performance does not guarantee future
            results. Only trade with capital you can afford to lose.
          </p>
        </div>

        <div className="lfoot-bottom">
          <p>
            &copy; {year} AL-ai-FX Algorithms. GoldBot is a trademark of
            AL-ai-FX. MetaTrader is a trademark of MetaQuotes Ltd.
          </p>
          <button
            type="button"
            className="lfoot-top-button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            Back to top
            <ArrowUp size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
}

function ClassicFooter() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <h4>GoldBot by AL-ai-FX</h4>
          <p>
            Algorithmic tooling for MT5 automation workflows and
            account-specific deployment.
          </p>
        </div>
        <div>
          <h4>Product</h4>
          <div className="footer-links">
            <Link href="/features">Features</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/roadmap">Roadmap</Link>
            <Link href="/licensing">Licensing &amp; source</Link>
            <Link href="/affiliates">Refer &amp; earn</Link>
          </div>
        </div>
        <div>
          <h4>Legal</h4>
          <div className="footer-links">
            <Link href="/privacy-policy">Privacy Policy</Link>
            <Link href="/terms-conditions">Terms & Conditions</Link>
            <Link href="/refund-policy">Refund Policy</Link>
            <Link href="/disclaimer">Disclaimer</Link>
            <CookieSettingsButton />
          </div>
        </div>
      </div>
      <p className="footer-note">
        &copy; {new Date().getFullYear()} AL-ai-FX Algorithms. GoldBot is a
        trademark of AL-ai-FX. Trading carries risk and past performance
        does not guarantee future results.
      </p>
    </footer>
  );
}
