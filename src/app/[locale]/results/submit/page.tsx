import { headers } from "next/headers";

import ProofPortal from "@/components/marketing/ProofPortal";
import { Link } from "@/i18n/routing";
import "@/components/marketing/rewards.css";
import { loadPortalContext, portalSnapshot } from "@/lib/proof-portal";
import { promoEligibilityForRequest } from "@/lib/promo-eligibility";
import { noIndexMetadata } from "@/lib/seo";

// A private link from an email: out of search results, and never cached.
export const metadata = noIndexMetadata("Send your results | GoldBot by AL-ai-FX");
export const dynamic = "force-dynamic";

export default async function SubmitResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { locale } = await params;
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";

  const ctx = await loadPortalContext(token);

  let snapshot = null;
  if (ctx) {
    const req = new Request("https://internal.invalid/", { headers: await headers() });
    const eligibility = await promoEligibilityForRequest(req, locale);
    snapshot = await portalSnapshot(ctx, eligibility.eligible);
  }

  return (
    <main className="main-content rw-scope rw-shell">
      <header className="rw-hero">
        <div className="rw-container">
          <span className="rw-eyebrow">Your results</span>
          <h1>Show how your trial went</h1>
          <p className="rw-lead">
            Send a screenshot of your MT5 results, share it if you like, and earn a discount. Good days and
            bad days both count. It takes about two minutes.
          </p>
        </div>
      </header>
      <section className="rw-section">
        <div className="rw-container">
          {ctx ? (
            <ProofPortal token={token} locale={locale} initial={snapshot} />
          ) : (
            <div className="rw-card">
              <h2>This link has expired</h2>
              <p className="rw-muted" style={{ marginTop: "8px" }}>
                Results links last 45 days. Sign in to your dashboard and open Rewards to get a fresh one, or reply
                to the email we sent you and we will send a new link.
              </p>
              <p style={{ marginTop: "16px" }}>
                <Link className="rw-btn rw-btn--small" href="/dashboard/rewards">
                  Open my Rewards page
                </Link>
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
