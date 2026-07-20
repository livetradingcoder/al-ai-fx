import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATALOG_PUBLIC_TIERS, TIER_ENUM_TO_SLUG } from "@/lib/catalog-tiers";

// PUBLIC read-only robot lookup for checkout display. Amounts here are
// display-only — the charge amount is always resolved server-side in
// create-session via resolveRobotPrice (fail-closed). Exposes only active
// robots and active price rows, same visibility as /catalog.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;

  const robot = await prisma.robot.findFirst({
    where: { slug, active: true },
    include: { prices: { where: { active: true } } },
  });

  if (!robot) {
    return NextResponse.json({ error: "Robot not found" }, { status: 404 });
  }

  const prices: Record<string, number> = {};
  for (const price of robot.prices) {
    // Public tiers only — contact-only tiers never surface in checkout.
    if (!CATALOG_PUBLIC_TIERS.includes(price.tier)) continue;
    prices[TIER_ENUM_TO_SLUG[price.tier]] = price.amount;
  }

  return NextResponse.json(
    {
      slug: robot.slug,
      name: robot.name,
      shortDescription: robot.shortDescription,
      artworkUrl: robot.artworkUrl,
      prices,
    },
    {
      headers: {
        // Prices are admin-editable; cache briefly at the edge only.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
