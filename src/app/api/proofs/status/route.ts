import { NextResponse } from "next/server";

import { loadPortalContext, portalSnapshot } from "@/lib/proof-portal";
import { promoEligibilityForRequest } from "@/lib/promo-eligibility";
import { checkProofActionRateLimit, getClientIdentifier } from "@/lib/rate-limit";

/**
 * GET /api/proofs/status?token=…&locale=…
 * What the person has sent and what is next; includes their reward code once
 * a share is approved. Only ever their own data (the token is the identity).
 */
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const { success } = await checkProofActionRateLimit(getClientIdentifier(req));
  if (!success) return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers });

  const url = new URL(req.url);
  const ctx = await loadPortalContext(url.searchParams.get("token"));
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "This link is not valid any more." }, { status: 401, headers });
  }

  const eligibility = await promoEligibilityForRequest(req, url.searchParams.get("locale"));
  const snapshot = await portalSnapshot(ctx, eligibility.eligible);
  return NextResponse.json({ ok: true, snapshot }, { headers });
}
