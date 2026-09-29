import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  BadgePercent,
  CalendarClock,
  Eye,
  Link2,
  RefreshCcw,
  Share2,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings, getTiers } from "@/lib/affiliate";
import { CATALOG_PUBLIC_TIERS } from "@/lib/catalog-tiers";
import { buildMetadata } from "@/lib/seo";
import EarningsCalculator, { type CalcPlan } from "./EarningsCalculator";
import AffiliateFaq from "./AffiliateFaq";
import "./affiliates.css";

// Public recruiting page for the affiliate programme. Numbers are read from the
// live settings and ladder, so changing a rate in the admin changes the pitch
// here too — a marketing page that quietly goes out of date is worse than none.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const tiers = await getTiers();
  const top = tiers.length ? Math.max(...tiers.map((t) => t.rate)) : 35;
  return buildMetadata({
    locale,
    path: "/affiliates",
    title: `Affiliate programme — earn up to ${top}% recurring | GoldBot by AL-ai-FX`,
    description:
      `Share one link and earn up to ${top}% of every order your referrals place — first purchase and ` +
      "every renewal. Your audience gets a discount on their first GoldBot licence.",
  });
}

const PERIOD_LABEL: Record<string, string> = {
  TEN_DAYS: "10 days",
  ONE_MONTH: "Monthly",
  SIX_MONTHS: "6 months",
  ONE_YEAR: "Yearly",
};

