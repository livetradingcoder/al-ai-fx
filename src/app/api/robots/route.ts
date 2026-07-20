import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATALOG_PUBLIC_TIERS, TIER_ENUM_TO_SLUG } from "@/lib/catalog-tiers";

// PUBLIC list of purchasable robots for the checkout robot picker.
// Display-only — charge amounts stay server-authoritative in create-session.
export async function GET() {
  const robots = await prisma.robot.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { prices: { where: { active: true } } },
  });

  return NextResponse.json(
    {
      robots: robots.map((robot) => {
        const prices: Record<string, number> = {};
        for (const price of robot.prices) {
          // Public tiers only — LIFETIME/LIFETIME_SOURCE/SECRET_TEST_TIER are
          // contact-only and must never surface as checkout chips.
          if (!CATALOG_PUBLIC_TIERS.includes(price.tier)) continue;
          prices[TIER_ENUM_TO_SLUG[price.tier]] = price.amount;
        }
        return {
          slug: robot.slug,
          name: robot.name,
          shortDescription: robot.shortDescription,
          artworkUrl: robot.artworkUrl,
          prices,
        };
      }),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
