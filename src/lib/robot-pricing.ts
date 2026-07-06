import { prisma } from "@/lib/prisma";
import { mapTier } from "@/lib/pricing-tiers"; // throws UnknownTierError on bad tier

export class UnknownRobotError extends Error {
  constructor(slug: string) {
    super(`Unknown or inactive robot: ${slug}`);
    this.name = "UnknownRobotError";
  }
}

export class UnknownRobotPriceError extends Error {
  constructor(key: string) {
    super(`No active price for: ${key}`);
    this.name = "UnknownRobotPriceError";
  }
}

/**
 * Server-authoritative price resolution for (robot, tier). Fail-closed:
 * - unknown tier              -> UnknownTierError (from mapTier)
 * - missing/inactive robot    -> UnknownRobotError
 * - missing/inactive price row -> UnknownRobotPriceError
 * NEVER returns a default; NEVER trusts a client-supplied amount.
 */
export async function resolveRobotPrice(robotSlug: string, tierRaw: string) {
  const tier = mapTier(tierRaw); // throws UnknownTierError
  const robot = await prisma.robot.findUnique({ where: { slug: robotSlug } });
  if (!robot || !robot.active) throw new UnknownRobotError(robotSlug);

  const price = await prisma.robotPrice.findUnique({
    where: { robotId_tier: { robotId: robot.id, tier } },
  });
  if (!price || !price.active) {
    throw new UnknownRobotPriceError(`${robotSlug}/${tierRaw}`);
  }

  return { robot, tier, amount: price.amount };
}
