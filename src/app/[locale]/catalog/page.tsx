import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATALOG_PUBLIC_TIERS, TIER_ENUM_TO_SLUG, formatUsd } from "@/lib/catalog-tiers";

// "catalog" is not a registered PublicPageKey in src/lib/seo.ts (adding one would
// require touching PAGE_COPY for all 7 locales) — static metadata fallback instead.
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Robot Catalog — AL-ai-FX",
    description: "Browse our automated MetaTrader 5 expert advisors — pick a robot, pick a plan, get your account-locked build in minutes.",
  };
}

export default async function CatalogPage() {
  // PUBLIC page — no auth gate. Visitors browse without logging in.
  const robots = await prisma.robot.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { prices: { where: { active: true } } },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "4rem 1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>Robot Catalog</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "3rem", maxWidth: "640px" }}>
        Each robot is delivered as a compiled, MT5-account-locked build within minutes of checkout.
      </p>

      {robots.length === 0 && (
        <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
          No robots available yet — check back soon.
        </div>
      )}

      <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "2rem" }}>
        {robots.map((robot) => {
          const publicPrices = CATALOG_PUBLIC_TIERS
            .map((tier) => robot.prices.find((p) => p.tier === tier))
            .filter((p): p is (typeof robot.prices)[number] => Boolean(p));

          // Default checkout CTA: cheapest paid tier available, else free trial if that's all there is.
          const defaultPrice = publicPrices.find((p) => p.amount > 0) ?? publicPrices[0];
          const ctaHref = defaultPrice
            ? `/checkout?robot=${robot.slug}&tier=${TIER_ENUM_TO_SLUG[defaultPrice.tier]}`
            : `/checkout?robot=${robot.slug}`;

          return (
            <div key={robot.id} className="feature-card glass-panel" style={{ display: "flex", flexDirection: "column", padding: "1.5rem" }}>
              {robot.artworkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={robot.artworkUrl}
                  alt={robot.name}
                  style={{ width: "100%", height: "160px", objectFit: "cover", borderRadius: "var(--radius-sm)", marginBottom: "1rem" }}
                />
              ) : (
                <div style={{ width: "100%", height: "160px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--radius-sm)", marginBottom: "1rem" }} />
              )}

              <h2 style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>{robot.name}</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem", flexGrow: 1 }}>
                {robot.shortDescription}
              </p>

              {publicPrices.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>Pricing coming soon</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.5rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {publicPrices.map((price) => (
                    <li key={price.tier} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      <span>{TIER_ENUM_TO_SLUG[price.tier]}</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{formatUsd(price.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href={ctaHref}
                style={{
                  display: "inline-block",
                  textAlign: "center",
                  padding: "0.7rem 1.2rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--accent-primary)",
                  color: "#000",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View plans &rarr;
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
