import { readFile } from "node:fs/promises";
import path from "node:path";

import { CATALOG_PUBLIC_TIERS, formatUsd, hasTrialPrice, isPlanPrice } from "@/lib/catalog-tiers";
import { getContentPage } from "@/lib/content-pages";
import { getSharp } from "@/lib/image-tools";
import { OG_CATALOG_COPY, OG_PAGE_COPY } from "@/lib/og-copy";
import type { OgSpec } from "@/lib/og-spec";
import { prisma } from "@/lib/prisma";
import { clampText } from "@/lib/text-clamp";

// What a share card shows, looked up from the same data the pages use: robot
// names, descriptions and prices come from the catalog, guide titles from the
// content pages. Nothing here comes from the request beyond which page it is.

export type OgCard =
  | {
      kind: "robot";
      name: string;
      blurb: string;
      badge: string | null;
      price: string;
      freeTrial: boolean;
      /** A data: URI, so the renderer never makes a network request of its own. */
      artwork: string | null;
    }
  | {
      kind: "catalog";
      title: string;
      subtitle: string;
      count: string;
      freeTrial: boolean;
      robots: { name: string; artwork: string | null }[];
    }
  | { kind: "text"; eyebrow: string; title: string; subtitle: string; chips: string[] };

const PUBLIC_DIR = path.join(process.cwd(), "public");
const MAX_ARTWORK_BYTES = 4 * 1024 * 1024;

async function remoteBytes(url: string): Promise<Buffer | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok || !(response.headers.get("content-type") ?? "").startsWith("image/")) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes.length <= MAX_ARTWORK_BYTES ? bytes : null;
}

async function localBytes(artworkUrl: string | null, slug: string): Promise<Buffer | null> {
  // A path under public/ (e.g. /robots/x.jpg), or the bundled picture for the slug.
  const wanted = artworkUrl?.startsWith("/") ? artworkUrl : `/robots/${slug}.jpg`;
  const file = path.join(PUBLIC_DIR, wanted);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return null; // never read outside public/
  return readFile(file).catch(() => null);
}

/** The robot's picture as a data: URI, scaled down so rendering stays quick. Null when there isn't one. */
async function loadArtwork(slug: string, artworkUrl: string | null): Promise<string | null> {
  try {
    const bytes = artworkUrl && /^https?:\/\//i.test(artworkUrl) ? await remoteBytes(artworkUrl) : await localBytes(artworkUrl, slug);
    if (!bytes) return null;

    const sharp = await getSharp();
    if (sharp) {
      const jpeg = await sharp(bytes).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    }
    // Without sharp only formats the renderer reads itself are usable.
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    return isJpeg || isPng ? `data:image/${isJpeg ? "jpeg" : "png"};base64,${bytes.toString("base64")}` : null;
  } catch (err) {
    console.error("[og] artwork unavailable:", slug, err instanceof Error ? err.message : err);
    return null;
  }
}

type RobotRow = Awaited<ReturnType<typeof listRobots>>[number];

function listRobots() {
  return prisma.robot.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { prices: { where: { active: true } } },
  });
}

function publicPrices(robot: RobotRow) {
  return CATALOG_PUBLIC_TIERS.map((tier) => robot.prices.find((p) => p.tier === tier)).filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );
}

function priceLabel(robot: RobotRow): string {
  const prices = publicPrices(robot);
  const monthly = prices.find((p) => p.tier === "ONE_MONTH")?.amount ?? null;
  if (monthly !== null) return `${formatUsd(monthly)} / month`;
  const cheapest = prices.filter(isPlanPrice).sort((a, b) => a.amount - b.amount)[0]?.amount ?? null;
  return cheapest !== null ? `From ${formatUsd(cheapest)}` : "Coming soon";
}

// Any trial, free or paid: the card chip and the filter just say "Trial".
const hasFreeTrial = (robot: RobotRow) => hasTrialPrice(publicPrices(robot));

/** Same split the catalog's filter tabs make. */
const FILTERS = {
  all: () => true,
  multirange: (r: RobotRow) => /multirange/i.test(r.name),
  breakout: (r: RobotRow) => /breakout/i.test(r.name),
  "free-trial": hasFreeTrial,
} as const;

export async function resolveOgCard(spec: OgSpec): Promise<OgCard | null> {
  switch (spec.type) {
    case "robot": {
      const robot = await prisma.robot.findFirst({
        where: { slug: spec.slug, active: true },
        include: { prices: { where: { active: true } } },
      });
      if (!robot) return null;
      return {
        kind: "robot",
        name: robot.name,
        blurb: clampText(robot.shortDescription, 96),
        badge: robot.badge ? clampText(robot.badge, 34) : null,
        price: priceLabel(robot),
        freeTrial: hasFreeTrial(robot),
        artwork: await loadArtwork(robot.slug, robot.artworkUrl),
      };
    }

    case "catalog": {
      const live = (await listRobots()).filter((r) => r.prices.length > 0);
      let filter = spec.filter;
      let chosen = live.filter(FILTERS[filter]);
      if (chosen.length === 0) {
        // The page itself falls back to "all" for a tab with nothing behind it.
        filter = "all";
        chosen = live;
      }
      const lowest = chosen
        .flatMap((r) => publicPrices(r).filter(isPlanPrice).map((p) => p.amount))
        .sort((a, b) => a - b)[0];
      const shown = chosen.slice(0, 4);
      const artworks = await Promise.all(shown.map((r) => loadArtwork(r.slug, r.artworkUrl)));
      const count = `${chosen.length} ${chosen.length === 1 ? "robot" : "robots"}`;
      return {
        kind: "catalog",
        title: OG_CATALOG_COPY[filter].title,
        subtitle: OG_CATALOG_COPY[filter].subtitle,
        count: lowest !== undefined ? `${count} · from ${formatUsd(lowest)}` : count,
        freeTrial: chosen.some(hasFreeTrial),
        robots: shown.map((r, i) => ({ name: r.name, artwork: artworks[i] })),
      };
    }

    case "guide": {
      const page = getContentPage(spec.slug);
      if (!page) return null;
      return {
        kind: "text",
        eyebrow: page.eyebrow,
        title: clampText(page.h1, 90),
        subtitle: clampText(page.description, 150),
        chips: [`${page.readingMinutes} min read`],
      };
    }

    case "page": {
      const copy = OG_PAGE_COPY[spec.key];
      return { kind: "text", eyebrow: copy.eyebrow, title: copy.title, subtitle: copy.subtitle, chips: [] };
    }
  }
}
