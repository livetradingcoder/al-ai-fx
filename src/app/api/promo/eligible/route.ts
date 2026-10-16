import { NextResponse } from "next/server";

import { getLiveGiveaway } from "@/lib/giveaway";
import { activeBanners } from "@/lib/promo-banner";
import { promoEligibilityForRequest } from "@/lib/promo-eligibility";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { SHARE_REWARD_PERCENT } from "@/lib/rewards";

/**
 * GET /api/promo/eligible?locale=en
 * Whether to show promotions at all (not offered in restricted languages, or in
 * countries on the block list), and what the top bar and the pop-up can show:
 * the live giveaway, the admin's promo-bar messages (with their public coupon
 * codes) and the size of the share-for-discount reward. The entry route checks
 * again - this only decides what appears.
 */
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const { success } = await checkApiRateLimit(getClientIdentifier(req));
  if (!success) return NextResponse.json({ eligible: false, giveaway: null, banners: [] }, { status: 429, headers });

  const locale = new URL(req.url).searchParams.get("locale");
  const eligibility = await promoEligibilityForRequest(req, locale);
  if (!eligibility.eligible) {
    return NextResponse.json({ eligible: false, giveaway: null, banners: [] }, { headers });
  }

  const giveaway = await getLiveGiveaway();
  // Messages are a bonus: if their table is not there yet the giveaway still works.
  const banners = await activeBanners().catch(() => []);
  return NextResponse.json(
    {
      eligible: true,
      rewardPercent: SHARE_REWARD_PERCENT,
      giveaway: giveaway
        ? { slug: giveaway.slug, title: giveaway.title, prize: giveaway.prize, endsAt: giveaway.endsAt.toISOString() }
        : null,
      banners,
    },
    { headers },
  );
}
