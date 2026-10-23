import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";
import { REF_COOKIE } from "@/lib/affiliate";
import { priceCheckout, provisionFreeCouponCheckout } from "@/lib/checkout-pricing";
import { buildCheckoutThankYouPath } from "@/lib/marketing";
import { TIER_METADATA, trialDays, UnknownTierError } from "@/lib/pricing-tiers";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { inBackground, rememberCheckoutAttribution, sendAddPaymentInfoEvent } from "@/lib/meta-events";
import { readMetaRequestContext } from "@/lib/meta-request";
import { UnknownRobotError, UnknownRobotPriceError } from "@/lib/robot-pricing";
import { validateEmail } from "@/lib/validation";
import { WHOP_MIN_AMOUNT, createWhopCheckout, whopKey, whopOrderRef, whopProductId } from "@/lib/whop";
import type { TierId } from "@/config/pricing";
import { isProviderAvailable, providerOffMessage } from "@/lib/payment-settings";

type Locale = (typeof routing.locales)[number];

type CreateBody = {
  email?: string;
  tier?: TierId;
  robotSlug?: string;
  couponCode?: string;
  locale?: string;
};

const TIER_LABELS: Partial<Record<TierId, string>> = {
  "10-days": "10 Days",
  "1-month": "1 Month",
  "6-months": "6 Months",
  "1-year": "1 Year",
  lifetime: "Lifetime",
  "lifetime-source": "Lifetime + Source",
};

/**
 * POST /api/checkout/whop { email, tier, robotSlug, couponCode?, locale? }
 * → { checkoutUrl, orderRef, amount, currency } for Whop's hosted checkout, or
 * { freeCheckout: true } when a coupon covers the whole price. Same shape as the
 * Polar and OxaPay routes.
 *
 * The price is resolved server-side (list price, referral discount or coupon,
 * whichever is cheaper) and sent to Whop as an inline one-time plan, so the DB
 * stays the price authority. robot, tier, email and the affiliate/coupon codes
 * ride along as checkout metadata, which Whop copies onto the payment; the
 * webhook provisions from them. The buyer returns to the thank-you page, which
 * polls /api/paygate/order-status with the same WHOP-<ref> the webhook stores.
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
  if (!(tier in TIER_METADATA)) {
    return NextResponse.json({ error: "This plan cannot be bought through Whop." }, { status: 400 });
  }
  if (!whopKey() || !whopProductId(robotSlug)) {
    return NextResponse.json(
      { error: "Whop checkout is not available right now — pay by card or crypto instead." },
      { status: 503 },
    );
  }

  const refCode = (await cookies()).get(REF_COOKIE)?.value ?? null;
  const locale: Locale = routing.locales.includes(body.locale as Locale)
    ? (body.locale as Locale)
    : routing.defaultLocale;

  try {
    const priced = await priceCheckout({ email, robotSlug, tier, couponCode: body.couponCode, refCode });
    if (!priced.ok) {
      return NextResponse.json({ error: priced.error }, { status: 400 });
    }
    const { chargeable, listPrice, discountPercent, coupon, couponWon, robotName } = priced.priced;

    if (chargeable <= 0) {
      if (!coupon) {
        return NextResponse.json({ error: "This plan requires payment." }, { status: 400 });
      }
      return NextResponse.json(
        await provisionFreeCouponCheckout({ email, tier, robotSlug, currency: "USD", refCode, coupon }),
      );
    }

    if (!(await isProviderAvailable("whop"))) {
      return NextResponse.json({ error: providerOffMessage("whop") }, { status: 503 });
    }
    if (chargeable < WHOP_MIN_AMOUNT) {
      return NextResponse.json(
        { error: "This amount is too small for Whop — pay by card or crypto instead." },
        { status: 400 },
      );
    }

    const orderRef = crypto.randomUUID();
    const requestUrl = new URL(req.url);
    const base = (process.env.NEXTAUTH_URL || `${requestUrl.protocol}//${requestUrl.host}`).replace(/\/$/, "");
    // The trial's length depends on the robot's trial price, not on the tier alone.
    const days = tier === "free-trial" ? trialDays(listPrice) : TIER_METADATA[tier].durationDays;

    const checkout = await createWhopCheckout({
      robotSlug,
      robotName,
      tier,
      tierLabel: TIER_LABELS[tier] ?? tier,
      amountUsd: chargeable,
      expirationDays: typeof days === "number" ? days : null,
      orderRef,
      email,
      refCode,
      couponCode: couponWon && coupon ? coupon.code : null,
      // Whop appends ?payment=pay_…&status=succeeded|failed|canceled to this.
      redirectUrl: `${base}${buildCheckoutThankYouPath(locale, whopOrderRef(orderRef))}&from=whop`,
    });

    // Meta: remember the browser for the webhook, report the payment-info step.
    const fullRef = whopOrderRef(orderRef);
    const metaCtx = readMetaRequestContext(req);
    inBackground(async () => {
      await rememberCheckoutAttribution(fullRef, metaCtx);
      await sendAddPaymentInfoEvent({
        ctx: metaCtx, orderRef: fullRef, email, amount: chargeable, currency: "USD", robotSlug, robotName, tierSlug: tier,
      });
    });

    return NextResponse.json({
      checkoutUrl: checkout.purchaseUrl,
      orderRef: fullRef,
      currency: "USD",
      amount: chargeable.toFixed(2),
      listPrice: listPrice.toFixed(2),
      discountPercent,
      couponCode: couponWon && coupon ? coupon.code : null,
      couponLabel: couponWon && coupon ? coupon.label : null,
    });
  } catch (error) {
    if (
      error instanceof UnknownTierError ||
      error instanceof UnknownRobotError ||
      error instanceof UnknownRobotPriceError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Whop] checkout create failed:", error);
    return NextResponse.json({ error: "Unable to start Whop checkout." }, { status: 502 });
  }
}
