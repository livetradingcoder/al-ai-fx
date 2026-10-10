import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";
import { REF_COOKIE } from "@/lib/affiliate";
import { priceCheckout, provisionFreeCouponCheckout } from "@/lib/checkout-pricing";
import { buildCheckoutThankYouPath } from "@/lib/marketing";
import { createOxapayInvoice, oxapayKey, oxapayOrderRef, signCallbackParams } from "@/lib/oxapay";
import { TIER_METADATA, UnknownTierError } from "@/lib/pricing-tiers";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { UnknownRobotError, UnknownRobotPriceError } from "@/lib/robot-pricing";
import { validateEmail } from "@/lib/validation";
import type { TierId } from "@/config/pricing";

type Locale = (typeof routing.locales)[number];

type CreateBody = {
  email?: string;
  tier?: TierId;
  robotSlug?: string;
  couponCode?: string;
  locale?: string;
};

/**
 * POST /api/checkout/oxapay { email, tier, robotSlug, couponCode?, locale? }
 * → { checkoutUrl, orderRef, amount, currency } for OxaPay's hosted crypto
 * checkout, or { freeCheckout: true } when a coupon covers the whole price.
 * Same shape as the Polar and Paygate session routes.
 *
 * The price is resolved server-side (list price, referral discount or coupon,
 * whichever is cheaper). OxaPay only echoes order_id, amount and email back,
 * so robot, tier, email, amount and the affiliate/coupon codes go into the
 * callback URL, signed with the merchant key (see src/lib/oxapay.ts); the
 * webhook verifies that signature as well as OxaPay's own HMAC before
 * provisioning. The buyer returns to the thank-you page, which polls
 * /api/paygate/order-status with the same OXAPAY-<ref> the webhook stores.
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
  if (tier === "free-trial" || !(tier in TIER_METADATA)) {
    return NextResponse.json({ error: "This plan cannot be bought with crypto." }, { status: 400 });
  }

  const key = oxapayKey();
  if (!key) {
    return NextResponse.json(
      { error: "Crypto checkout is not available right now — pay by card instead." },
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

    const amount = chargeable.toFixed(2);
    const orderRef = crypto.randomUUID();
    const requestUrl = new URL(req.url);
    const base = (
      process.env.PAYGATE_CALLBACK_URL_BASE ||
      process.env.NEXTAUTH_URL ||
      `${requestUrl.protocol}//${requestUrl.host}`
    ).replace(/\/$/, "");

    const callbackUrl = new URL("/api/webhooks/oxapay", base);
    const params = { order_ref: orderRef, email, robot: robotSlug, tier, amount };
    for (const [k, v] of Object.entries(params)) callbackUrl.searchParams.set(k, v);
    if (refCode) callbackUrl.searchParams.set("ref", refCode);
    // Redeemed on the callback, once the coins actually arrive.
    if (couponWon && coupon) callbackUrl.searchParams.set("coupon", coupon.code);
    callbackUrl.searchParams.set("signature", signCallbackParams(key, params));

    const invoice = await createOxapayInvoice({
      amount: chargeable,
      email,
      orderRef,
      description: `${robotName} · ${tier} · al-ai-fx`,
      callbackUrl: callbackUrl.toString(),
      returnUrl: `${base}${buildCheckoutThankYouPath(locale, oxapayOrderRef(orderRef))}&from=oxapay`,
    });

    return NextResponse.json({
      checkoutUrl: invoice.paymentUrl,
      orderRef: oxapayOrderRef(orderRef),
      trackId: invoice.trackId,
      currency: "USD",
      amount,
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
    console.error("[OxaPay] invoice create failed:", error);
    return NextResponse.json({ error: "Unable to start crypto checkout." }, { status: 502 });
  }
}
