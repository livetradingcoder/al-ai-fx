import { NextRequest, NextResponse } from "next/server";
import { updateRobotPrices } from "@/app/[locale]/dashboard/admin/robots/actions";
import { prisma } from "@/lib/prisma";

// TEMPORARY — Phase 6 Plan 04 live verification route. Reverted after use.
export async function GET(req: NextRequest) {
  const amount = Number(req.nextUrl.searchParams.get("amount") ?? "199");
  const goldbot = await prisma.robot.findUniqueOrThrow({ where: { slug: "goldbot" } });
  const result = await updateRobotPrices(goldbot.id, [{ tier: "1-month", amount }]);
  return NextResponse.json({ robotId: goldbot.id, amount, result });
}
