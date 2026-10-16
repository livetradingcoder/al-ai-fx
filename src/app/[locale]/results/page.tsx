import type { Metadata } from "next";
import { headers } from "next/headers";

import "@/components/marketing/rewards.css";
import { prisma } from "@/lib/prisma";
import { promoEligibilityForRequest } from "@/lib/promo-eligibility";
import { Link } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Trader results | GoldBot by AL-ai-FX",
  description:
    "Results screenshots shared by GoldBot traders, each checked before it is shown. Results vary and past performance does not guarantee future results.",
};
export const dynamic = "force-dynamic";

const MAX_SHOWN = 36;

export default async function ResultsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const req = new Request("https://internal.invalid/", { headers: await headers() });
  const eligibility = await promoEligibilityForRequest(req, locale);

  // Shown only where promotions are allowed; elsewhere the page explains, and
  // the image route would refuse the files anyway.
  const proofs = eligibility.eligible
    ? await prisma.resultProof.findMany({
        where: { status: "APPROVED", publishConsent: true, publishedAt: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: MAX_SHOWN,
        select: { id: true, displayName: true, publishedAt: true },
      })
    : [];

  return (
    <main className="main-content rw-scope rw-shell">
      <header className="rw-hero">
        <div className="rw-container">
          <span className="rw-eyebrow">Community</span>
          <h1>Results shared by traders</h1>
          <p className="rw-lead">
            Screenshots sent in by people running GoldBot on their own MT5 accounts. Each one is checked by our
            team before it appears here, and account numbers are hidden.
          </p>
        </div>
      </header>

      <section className="rw-section">
        <div className="rw-container">
          {proofs.length > 0 ? (
            <ul className="rw-wall">
              {proofs.map((p) => (
                <li key={p.id}>
                  <figure className="rw-proof" style={{ margin: 0 }}>
                    <a href={`/api/proofs/${p.id}/image`} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/proofs/${p.id}/image`} alt="Results screenshot shared by a GoldBot trader" loading="lazy" />
                    </a>
                    <figcaption>
                      <strong>{p.displayName ?? "A GoldBot trader"}</strong>
                      <span>{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : ""}</span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rw-empty">
              <p>
                {eligibility.eligible
                  ? "No results have been published yet. Check back soon."
                  : "Shared results are not shown in your region."}
              </p>
            </div>
          )}

          <p className="rw-disclaimer">
            Results differ from one account to the next, depend on the broker, the account size and the market,
            and past results are no guide to future ones. Trading carries a risk of loss. Nothing here is
            financial advice. See our <Link href="/disclaimer" style={{ color: "#fcd535" }}>disclaimer</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
