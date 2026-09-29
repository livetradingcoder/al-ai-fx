import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CreditCard,
  CircleQuestionMark,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  ReceiptText,
  Wrench,
} from "lucide-react";

import { getPageMetadata } from "@/lib/seo";
import SupportForm from "./SupportForm";
import "@/components/site/site-pages.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("support", locale);
}

const QUICK_HELP = [
  {
    icon: BookOpen,
    title: "Install the EA on MT5",
    text: "Copying the .ex5, refreshing the Navigator, enabling Algo Trading.",
    href: "/guides/install-ea-on-mt5",
  },
  {
    icon: CircleQuestionMark,
    title: "FAQ",
    text: "Requirements, licences, billing, refunds and risk.",
    href: "/faq",
  },
  {
    icon: LayoutDashboard,
    title: "Your dashboard",
    text: "Download builds, change your MT5 account, manage billing.",
    href: "/dashboard",
  },
  {
    icon: ReceiptText,
    title: "Refund policy",
    text: "The 14-day stop-loss refund and how to claim it.",
    href: "/refund-policy",
  },
];

export default function SupportPage() {
  return (
    <main className="main-content sp-shell">
      <header className="sp-hero">
        <div className="sp-container">
          <span className="sp-eyebrow">
            <LifeBuoy size={13} aria-hidden="true" />
            Support center
          </span>
          <h1>
            How can we <span>help?</span>
          </h1>
          <p className="sp-lead">
            Need help with GoldBot? Our team is here to assist you 24/7 — start with the quick
            answers below, or send us a message.
          </p>
        </div>
      </header>

      <section className="sp-section">
        <div className="sp-container">
          <div className="sp-grid">
            {QUICK_HELP.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="sp-card">
                  <span className="sp-card-icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <span className="sp-card-foot">
                    <span className="sp-card-link">
                      Open <ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="sp-section" style={{ paddingTop: 0, paddingBottom: 96 }}>
        <div className="sp-container sp-support-layout">
          <SupportForm />

          <div className="sp-channels">
            <div className="sp-heading" style={{ marginBottom: 8 }}>
              <span className="sp-eyebrow">Email us directly</span>
            </div>
            <a href="mailto:support@AL-ai-FX.com" className="sp-channel">
              <span className="sp-card-icon">
                <Wrench size={20} aria-hidden="true" />
              </span>
              <div>
                <strong>Technical support</strong>
                <small>Installation, configuration, licences and MT5 accounts.</small>
                <span className="sp-mono">support@AL-ai-FX.com</span>
              </div>
              <Mail size={18} aria-hidden="true" />
            </a>
            <a href="mailto:billing@AL-ai-FX.com" className="sp-channel">
              <span className="sp-card-icon">
                <CreditCard size={20} aria-hidden="true" />
              </span>
              <div>
                <strong>Billing inquiries</strong>
                <small>Subscriptions, upgrades, payments and refunds.</small>
                <span className="sp-mono">billing@AL-ai-FX.com</span>
              </div>
              <Mail size={18} aria-hidden="true" />
            </a>

            <div className="sp-card" style={{ marginTop: 4 }}>
              <strong style={{ color: "#fff" }}>To get the fastest answer</strong>
              <ul className="sp-card-list" style={{ borderTop: 0, paddingTop: 0, marginTop: 12 }}>
                <li>Use the email address on your GoldBot account.</li>
                <li>Include your MT5 account number for licence questions.</li>
                <li>Add a screenshot of any error from MetaTrader&apos;s Experts tab.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
