import { FLAGSHIP_ROBOT } from "@/config/pricing";
import { CATALOG_PUBLIC_TIERS } from "@/lib/catalog-tiers";
import { buildPricingCatalog, type PricingCatalog } from "@/lib/pricing-catalog";
import { prisma } from "@/lib/prisma";

/**
 * The robots and prices the site sells, read the way checkout reads them:
 * active robots, active public price rows. Null when nothing is on sale or the
 * database can't be reached; callers show a link to the catalog instead of a
 * wrong or empty price list, and a pricing problem never takes a page down.
 */
export async function loadPricingCatalog(): Promise<PricingCatalog | null> {
  try {
    const robots = await prisma.robot.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        slug: true,
        name: true,
        shortDescription: true,
        badge: true,
        sortOrder: true,
        prices: {
          where: { active: true, tier: { in: CATALOG_PUBLIC_TIERS } },
          select: { tier: true, amount: true },
        },
      },
    });
    return buildPricingCatalog(robots, FLAGSHIP_ROBOT.slug);
  } catch (err) {
    console.error("[pricing] could not load the catalog:", err instanceof Error ? err.message : err);
    return null;
  }
}
