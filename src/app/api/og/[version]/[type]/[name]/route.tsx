import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

import { getSharp } from "@/lib/image-tools";
import { OgCardView, OG_HEIGHT, OG_WIDTH } from "@/lib/og-card";
import { resolveOgCard } from "@/lib/og-data";
import { parseOgSpec } from "@/lib/og-spec";

// The picture shown when one of our links is pasted into WhatsApp, Facebook, X
// or Slack: /api/og/v1/robot/gold-multirange-4.jpg, /api/og/v1/catalog/multirange.jpg,
// /api/og/v1/guide/install-ea-on-mt5.jpg, /api/og/v1/page/faq.jpg. See lib/og-spec.ts
// for what is accepted. Anything else is a 404: the endpoint draws our own
// pages and cannot be made to print words of someone else's choosing.

const FONT_DIR = path.join(process.cwd(), "src", "assets", "og", "fonts");
const FALLBACK_IMAGE = "/og/goldbot-share-1200x630.jpg";

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[]> | undefined;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(path.join(FONT_DIR, "outfit-latin-700-normal.woff")),
    readFile(path.join(FONT_DIR, "inter-latin-400-normal.woff")),
    readFile(path.join(FONT_DIR, "inter-latin-600-normal.woff")),
  ])
    .then(([outfit700, inter400, inter600]) => [
      { name: "Outfit", data: outfit700, weight: 700 as const, style: "normal" as const },
      { name: "Inter", data: inter400, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: inter600, weight: 600 as const, style: "normal" as const },
    ])
    .catch((err) => {
      fonts = undefined; // try again next time
      throw err;
    });
  return fonts;
}

// A scraper often asks for the same card several times in a row, and drawing
// one costs real CPU. Keyed by the page the spec names (never by the raw URL,
// so extra query junk cannot dodge it), kept for an hour.
const CACHE_MS = 60 * 60_000;
const CACHE_MAX = 64;
const cache = new Map<string, { at: number; body: Buffer; type: string }>();

const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";

export async function GET(
  request: Request,
  context: { params: Promise<{ version: string; type: string; name: string }> },
) {
  const { type, name } = await context.params;
  const spec = parseOgSpec(type, name);
  if (!spec) return new Response("Not found", { status: 404 });

  const key = JSON.stringify(spec);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return new Response(new Uint8Array(hit.body), { headers: { "Content-Type": hit.type, "Cache-Control": CACHE_CONTROL } });
  }

  try {
    const card = await resolveOgCard(spec);
    if (!card) return new Response("Not found", { status: 404 });

    const png = Buffer.from(
      await new ImageResponse(<OgCardView card={card} />, {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        fonts: await loadFonts(),
      }).arrayBuffer(),
    );

    // PNG of a photographic card is several hundred KB, which WhatsApp can
    // refuse to preview; the same picture as a JPEG is a fraction of that.
    const sharp = await getSharp();
    const body = sharp ? await sharp(png).jpeg({ quality: 88, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer() : png;
    const contentType = sharp ? "image/jpeg" : "image/png";

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), body, type: contentType });

    return new Response(new Uint8Array(body), { headers: { "Content-Type": contentType, "Cache-Control": CACHE_CONTROL } });
  } catch (err) {
    // A share link must still show something: send the scraper to the standing hero image.
    console.error("[og] could not draw card:", JSON.stringify(spec), err instanceof Error ? err.message : err);
    return Response.redirect(new URL(FALLBACK_IMAGE, request.url), 302);
  }
}
