import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/affiliate";
import { checkTrialAvailability, hashTrialIp } from "@/lib/trial-limits";

/**
 * What the pricing card should say about the free trial right now: which robot
 * offers it, and whether this visitor can claim one.
 *
 * Advisory only — /api/checkout/free-trial re-checks before provisioning.
 * Per-visitor, so it must never be cached.
 */
export async function GET(req: Request) {
  // The trial belongs to whichever robot actually prices it at zero, not to
  // whichever robot we happened to launch first.
  const trialPrice = await prisma.robotPrice.findFirst({
    where: { tier: "FREE_TRIAL", active: true, amount: 0, robot: { active: true } },
    include: { robot: { select: { slug: true, name: true } } },
    orderBy: { robot: { sortOrder: "asc" } },
  });

  if (!trialPrice) {
    return NextResponse.json(
      {
        offered: false,
        available: false,
        message: "No robot is offering a free trial right now.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const availability = await checkTrialAvailability(hashTrialIp(clientIp(req)));

  return NextResponse.json(
    {
      offered: true,
      robotSlug: trialPrice.robot.slug,
      robotName: trialPrice.robot.name,
      available: availability.available,
      reason: availability.reason,
      message: availability.message,
      resetsAt: availability.resetsAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
