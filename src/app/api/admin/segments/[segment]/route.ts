import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { buildSegmentCsv, isSegmentKey } from "@/lib/segments";

/**
 * GET /api/admin/segments/[segment]?giveaway=<id>
 * A CSV of one email list for the email tool. Admin only: the file holds
 * addresses and one-click sign-in links, so it is never cached or indexed.
 */
export async function GET(req: Request, { params }: { params: Promise<{ segment: string }> }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const { segment } = await params;
  if (!isSegmentKey(segment)) return new Response("Unknown list", { status: 404 });

  try {
    const giveawayId = new URL(req.url).searchParams.get("giveaway");
    const { filename, csv } = await buildSegmentCsv(segment, { giveawayId });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    console.error("[segments] export failed:", err instanceof Error ? err.message : err);
    return new Response("Could not build that list", { status: 500 });
  }
}
