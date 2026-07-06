import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// TEMPORARY — Phase 7 kickoff, list current Robot rows. Reverted after use.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const robots = await prisma.robot.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ robots });
}
