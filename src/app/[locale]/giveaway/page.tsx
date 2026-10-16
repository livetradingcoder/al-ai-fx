import type { Metadata } from "next";
import { headers } from "next/headers";

import Countdown from "@/components/marketing/Countdown";
import GiveawayForm from "@/components/marketing/GiveawayForm";
import "@/components/marketing/rewards.css";
import { Link } from "@/i18n/routing";
import { getLiveGiveaway } from "@/lib/giveaway";
import { promoEligibilityForRequest } from "@/lib/promo-eligibility";

export const metadata: Metadata = {
  title: "Giveaway | GoldBot by AL-ai-FX",
  description: "Enter the GoldBot giveaway. No purchase necessary.",
};
export const dynamic = "force-dynamic";

export default async function GiveawayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const req = new Request("https://internal.invalid/", { headers: await headers() });
  const eligibility = await promoEligibilityForRequest(req, locale);
  const giveaway = eligibility.eligible ? await getLiveGiveaway() : null;

  return (
    <main className="main-content rw-scope rw-shell">
      <header className="rw-hero">
        <div className="rw-container">
          <span className="rw-eyebrow">Giveaway</span>
          <h1>{giveaway ? giveaway.title : "Giveaway"}</h1>
          {giveaway ? (
            <>
              <p className="rw-lead">
                Prize: <strong style={{ color: "#fff" }}>{giveaway.prize}</strong>. Enter with your email: no purchase
                necessary. Share your results from the free trial to earn extra chances.
              </p>
              <div className="rw-prize">
                <Countdown endsAt={giveaway.endsAt.toISOString()} />
                <span className="rw-small">
                  Closes {giveaway.endsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </>
          ) : (
            <p className="rw-lead">
              {eligibility.eligible
                ? "There is no giveaway running right now. Check back soon."
                : "The giveaway is not available in your region."}
            </p>
          )}
        </div>
      </header>

      {giveaway && (
        <section className="rw-section">
          <div className="rw-container rw-two">
            <div className="rw-card">
              <h2 style={{ marginBottom: "14px" }}>Enter now</h2>
              <GiveawayForm locale={locale} source="page" />
            </div>

            <div>
              <div className="rw-card">
                <h2 style={{ marginBottom: "10px" }}>Boost your chances</h2>
                <ol className="rw-muted" style={{ margin: 0, paddingLeft: "20px", display: "grid", gap: "6px" }}>
                  <li>Start the free trial and link your MT5 account.</li>
                  <li>Send your results. Approved: +1 chance.</li>
                  <li>Share them on social media. Approved: +1 chance and a discount code.</li>
                </ol>
                <p style={{ marginTop: "14px" }}>
                  <Link className="rw-btn rw-btn--ghost rw-btn--small" href="/dashboard/rewards">
                    Open my Rewards page
                  </Link>
                </p>
              </div>
              <div className="rw-card" id="rules">
                <h2 style={{ marginBottom: "10px" }}>Official rules</h2>
                <p className="rw-rules">{giveaway.rulesText}</p>
              </div>
            </div>
          </div>
          <div className="rw-container">
            <p className="rw-disclaimer">
              Entering the giveaway is free and separate from email updates. Results shown anywhere on this site
              differ from one account to the next, and past results are no guide to future ones. Trading carries a
              risk of loss. See our <Link href="/disclaimer" style={{ color: "#fcd535" }}>disclaimer</Link>.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
