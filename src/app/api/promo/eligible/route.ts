import { NextResponse } from "next/server";

import { getLiveGiveaway } from "@/lib/giveaway";
import { promoEligibilityForRequest } from "@/lib/promo-eligibility";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";

/**
 * GET /api/promo/eligible?locale=en
 * Whether to show the giveaway at all: promotions are not offered in restricted
 * countries or languages. Also says which giveaway is live. The entry route
 * checks again - this only decides whether the pop-up arms.
 */
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const { success } = await checkApiRateLimit(getClientIdentifier(req));
  if (!success) return NextResponse.json({ eligible: false, giveaway: null }, { status: 429, headers });

  const locale = new URL(req.url).searchParams.get("locale");
  const eligibility = await promoEligibilityForRequest(req, locale);
  if (!eligibility.eligible) return NextResponse.json({ eligible: false, giveaway: null }, { headers });

  const giveaway = await getLiveGiveaway();
  return NextResponse.json(
    {
      eligible: true,
      giveaway: giveaway
        ? { slug: giveaway.slug, title: giveaway.title, prize: giveaway.prize, endsAt: giveaway.endsAt.toISOString() }
        : null,
    },
    { headers },
  );
}
