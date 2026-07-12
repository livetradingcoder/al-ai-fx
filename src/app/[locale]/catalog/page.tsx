import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATALOG_PUBLIC_TIERS, formatUsd } from "@/lib/catalog-tiers";

// "catalog" is not a registered PublicPageKey in src/lib/seo.ts (adding one would
// require touching PAGE_COPY for all 7 locales) — static metadata fallback instead.
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Robot Catalog — AL-ai-FX",
    description:
      "Browse our automated MetaTrader 5 expert advisors — pick a robot, pick a plan, get your account-locked build in minutes.",
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
    <main className="main-content landing-shell">
      <section className="landing-section">
        <div className="landing-container">
          <div className="section-heading" style={{ marginBottom: "3rem" }}>
            <span className="landing-eyebrow">Catalog</span>
            <h1 className="section-title">Pick your robot.</h1>
            <p className="section-copy">
              Every robot ships as a compiled, MT5-account-locked build delivered
              minutes after checkout. Each subscription covers one robot.
            </p>
          </div>

          {robots.length === 0 && (
            <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
              No robots available yet — check back soon.
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "2rem",
            }}
          >
            {robots.map((robot) => {
              const publicPrices = CATALOG_PUBLIC_TIERS.map((tier) =>
                robot.prices.find((p) => p.tier === tier)
              ).filter((p): p is NonNullable<typeof p> => Boolean(p));

              const cheapestPaid = publicPrices
                .filter((p) => p.amount > 0)
                .sort((a, b) => a.amount - b.amount)[0];
              const hasFreeTrial = publicPrices.some((p) => p.amount === 0);
              const comingSoon = robot.prices.length === 0;

              return (
                <article
                  key={robot.id}
                  className="feature-card glass-panel"
                  style={{ display: "flex", flexDirection: "column", padding: "1.5rem" }}
                >
                  {robot.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={robot.artworkUrl}
                      alt={robot.name}
                      style={{
                        width: "100%",
                        height: "160px",
                        objectFit: "cover",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: "1rem",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "160px",
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: "1rem",
                      }}
                    />
                  )}

                  <h2
                    style={{
                      fontSize: "1.4rem",
                      marginBottom: "0.5rem",
                      minHeight: "4.2rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                    }}
                  >
                    {robot.name}
                  </h2>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "0.9rem",
                      marginBottom: "1.5rem",
                      minHeight: "4.1rem",
                      flexGrow: 1,
                    }}
                  >
                    {robot.shortDescription}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: "1.25rem",
                    }}
                  >
                    {cheapestPaid ? (
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                        From{" "}
                        <strong style={{ color: "var(--text-primary)", fontSize: "1.2rem" }}>
                          {formatUsd(cheapestPaid.amount)}
                        </strong>
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--accent-primary)",
                          border: "1px solid var(--accent-primary)",
                          borderRadius: "999px",
                          padding: "0.3rem 0.75rem",
                        }}
                      >
                        Coming soon
                      </span>
                    )}
                    {hasFreeTrial && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "var(--accent-primary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "999px",
                          padding: "0.25rem 0.6rem",
                        }}
                      >
                        Free trial
                      </span>
                    )}
                  </div>

                  {comingSoon ? (
                    <span
                      className="btn-secondary fill"
                      aria-disabled="true"
                      style={{ textAlign: "center", opacity: 0.7 }}
                    >
                      Coming soon
                    </span>
                  ) : (
                    <Link
                      href={`/robots/${robot.slug}`}
                      className="btn-primary fill"
                      style={{ textAlign: "center", textDecoration: "none" }}
                    >
                      View robot &rarr;
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
