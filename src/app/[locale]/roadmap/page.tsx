import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import RoadmapBoard from "./RoadmapBoard";

// English-only, like /catalog: the robot copy comes from single-language DB rows.
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Roadmap — AL-ai-FX",
    description:
      "Robots and platforms in development at AL-ai-FX: new MT5 gold robots, TradingView signals and a cTrader edition.",
  };
}

export default async function RoadmapPage() {
  // The catalog's own "Coming soon" rule: listed, nothing to buy yet. Switch a
  // robot's prices on in the admin and it moves from here to the catalog.
  const [robots, onSale] = await Promise.all([
    prisma.robot.findMany({
      where: { active: true, prices: { none: { active: true } } },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, shortDescription: true },
    }),
    prisma.robot.count({ where: { active: true, prices: { some: { active: true } } } }),
  ]);

  return <RoadmapBoard robots={robots} onSale={onSale} />;
}
