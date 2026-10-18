import { PricingTier } from "@prisma/client";

import { CATALOG_PUBLIC_TIERS, TIER_ENUM_TO_SLUG } from "@/lib/catalog-tiers";
import { prisma } from "@/lib/prisma";

/** One robot in the checkout picker: display prices by tier slug, never the amount that is charged. */
export type CheckoutRobot = {
  slug: string;
  name: string;
  shortDescription: string;
  artworkUrl: string | null;
  badge: string | null;
  prices: Record<string, number>;
};

/**
 * The robots a buyer can pick at checkout, with their public prices. Shared by
 * /api/robots and the checkout page (which hands it to the client as its first
 * render), so there is one place that decides what checkout shows. Charges are
 * still resolved server-side from the price rows (resolveRobotPrice).
 */
export async function listCheckoutRobots(): Promise<CheckoutRobot[]> {
  const robots = await prisma.robot.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { prices: { where: { active: true } } },
  });

  return robots
    .map((robot) => {
      const prices: Record<string, number> = {};
      for (const price of robot.prices) {
        // Public tiers only: LIFETIME / LIFETIME_SOURCE / SECRET_TEST_TIER are
        // contact-only and must never surface as checkout chips.
        if (!CATALOG_PUBLIC_TIERS.includes(price.tier)) continue;
        // A plan priced at zero is not for sale (checkout refuses it); only the trial may be free.
        if (price.amount <= 0 && price.tier !== PricingTier.FREE_TRIAL) continue;
        prices[TIER_ENUM_TO_SLUG[price.tier]] = price.amount;
      }
      return {
        slug: robot.slug,
        name: robot.name,
        shortDescription: robot.shortDescription,
        artworkUrl: robot.artworkUrl,
        badge: robot.badge,
        prices,
      };
    })
    // Coming-soon robots (listed in the catalog, nothing on sale) must not reach
    // the picker: there is nothing to charge for yet.
    .filter((robot) => Object.keys(robot.prices).length > 0);
}
