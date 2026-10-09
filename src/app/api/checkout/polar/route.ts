import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";
import { REF_COOKIE } from "@/lib/affiliate";
import { polar, polarCheckoutRef } from "@/lib/polar";
import { TIER_METADATA } from "@/lib/pricing-tiers";

type Locale = (typeof routing.locales)[number];

/**
 * GET /api/checkout/polar?robot=<slug>&tier=<tier slug>[&products=<id>][&email=][&locale=]
 * → 302 to Polar's hosted checkout. Lives under /api because /checkout is the
 * next-intl checkout page.
 *
 * The Polar product is the one whose metadata matches robot + tier, unless
 * `products` names it. robot, tier and the affiliate cookie ride along as
 * checkout metadata so order.paid knows what to provision. After payment Polar
 * sends the buyer to the thank-you page, which polls /api/paygate/order-status
 * with the same POLAR-<checkout id> reference the webhook stores.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams;
  const robot = (query.get("robot") ?? "").trim().toLowerCase();
  const tier = (query.get("tier") ?? "").trim().toLowerCase();
  if (!robot || !tier) {
    return NextResponse.json({ error: "Missing robot or tier in query params" }, { status: 400 });
  }
  if (!/^[a-z0-9-]{1,64}$/.test(robot)) {
    return NextResponse.json({ error: "Invalid robot" }, { status: 400 });
  }
  if (!(tier in TIER_METADATA)) {
    return NextResponse.json({ error: "Unknown tier" }, { status: 400 });
  }
  const email = (query.get("email") ?? "").trim().toLowerCase();
  if (email && (!email.includes("@") || email.length > 254)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const localeParam = query.get("locale") ?? routing.defaultLocale;
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale;

  try {
    let products = query.getAll("products").filter(Boolean);
    if (products.length === 0) {
      const match = await polar().products.list({
        metadata: { robot, tier },
        is_archived: false,
        limit: 1,
      });
      products = match.items.map((product) => product.id);
      if (products.length === 0) {
        return NextResponse.json(
          { error: `No Polar product is mapped to ${robot}/${tier}` },
          { status: 404 },
        );
      }
    }

    const refCode = (await cookies()).get(REF_COOKIE)?.value;
    const base = (process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz").replace(/\/$/, "");
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`; // localePrefix: as-needed
    const checkout = await polar().checkouts.create({
      products,
      customer_email: email || undefined,
      metadata: { robot, tier, ...(refCode ? { ref: refCode } : {}) },
      // Polar substitutes {CHECKOUT_ID}; the webhook stores the same ref.
      success_url: `${base}${prefix}/checkout/thank-you?orderRef=${polarCheckoutRef("{CHECKOUT_ID}")}`,
    });
    return NextResponse.redirect(checkout.url, 302);
  } catch (error) {
    console.error("[Polar] checkout create failed:", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }
}
