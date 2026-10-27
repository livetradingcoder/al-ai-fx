import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { routing } from "@/i18n/routing";
import { buildCheckoutThankYouPath } from "@/lib/marketing";
import { ACCOUNT_CHANGE_TIER, quoteChange } from "@/lib/mt5-changes";
import { isProviderAvailable, providerOffMessage } from "@/lib/payment-settings";
import { recordAttemptError, recordAttemptStarted } from "@/lib/payment-attempts";
import { createOxapayInvoice, oxapayKey, oxapayOrderRef, signCallbackParams } from "@/lib/oxapay";
import { prisma } from "@/lib/prisma";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { WHOP_MIN_AMOUNT, createWhopCheckout, whopKey, whopOrderRef, whopProductId } from "@/lib/whop";

type Locale = (typeof routing.locales)[number];

type Body = { subscriptionId?: string; method?: "card" | "crypto"; locale?: string };

/**
 * POST /api/checkout/account-change { subscriptionId, method: "card" | "crypto", locale? }
 * → { checkoutUrl, orderRef, amount, currency }
 *
 * The fee for moving a licence to another MT5 account once the one free change
 * is used: half the plan's price. Signed-in owners only; the amount is worked
 * out here, never taken from the request. Paying records an Order and a
 * Mt5ChangeCredit (from the payment webhook, or from the thank-you page's own
 * confirmation), and the next change on that licence spends the credit.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const { success } = await checkApiRateLimit(getClientIdentifier(req));
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const method = body.method === "crypto" ? "crypto" : body.method === "card" ? "card" : null;
  if (!body.subscriptionId || !method) {
    return NextResponse.json({ error: "Missing subscriptionId or method." }, { status: 400 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { id: body.subscriptionId },
    include: { robot: { select: { slug: true, name: true } }, user: { select: { email: true } } },
  });
  if (!sub || sub.userId !== session.user.id) {
    return NextResponse.json({ error: "Licence not found." }, { status: 404 });
  }
  if (!sub.mt5AccountNumber) {
    return NextResponse.json({ error: "Link an MT5 account first: the first link is free." }, { status: 409 });
  }

  const quote = await quoteChange(session.user.id, sub);
  if (quote.allowance !== "payment") {
    return NextResponse.json(
      { error: "You can change this account without paying.", code: "change-available" },
      { status: 409 },
    );
  }
  if (quote.fee === null) {
    return NextResponse.json(
      { error: "We could not price this change. Please contact support." },
      { status: 422 },
    );
  }
  const fee = quote.fee;

  const email = sub.user.email.toLowerCase();
  const attempt = {
    provider: method === "card" ? ("whop" as const) : ("oxapay" as const),
    email,
    robotSlug: sub.robot.slug,
    tier: ACCOUNT_CHANGE_TIER,
    amount: fee,
  };
  const locale: Locale = routing.locales.includes(body.locale as Locale)
    ? (body.locale as Locale)
    : routing.defaultLocale;
  const orderRef = crypto.randomUUID();
  const requestUrl = new URL(req.url);
  const base = (process.env.NEXTAUTH_URL || `${requestUrl.protocol}//${requestUrl.host}`).replace(/\/$/, "");

  try {
    if (method === "card") {
      if (!whopKey() || !whopProductId(sub.robot.slug)) {
        await recordAttemptError({ ...attempt, detail: "Whop is not set up for this robot" });
        return NextResponse.json({ error: "Card checkout is not available right now — pay with crypto instead." }, { status: 503 });
      }
      if (!(await isProviderAvailable("whop"))) {
        await recordAttemptError({ ...attempt, detail: "Whop is switched off in admin" });
        return NextResponse.json({ error: providerOffMessage("whop") }, { status: 503 });
      }
      if (fee < WHOP_MIN_AMOUNT) {
        await recordAttemptError({ ...attempt, detail: "Below Whop's $1 minimum" });
        return NextResponse.json({ error: "This amount is too small for card — pay with crypto instead." }, { status: 400 });
      }
      const checkout = await createWhopCheckout({
        robotSlug: sub.robot.slug,
        robotName: sub.robot.name,
        tier: ACCOUNT_CHANGE_TIER,
        tierLabel: "MT5 change",
        amountUsd: fee,
        expirationDays: null,
        orderRef,
        email,
        refCode: null,
        couponCode: null,
        subscriptionId: sub.id,
        redirectUrl: `${base}${buildCheckoutThankYouPath(locale, whopOrderRef(orderRef))}&from=whop`,
      });
      const ref = whopOrderRef(orderRef);
      await recordAttemptStarted({ ...attempt, orderRef: ref });
      return NextResponse.json({ checkoutUrl: checkout.purchaseUrl, orderRef: ref, currency: "USD", amount: fee.toFixed(2) });
    }

    const key = oxapayKey();
    if (!key) {
      await recordAttemptError({ ...attempt, detail: "Crypto checkout is not configured" });
      return NextResponse.json({ error: "Crypto checkout is not available right now — pay by card instead." }, { status: 503 });
    }
    if (!(await isProviderAvailable("oxapay"))) {
      await recordAttemptError({ ...attempt, detail: "Crypto is switched off in admin" });
      return NextResponse.json({ error: providerOffMessage("oxapay") }, { status: 503 });
    }
    const callbackBase = (process.env.PAYGATE_CALLBACK_URL_BASE || base).replace(/\/$/, "");
    const callbackUrl = new URL("/api/webhooks/oxapay", callbackBase);
    const params = {
      order_ref: orderRef,
      email,
      robot: sub.robot.slug,
      tier: ACCOUNT_CHANGE_TIER,
      amount: fee.toFixed(2),
      sub: sub.id,
    };
    for (const [k, v] of Object.entries(params)) callbackUrl.searchParams.set(k, v);
    callbackUrl.searchParams.set("signature", signCallbackParams(key, params));
    const invoice = await createOxapayInvoice({
      amount: fee,
      email,
      orderRef,
      description: `${sub.robot.name} · MT5 change · al-ai-fx`,
      callbackUrl: callbackUrl.toString(),
      returnUrl: `${base}${buildCheckoutThankYouPath(locale, oxapayOrderRef(orderRef))}&from=oxapay`,
    });
    const ref = oxapayOrderRef(orderRef);
    await recordAttemptStarted({ ...attempt, orderRef: ref });
    return NextResponse.json({ checkoutUrl: invoice.paymentUrl, orderRef: ref, currency: "USD", amount: fee.toFixed(2) });
  } catch (error) {
    await recordAttemptError({ ...attempt, detail: error instanceof Error ? error.message : "Checkout failed" });
    console.error("[account-change] checkout create failed:", error);
    return NextResponse.json({ error: "Unable to start checkout." }, { status: 502 });
  }
}
