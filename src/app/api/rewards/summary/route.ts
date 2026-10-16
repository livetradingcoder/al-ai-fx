import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { checkProofActionRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { rewardsOfferForUser } from "@/lib/rewards-offer";

/**
 * GET /api/rewards/summary?locale=en
 * The signed-in visitor's reward progress for the pop-up, or `{ offer: null }`
 * when there is nothing to show (not signed in, no trial, already a customer,
 * or promotions are not offered where they are).
 */
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ offer: null }, { headers });

  const { success } = await checkProofActionRateLimit(`${session.user.id}:${getClientIdentifier(req)}`);
  if (!success) return NextResponse.json({ offer: null }, { status: 429, headers });

  try {
    const offer = await rewardsOfferForUser(session.user.id, req, new URL(req.url).searchParams.get("locale"));
    return NextResponse.json({ offer }, { headers });
  } catch (err) {
    console.error("[rewards] summary failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ offer: null }, { status: 500, headers });
  }
}
