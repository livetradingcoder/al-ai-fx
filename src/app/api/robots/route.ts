import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TIER_ENUM_TO_SLUG } from "@/lib/catalog-tiers";

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