export default async function AffiliatesPage() {
  const [settings, tiers, session] = await Promise.all([
    getSettings(),
    getTiers(),
    getServerSession(authOptions),
  ]);

  // Real catalog prices for the calculator, never a made-up example.
  const prices = await prisma.robotPrice.findMany({
    where: { active: true, amount: { gt: 0 }, tier: { in: CATALOG_PUBLIC_TIERS } },
    include: { robot: { select: { name: true, active: true, sortOrder: true } } },
    orderBy: [{ robot: { sortOrder: "asc" } }, { amount: "asc" }],
  });
  const plans: CalcPlan[] = prices
    .filter((p) => p.robot.active && (p.tier === "ONE_MONTH" || p.tier === "ONE_YEAR"))
    .map((p) => ({
      id: p.id,
      label: `${p.robot.name} · ${PERIOD_LABEL[p.tier] ?? p.tier}`,
      price: p.amount,
    }));

  const rates = tiers.length
    ? tiers.map((t) => ({ name: t.name, rate: t.rate }))
    : [{ name: "Standard", rate: settings.defaultRate }];
  const topRate = Math.max(...rates.map((r) => r.rate));

  const signedIn = Boolean(session?.user?.id);
  const joinHref = signedIn ? "/dashboard/affiliate" : "/login?callbackUrl=/dashboard/affiliate";

  const steps = [
    {
      icon: Link2,
      title: "Grab your link",
      copy: "Sign in and the dashboard hands you a personal link and code, with a ready-made post you can paste anywhere.",
    },
    {
      icon: Share2,
      title: "Share it",
      copy: `Anyone who opens it is credited to you for ${settings.cookieDays} days — and permanently once they create an account, even if they only take the free trial first and buy weeks later.`,
    },
    {
      icon: BadgePercent,
      title: "They buy at a discount",
      copy: `Your referral gets ${settings.referredDiscount}% off their first licence — a real offer to lead with, not just a link.`,
    },
    {
      icon: Wallet,
      title: "You get paid, repeatedly",
      copy: `Commission clears after ${settings.holdDays} days (our refund window) and is withdrawable from $${settings.minPayout}. Every renewal pays again.`,
    },
  ];

  const faqs = [
    {
      q: "Who can join?",
      a: "Anyone with an account. You do not need to own a licence, and there is no audience minimum — a trading group, a YouTube channel, or one friend all work the same way.",
    },
    {
      q: "When am I paid?",
      a: `Commission is held for ${settings.holdDays} days to cover our refund window, then it becomes withdrawable. Request a payout above $${settings.minPayout} and tell us where to send it — crypto, Wise, or bank.`,
    },
    {
      q: "What if my referral refunds?",
      a: "That commission is reversed. It is the only reason money is ever taken back, and it is why the hold exists at all.",
    },
    {
      q: "Can I refer myself?",
      a: "No — self-referral is blocked. Everything else is fair game, including paid ads, as long as you do not bid on our brand name or promise returns we do not.",
    },
    {
      q: "What do I get to see?",
      a: "Clicks, signups, every sale, what cleared and what is still on hold — in your own dashboard, updated as it happens. Customer emails stay masked.",
    },
    {
      q: "Is trading risky?",
      a: "Yes, and you must say so. Promote the robot honestly: no guaranteed profits, no fabricated results. Accounts that mislead are removed from the programme.",
    },
  ];

  const tierBasisLabel =
    settings.tierBasis === "VOLUME" ? "total commission earned" : "referrals who bought";

  return (
    <main className="main-content af-shell">
      {/* ---------------- Hero ---------------- */}
      <section className="af-hero">
        <div className="af-container af-hero-grid">
          <div className="af-hero-copy">
            <span className="af-eyebrow">
              <Users size={13} aria-hidden="true" />
              Affiliate programme
            </span>
            <h1>
              Share one link.
              <span> Get paid every month they stay.</span>
            </h1>
            <p>
              Earn up to <strong>{topRate}%</strong> of every order your referrals place — not just
              their first purchase, but every renewal for as long as they keep trading with us. The
              people you send get <strong>{settings.referredDiscount}% off</strong> their first
              licence.
            </p>

            <div className="af-hero-actions">
              <Link href={joinHref} className="af-btn is-primary">
                {signedIn ? "Get my link" : "Sign in and get my link"}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="af-btn">
                How it works
              </a>
            </div>

            <ul className="af-perks">
              <li>Free to join</li>
              <li>No minimum audience</li>
              <li>Paid in the currency you choose</li>
            </ul>
          </div>

          <ul className="af-stats" aria-label="Programme at a glance">
            <li>
              <strong>{topRate}%</strong>
              <span>top commission rate</span>
            </li>
            <li>
              <strong>{settings.referredDiscount}%</strong>
              <span>off for your referrals</span>
            </li>
            <li>
              <strong>{settings.cookieDays}d</strong>
              <span>link attribution window</span>
            </li>
            <li>
              <strong>${settings.minPayout}</strong>
              <span>minimum payout</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ---------------- Calculator ---------------- */}
      {plans.length > 0 && (
        <section className="af-section" aria-labelledby="af-calc-title">
          <div className="af-container">
            <div className="af-heading">
              <span className="af-eyebrow">Earnings calculator</span>
              <h2 id="af-calc-title">
                See what your audience
                <span> could be worth.</span>
              </h2>
              <p>Uses today&apos;s real plan prices and commission rates.</p>
            </div>
            <EarningsCalculator
              plans={plans}
              rates={rates}
              referredDiscount={settings.referredDiscount}
              lifetimeScope={settings.lifetimeScope}
            />
          </div>
        </section>
      )}

      {/* ---------------- How it works ---------------- */}
      <section id="how-it-works" className="af-section af-section-alt">
        <div className="af-container">
          <div className="af-heading">
            <span className="af-eyebrow">How it works</span>
            <h2>
              Four steps,
              <span> then it runs itself.</span>
            </h2>
          </div>

          <ol className="af-steps">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title}>
                  <span className="af-step-node">
                    <Icon size={20} aria-hidden="true" />
                    <em>{index + 1}</em>
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ---------------- Tiers ---------------- */}
      <section className="af-section">
        <div className="af-container">
          <div className="af-heading">
            <span className="af-eyebrow">Commission tiers</span>
            <h2>
              Your rate climbs
              <span> as you sell.</span>
            </h2>
            <p>
              Based on {tierBasisLabel}. Tier changes apply to new sales; nothing you have already
              earned changes.
            </p>
          </div>

          <div className="af-tiers">
            {tiers.map((tier, index) => {
              const isTop = tier.rate === topRate;
              return (
                <article key={tier.id} className={`af-tier ${isTop ? "is-top" : ""}`}>
                  <div className="af-tier-head">
                    <span className="af-tier-name">{tier.name}</span>
                    {isTop && <span className="af-tier-badge">Top tier</span>}
                  </div>
                  <p className="af-tier-rate">
                    {tier.rate}
                    <span>%</span>
                  </p>
                  <p className="af-tier-note">
                    {tier.threshold === 0
                      ? "From your first sale"
                      : settings.tierBasis === "VOLUME"
                        ? `From $${tier.threshold.toLocaleString("en-US")} earned`
                        : `From ${tier.threshold} referrals`}
                  </p>
                  <div className="af-tier-bar" aria-hidden="true">
                    <span style={{ width: `${((index + 1) / tiers.length) * 100}%` }} />
                  </div>
                </article>
              );
            })}
          </div>

          <ul className="af-facts">
            <li>
              <RefreshCcw size={16} aria-hidden="true" />
              {settings.lifetimeScope ? "Earn on every renewal, not just the first order" : "Earn on each referral's first order"}
            </li>
            <li>
              <CalendarClock size={16} aria-hidden="true" />
              {settings.holdDays}-day hold covers the refund window
            </li>
            <li>
              <Eye size={16} aria-hidden="true" />
              Live dashboard: clicks, signups, sales, payouts
            </li>
          </ul>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="af-section af-section-alt">
        <div className="af-container af-faq-grid">
          <div className="af-heading">
            <span className="af-eyebrow">The details</span>
            <h2>
              Before
              <span> you ask.</span>
            </h2>
            <p className="af-rule">
              <ShieldAlert size={16} aria-hidden="true" />
              Promote honestly: trading is risky, and no one can promise profits.
            </p>
          </div>
          <AffiliateFaq items={faqs} />
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="af-section">
        <div className="af-container">
          <div className="af-cta">
            <div>
              <h2>
                Ready to share<span>?</span>
              </h2>
              <p>Takes about a minute. Your link is ready the moment you sign in.</p>
            </div>
            <Link href={joinHref} className="af-btn is-primary">
              {signedIn ? "Open my affiliate dashboard" : "Create an account and start"}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
