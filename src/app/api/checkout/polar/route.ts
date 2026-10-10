import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";
import { REF_COOKIE } from "@/lib/affiliate";
import { priceCheckout, provisionFreeCouponCheckout } from "@/lib/checkout-pricing";
import { polar, polarCheckoutRef } from "@/lib/polar";
import { buildLocalizedPath } from "@/lib/seo";
import { TIER_METADATA, UnknownTierError } from "@/lib/pricing-tiers";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { UnknownRobotError, UnknownRobotPriceError } from "@/lib/robot-pricing";
import { validateEmail } from "@/lib/validation";
import type { TierId } from "@/config/pricing";

type Locale = (typeof routing.locales)[number];

function isPriceError(err: unknown) {
  return (
    err instanceof UnknownTierError ||
    err instanceof UnknownRobotError ||
    err instanceof UnknownRobotPriceError
  );
}

function resolveLocale(value: string | null): Locale {
  return value && routing.locales.includes(value as Locale) ? (value as Locale) : routing.defaultLocale;
}

// The Polar product for a (robot, tier): the one whose metadata says so.
async function findPolarProduct(robot: string, tier: string) {
  const match = await polar().products.list({ metadata: { robot, tier }, is_archived: false, limit: 1 });
  return match.items[0]?.id ?? null;
}

function thankYouUrl(locale: Locale) {
  const base = (process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz").replace(/\/$/, "");
  // Polar substitutes {CHECKOUT_ID}; the webhook stores the same ref. The
  // braces must survive URL-encoding for that, hence the manual query string.
  const path = buildLocalizedPath(locale, "/checkout/thank-you");
  return `${base}${path}?orderRef=${polarCheckoutRef("{CHECKOUT_ID}")}&from=polar`;
}

type CreateBody = {
  email?: string;
  tier?: TierId;
  robotSlug?: string;
  couponCode?: string;
  locale?: string;
};

/**
 * POST /api/checkout/polar { email, tier, robotSlug, couponCode? }
 * → { checkoutUrl, orderRef, amount, currency } for the hosted card checkout,
 * or { freeCheckout: true } when a coupon covers the whole price. Same shape
 * as /api/paygate/create-session so the checkout page treats both alike.
 *
 * The price is resolved server-side (list price, referral discount, coupon —
 * whichever is cheaper) and sent to Polar as an ad-hoc price on the product
 * mapped to robot + tier, so the DB stays authoritative and Polar's own
 * discount codes are disabled. robot, tier, the affiliate ref and the coupon
 * ride along as checkout metadata; order.paid provisions from them. The
 * success URL is the thank-you page, which polls /api/paygate/order-status
 * with the same POLAR-<checkout id> reference the webhook stores.
 */
export async function POST(req: Request) {
  const { success } = await checkApiRateLimit(getClientIdentifier(req));
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const tier = (body.tier || "1-month") as TierId;
  const email = (body.email || "").trim().toLowerCase();
  const robotSlug = (body.robotSlug || "").trim().toLowerCase();

  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return NextResponse.json({ error: emailValidation.error }, { status: 400 });
  }
  if (!robotSlug) {
    return NextResponse.json({ error: "Missing robotSlug." }, { status: 400 });
  }
  if (tier === "free-trial") {
    return NextResponse.json({ error: "Free trial does not require checkout." }, { status: 400 });
  }

  const refCode = (await cookies()).get(REF_COOKIE)?.value ?? null;

  try {
    const priced = await priceCheckout({ email, robotSlug, tier, couponCode: body.couponCode, refCode });
    if (!priced.ok) {
      return NextResponse.json({ error: priced.error }, { status: 400 });
    }
    const { chargeable, listPrice, discountPercent, coupon, couponWon } = priced.priced;

    if (chargeable <= 0) {
      if (!coupon) {
        return NextResponse.json({ error: "This plan requires payment." }, { status: 400 });
      }
      return NextResponse.json(
        await provisionFreeCouponCheckout({ email, tier, robotSlug, currency: "USD", refCode, coupon }),
      );
    }

    const productId = await findPolarProduct(robotSlug, tier);
    if (!productId) {
      return NextResponse.json(
        { error: "Card checkout is not available for this plan yet — pay with crypto instead." },
        { status: 404 },
      );
    }

    const checkout = await polar().checkouts.create({
      products: [productId],
      prices: {
        [productId]: [
          { amount_type: "fixed", price_amount: Math.round(chargeable * 100), price_currency: "usd" },
        ],
      },
      customer_email: email,
      allow_discount_codes: false,
      metadata: {
        robot: robotSlug,
        tier,
        ...(refCode ? { ref: refCode } : {}),
        ...(couponWon && coupon ? { coupon: coupon.code } : {}),
      },
      success_url: thankYouUrl(resolveLocale(body.locale ?? null)),
    });

    return NextResponse.json({
      checkoutUrl: checkout.url,
      orderRef: polarCheckoutRef(checkout.id),
      currency: "USD",
      amount: chargeable.toFixed(2),
      listPrice: listPrice.toFixed(2),
      discountPercent,
      couponCode: couponWon && coupon ? coupon.code : null,
      couponLabel: couponWon && coupon ? coupon.label : null,
    });
  } catch (error) {
    if (isPriceError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    console.error("[Polar] checkout create failed:", error);
    return NextResponse.json({ error: "Unable to start card checkout." }, { status: 502 });
  }
}

/**
 * GET /api/checkout/polar?robot=<slug>&tier=<tier slug>[&products=<id>][&email=][&locale=]
 * → 302 to Polar's hosted checkout at the product's catalog price. For links
 * from emails or landing pages; the checkout page uses POST above.
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

  try {
    let products = query.getAll("products").filter(Boolean);
    if (products.length === 0) {
      const productId = await findPolarProduct(robot, tier);
      if (!productId) {
        return NextResponse.json(
          { error: `No Polar product is mapped to ${robot}/${tier}` },
          { status: 404 },
        );
      }
      products = [productId];
    }

    const refCode = (await cookies()).get(REF_COOKIE)?.value;
    const checkout = await polar().checkouts.create({
      products,
      customer_email: email || undefined,
      metadata: { robot, tier, ...(refCode ? { ref: refCode } : {}) },
      success_url: thankYouUrl(resolveLocale(query.get("locale"))),
    });
    return NextResponse.redirect(checkout.url, 302);
  } catch (error) {
    console.error("[Polar] checkout create failed:", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }
}
