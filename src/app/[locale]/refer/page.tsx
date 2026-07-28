import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings, getTiers } from "@/lib/affiliate";
import { CATALOG_PUBLIC_TIERS } from "@/lib/catalog-tiers";

// Public recruiting page for the affiliate programme. Numbers are read from the
// live settings and ladder, so changing a rate in the admin changes the pitch
// here too — a marketing page that quietly goes out of date is worse than none.
export async function generateMetadata(): Promise<Metadata> {
  const tiers = await getTiers();
  const top = tiers.length ? Math.max(...tiers.map((t) => t.rate)) : 35;
  return {
    title: `Refer & Earn — up to ${top}% recurring | AL-ai-FX`,
    description:
      `Share one link. Earn up to ${top}% of every order your referrals place — first purchase and ` +
      "every renewal after it. Your audience gets a discount on their first licence.",
  };
}

export default async function ReferPage() {
  const [settings, tiers, session] = await Promise.all([
    getSettings(),
    getTiers(),
    getServerSession(authOptions),
  ]);

  // What an affiliate would actually earn, using real catalog prices rather
  // than a made-up example.
  const prices = await prisma.robotPrice.findMany({
    where: { active: true, amount: { gt: 0 }, tier: { in: CATALOG_PUBLIC_TIERS } },
    include: { robot: { select: { name: true, active: true } } },
    orderBy: { amount: "asc" },
  });
  const sellable = prices.filter((p) => p.robot.active);
  const topRate = tiers.length ? Math.max(...tiers.map((t) => t.rate)) : settings.defaultRate;
  const entryRate = tiers.length ? Math.min(...tiers.map((t) => t.rate)) : settings.defaultRate;
  const yearly = sellable.filter((p) => p.tier === "ONE_YEAR").sort((a, b) => b.amount - a.amount)[0];
  const monthly = sellable.find((p) => p.tier === "ONE_MONTH");

  const examples = [monthly, yearly].filter(Boolean).map((p) => ({
    label: `${p!.robot.name} · ${p!.tier.replace(/_/g, " ").toLowerCase()}`,
    price: p!.amount,
    entry: Math.round(p!.amount * entryRate) / 100,
    top: Math.round(p!.amount * topRate) / 100,
  }));

  const joinHref = session?.user?.id ? "/dashboard/affiliate" : "/login?callbackUrl=/dashboard/affiliate";

  return (
    <main className="main-content landing-shell">
      <section className="landing-section">
        <div className="landing-container">
          <div className="section-heading" style={{ marginBottom: "2.5rem" }}>
            <span className="landing-eyebrow">Refer &amp; earn</span>
            <h1 className="section-title">
              Share one link. Get paid every month they stay.
            </h1>
            <p className="section-copy">
              Our affiliate programme pays up to {topRate}% of every order your referrals place —
              not just their first purchase, but every renewal for as long as they keep trading
              with us. The people you send get {settings.referredDiscount}% off their first licence.
            </p>
          </div>

          <div className="refer-cta">
            <Link href={joinHref} className="btn-primary">
              {session?.user?.id ? "Get my link" : "Sign in and get my link"}
            </Link>
            <span>Free to join · no minimum audience · paid in the currency you choose</span>
          </div>

          {examples.length > 0 && (
            <div className="refer-grid" style={{ marginTop: "3rem" }}>
              {examples.map((ex) => (
                <article key={ex.label} className="glass-panel refer-card">
                  <p className="landing-eyebrow">{ex.label}</p>
                  <p className="refer-figure">
                    ${ex.entry.toFixed(2)}
                    <span>–${ex.top.toFixed(2)}</span>
                  </p>
                  <p className="refer-note">
                    per sale of a ${ex.price} licence, depending on your tier — repeated on every
                    renewal.
                  </p>
                </article>
              ))}
              <article className="glass-panel refer-card">
                <p className="landing-eyebrow">Ten referrals on yearly</p>
                <p className="refer-figure">
                  ${yearly ? ((yearly.amount * topRate) / 100 * 10).toFixed(0) : "—"}
                  <span>/year</span>
                </p>
                <p className="refer-note">
                  At the top tier, and again the year after if they renew.
                </p>
              </article>
            </div>
          )}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <div className="section-heading">
            <span className="landing-eyebrow">How it works</span>
            <h2 className="section-title">Four steps, then it runs itself.</h2>
          </div>

          <ol className="refer-steps">
            <li>
              <span className="refer-step-num">1</span>
              <div>
                <h3>Grab your link</h3>
                <p>
                  Sign in and the dashboard hands you a personal link and code, with a ready-made
                  post you can paste anywhere.
                </p>
              </div>
            </li>
            <li>
              <span className="refer-step-num">2</span>
              <div>
                <h3>Share it</h3>
                <p>
                  Anyone who opens it is credited to you for {settings.cookieDays} days — and
                  permanently once they create an account, even if they only take the free trial
                  first and buy weeks later.
                </p>
              </div>
            </li>
            <li>
              <span className="refer-step-num">3</span>
              <div>
                <h3>They buy at a discount</h3>
                <p>
                  Your referral gets {settings.referredDiscount}% off their first licence — a real
                  offer to lead with, not just a link.
                </p>
              </div>
            </li>
            <li>
              <span className="refer-step-num">4</span>
              <div>
                <h3>You get paid, repeatedly</h3>
                <p>
                  Commission clears after {settings.holdDays} days (our refund window) and is
                  withdrawable from ${settings.minPayout}. Every renewal pays again.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <div className="section-heading">
            <span className="landing-eyebrow">Commission tiers</span>
            <h2 className="section-title">Your rate climbs as you sell.</h2>
            <p className="section-copy">
              Based on {settings.tierBasis === "VOLUME" ? "total commission earned" : "referrals who bought"}.
              Tier changes apply to new sales; nothing you have already earned changes.
            </p>
          </div>

          <div className="refer-tiers">
            {tiers.map((tier) => (
              <article key={tier.id} className="glass-panel refer-tier">
                <p className="landing-eyebrow">{tier.name}</p>
                <p className="refer-figure">
                  {tier.rate}
                  <span>%</span>
                </p>
                <p className="refer-note">
                  {tier.threshold === 0
                    ? "From your first sale"
                    : settings.tierBasis === "VOLUME"
                      ? `From $${tier.threshold} earned`
                      : `From ${tier.threshold} referrals`}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <div className="section-heading">
            <span className="landing-eyebrow">The details</span>
            <h2 className="section-title">Before you ask.</h2>
          </div>

          <div className="refer-faq">
            <div className="glass-panel">
              <h3>Who can join?</h3>
              <p>
                Anyone with an account. You do not need to own a licence, and there is no audience
                minimum — a trading group, a YouTube channel, or one friend all work the same way.
              </p>
            </div>
            <div className="glass-panel">
              <h3>When am I paid?</h3>
              <p>
                Commission is held for {settings.holdDays} days to cover our refund window, then it
                becomes withdrawable. Request a payout above ${settings.minPayout} and tell us where
                to send it — crypto, Wise, or bank.
              </p>
            </div>
            <div className="glass-panel">
              <h3>What if my referral refunds?</h3>
              <p>
                That commission is reversed. It is the only reason money is ever taken back, and
                it is why the hold exists at all.
              </p>
            </div>
            <div className="glass-panel">
              <h3>Can I refer myself?</h3>
              <p>
                No — self-referral is blocked. Everything else is fair game, including paid ads,
                as long as you do not bid on our brand name or promise returns we do not.
              </p>
            </div>
            <div className="glass-panel">
              <h3>What do I get to see?</h3>
              <p>
                Clicks, signups, every sale, what cleared and what is still on hold — in your own
                dashboard, updated as it happens. Customer emails stay masked.
              </p>
            </div>
            <div className="glass-panel">
              <h3>Is trading risky?</h3>
              <p>
                Yes, and you must say so. Promote the robot honestly: no guaranteed profits, no
                fabricated results. Accounts that mislead are removed from the programme.
              </p>
            </div>
          </div>

          <div className="refer-cta" style={{ marginTop: "2.5rem" }}>
            <Link href={joinHref} className="btn-primary">
              {session?.user?.id ? "Open my affiliate dashboard" : "Create an account and start"}
            </Link>
            <span>Takes about a minute.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
