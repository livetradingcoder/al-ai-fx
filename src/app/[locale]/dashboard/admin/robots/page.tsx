import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CATALOG_PUBLIC_TIERS } from "@/lib/catalog-tiers";
import RobotsTable from "./RobotsTable";

export const metadata = { title: "Manage robots" };

export default async function AdminRobotsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // No `where` filter — the admin management surface must show inactive robots too.
  const robots = await prisma.robot.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      prices: { where: { active: true }, select: { tier: true, amount: true } },
      _count: { select: { subscriptions: true } },
    },
  });

  // Each row is one card on /catalog. Whether it sells there depends on two
  // things at once — the robot's active flag AND whether a public tier has an
  // active price — so the table says so outright instead of making an admin
  // infer it from a boolean.
  const rows = robots.map((robot) => {
    const publicPrices = robot.prices.filter((p) => CATALOG_PUBLIC_TIERS.includes(p.tier));
    const paid = publicPrices.filter((p) => p.amount > 0);
    return {
      id: robot.id,
      slug: robot.slug,
      name: robot.name,
      shortDescription: robot.shortDescription,
      longDescription: robot.longDescription,
      active: robot.active,
      artworkUrl: robot.artworkUrl,
      sortOrder: robot.sortOrder,
      sourceVersion: robot.sourceVersion,
      paidTiers: paid.length,
      cheapestPaid: paid.length ? Math.min(...paid.map((p) => p.amount)) : null,
      hasFreeTrial: publicPrices.some((p) => p.amount === 0),
      subscriptions: robot._count.subscriptions,
    };
  });

  return (
    <>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Robots</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "72ch" }}>
          Every row is one card on the public catalog. A robot sells only when it is listed{" "}
          <em>and</em> a public tier has an active price — listed without prices, it still
          appears, as &ldquo;Coming soon&rdquo;. Uploading a source bumps its version, and every
          build compiled after that uses the new one.
        </p>
      </header>

      <RobotsTable robots={rows} />
    </>
  );
}
