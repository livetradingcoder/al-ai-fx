import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// TEMPORARY — Phase 7 kickoff, drive + poll a real compile job for a newly onboarded
// robot's source without redeploying per check. Reverted after use.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (jobId) {
    const job = await prisma.compilation.findUnique({
      where: { id: jobId },
      include: { robot: { select: { slug: true, sourceVersion: true } } },
    });
    return NextResponse.json({ job });
  }

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug or jobId required" }, { status: 400 });

  const robot = await prisma.robot.findUniqueOrThrow({ where: { slug } });
  const email = `verify-07-${slug}@al-ai-fx.xyz`;
  const mt5 = String(Math.floor(10000000 + Math.random() * 89999999));

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: `Phase 7 smoke test (${slug})` },
  });

  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      robotId: robot.id,
      tier: "SECRET_TEST_TIER",
      status: "ACTIVE",
      mt5AccountNumber: mt5,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  });

  const job = await prisma.compilation.create({
    data: {
      subscriptionId: subscription.id,
      robotId: robot.id,
      sourceVersion: robot.sourceVersion,
      status: "PENDING",
    },
  });

  return NextResponse.json({ jobId: job.id, robotSlug: robot.slug, mt5AccountNumber: mt5 });
}
