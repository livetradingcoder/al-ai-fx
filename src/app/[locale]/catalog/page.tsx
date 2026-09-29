import type { Metadata } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { breadcrumbJsonLd, buildMetadata, jsonLdScript } from "@/lib/seo";
import { CATALOG_PUBLIC_TIERS } from "@/lib/catalog-tiers";
import { FLAGSHIP_ROBOT } from "@/config/pricing";
import CatalogGrid, { type CatalogRobot } from "./CatalogGrid";
import "./catalog.css";

// "catalog" is not a registered PublicPageKey in src/lib/seo.ts (adding one would
// require touching PAGE_COPY for all 7 locales), so it uses buildMetadata with
// English copy — still with its own canonical and hreflang set.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    path: "/catalog",
    title: "MT5 gold trading robots catalog | GoldBot by AL-ai-FX",
    description:
      "Compare GoldBot's MetaTrader 5 gold robots — MultiRange and Breakout expert advisors for XAUUSD, each delivered as an account-locked build minutes after checkout. Free trial available.",
  });
}

// Robots without an artworkUrl fall back to a bundled /robots/<slug>.jpg when
// one ships with the app, so a fresh catalog row still gets its picture.
function artworkFor(slug: string, artworkUrl: string | null): string | null {
  if (artworkUrl) return artworkUrl;
  const bundled = path.join(process.cwd(), "public", "robots", `${slug}.jpg`);
  return existsSync(bundled) ? `/robots/${slug}.jpg` : null;
}

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // PUBLIC page — no auth gate. Visitors browse without logging in.
  const rows = await prisma.robot.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { prices: { where: { active: true } } },
  });

  const robots: CatalogRobot[] = rows.map((robot) => {
    const publicPrices = CATALOG_PUBLIC_TIERS.map((tier) =>
      robot.prices.find((p) => p.tier === tier),
    ).filter((p): p is NonNullable<typeof p> => Boolean(p));

    const cheapestPaid = publicPrices
      .filter((p) => p.amount > 0)
      .sort((a, b) => a.amount - b.amount)[0];

    return {
      slug: robot.slug,
      name: robot.name,
      shortDescription: robot.shortDescription,
      badge: robot.badge,
      artwork: artworkFor(robot.slug, robot.artworkUrl),
      fromPrice: cheapestPaid?.amount ?? null,
      monthlyPrice: publicPrices.find((p) => p.tier === "ONE_MONTH")?.amount ?? null,
      hasFreeTrial: publicPrices.some((p) => p.amount === 0),
      comingSoon: robot.prices.length === 0,
      flagship: robot.slug === FLAGSHIP_ROBOT.slug,
    };
  });

  const live = robots.filter((r) => !r.comingSoon);
  const lowestPrice = live
    .map((r) => r.fromPrice)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b)[0];

  return (
    <main className="main-content cat-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd(locale, [
            { name: "Home", path: "/" },
            { name: "Catalog", path: "/catalog" },
          ]),
        )}
      />
      <div className="cat-container">
        <header className="cat-header">
          <span className="cat-eyebrow">Catalog</span>
          <h1>
            Pick your robot<span>.</span>
          </h1>
          <p>
            Every robot ships as a compiled, MT5-account-locked build delivered
            minutes after checkout. Each subscription covers one robot.
          </p>

          <ul className="cat-stats">
            <li>
              <strong>{live.length}</strong>
              <span>live robots</span>
            </li>
            {lowestPrice !== undefined && (
              <li>
                <strong>
                  ${lowestPrice.toLocaleString("en-US")}
                </strong>
                <span>starting price</span>
              </li>
            )}
            <li>
              <strong>MT5</strong>
              <span>native builds</span>
            </li>
          </ul>
        </header>

        <CatalogGrid robots={robots} />
      </div>
    </main>
  );
}
