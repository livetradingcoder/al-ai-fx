import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CATALOG_PUBLIC_TIERS, TIER_ENUM_TO_SLUG, formatUsd } from "@/lib/catalog-tiers";
import type { PricingTier } from "@prisma/client";

// English-only page (like /catalog): copy comes from DB Robot fields, which are
// single-language — registering a PublicPageKey would force 7-locale PAGE_COPY
// for content we can't localize yet.
const TIER_DISPLAY: Record<string, { name: string; period: string }> = {
  FREE_TRIAL: { name: "Free Trial", period: "3 days, no card" },
  TEN_DAYS: { name: "10 Days", period: "one-time window" },
  ONE_MONTH: { name: "Monthly", period: "per month" },
  SIX_MONTHS: { name: "Biannual", period: "per 6 months" },
  ONE_YEAR: { name: "1 Year", period: "per year" },
};

async function getRobot(slug: string) {
  return prisma.robot.findFirst({
    where: { slug, active: true },
    include: { prices: { where: { active: true } } },
  });
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const robot = await getRobot(slug);
  if (!robot) return { title: "Robot not found — AL-ai-FX" };
  return {
    title: `${robot.name} — AL-ai-FX`,
    description: robot.shortDescription,
  };
}

export default async function RobotDetailPage(props: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await props.params;
  const robot = await getRobot(slug);
  if (!robot) notFound();

  // Public tiers only, in canonical display order.
  const prices = CATALOG_PUBLIC_TIERS.map((tier: PricingTier) =>
    robot.prices.find((p) => p.tier === tier)
  ).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const paidPrices = prices.filter((p) => p.amount > 0);
  const featuredTier: PricingTier | null =
    paidPrices.length > 0 ? paidPrices[paidPrices.length - 1].tier : null;

  const paragraphs = robot.longDescription
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <main className="main-content landing-shell">
      <section className="landing-section">
        <div className="landing-container">
          <p style={{ marginBottom: "2rem" }}>
            <Link href="/catalog" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
              &larr; All robots
            </Link>
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: robot.artworkUrl ? "minmax(260px, 420px) 1fr" : "1fr",
              gap: "3rem",
              alignItems: "center",
              marginBottom: "3rem",
            }}
          >
            {robot.artworkUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={robot.artworkUrl}
                alt={robot.name}
                style={{
                  width: "100%",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                }}
              />
            )}

            <div>
              <span className="landing-eyebrow">AL-ai-FX Robot</span>
              <h1 className="section-title section-title-left" style={{ marginBottom: "1rem" }}>
                {robot.name}
              </h1>
              <p className="section-copy section-copy-left">{robot.shortDescription}</p>
            </div>
          </div>

          {paragraphs.length > 0 && (
            <div className="glass-panel" style={{ padding: "2rem", marginBottom: "3rem" }}>
              {paragraphs.map((paragraph, index) => (
                <p
                  key={index}
                  style={{
                    color: "var(--text-secondary)",
                    lineHeight: 1.7,
                    marginBottom: index === paragraphs.length - 1 ? 0 : "1rem",
                  }}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          <div className="pricing-group-shell">
            <div className="pricing-group-head">
              <span>Choose your plan</span>
              <p>
                Every plan delivers a compiled build locked to your MT5 account number,
                minutes after checkout.
              </p>
            </div>

            {prices.length === 0 ? (
              <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                Coming soon — this robot isn&apos;t available for purchase yet.
              </div>
            ) : (
              <div className="pricing-showcase-grid pricing-showcase-grid-four">
                {prices.map((price) => {
                  const display = TIER_DISPLAY[price.tier] ?? {
                    name: price.tier,
                    period: "",
                  };
                  const tierSlug = TIER_ENUM_TO_SLUG[price.tier];
                  const featured = price.tier === featuredTier;

                  return (
                    <article
                      key={price.tier}
                      className={`pricing-tier ${featured ? "pricing-tier-featured" : ""}`}
                    >
                      {featured && <div className="pricing-tier-badge">Best Value</div>}
                      <span className="pricing-tier-label">{display.name}</span>
                      <div className="pricing-tier-price">
                        {formatUsd(price.amount)}
                        <span>{display.period}</span>
                      </div>
                      <ul className="pricing-tier-list">
                        <li>Account-locked compiled build</li>
                        <li>All strategy features</li>
                        <li>Automated delivery in minutes</li>
                      </ul>
                      <Link
                        href={`/checkout?robot=${robot.slug}&tier=${tierSlug}&name=${encodeURIComponent(robot.name)}`}
                        className="btn-primary fill"
                      >
                        Select Plan
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
