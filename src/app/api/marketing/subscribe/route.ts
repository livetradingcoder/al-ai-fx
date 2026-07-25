import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";
import { sendSubscriberWelcomeEmail } from "@/lib/mail";
import { routing } from "@/i18n/routing";

const KNOWN_LOCALES: readonly string[] = routing.locales;

// Public, credential-less subscribe endpoint consumed cross-origin by the
// education site (algotradingschool.com). CORS is wide open on purpose:
// no cookies/auth are involved and the endpoint is rate-limited per IP.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { success } = await checkApiRateLimit(identifier);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: CORS_HEADERS },
    );
  }

  try {
    const body = await req.json();
    const emailValidation = validateEmail(body.email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: emailValidation.error },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const email = String(body.email).trim().toLowerCase();
    // Whitelist sources — never store arbitrary client strings. The school
    // sends placement-tagged variants (algotradingschool:hero, :lesson, …).
    const source =
      typeof body.source === "string" &&
      /^algotradingschool(:[a-z0-9-]{1,32})?$/.test(body.source)
        ? body.source
        : "unknown";

    // Never trust an arbitrary client string here — locale gates whether a
    // subscriber is eligible for locale-restricted sequences (e.g. the
    // robot pitch, en/es/de only), so an unvalidated value would be a
    // compliance hole, not just cosmetic. Missing/unknown locale stores as
    // null (never guessed) — null must be treated as "not eligible".
    const locale =
      typeof body.locale === "string" && KNOWN_LOCALES.includes(body.locale)
        ? body.locale
        : null;

    let isNewSubscriber = true;
    try {
      await prisma.emailSubscriber.create({ data: { email, source, locale } });
    } catch (err) {
      // Duplicate email = already subscribed. Same success response on
      // purpose: don't let the endpoint act as an email-existence oracle.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
        throw err;
      }
      isNewSubscriber = false;
      // A returning subscriber re-submitting the form is treated as an
      // explicit resubscribe: clears any prior unsubscribe and refreshes
      // locale/source to the current signup context. Without this, one
      // unsubscribe would permanently suppress the address with no way
      // back in short of a manual DB fix.
      await prisma.emailSubscriber.update({
        where: { email },
        data: { unsubscribedAt: null, locale, source },
      });
    }

    // Best-effort welcome email for first-time subscribers only. No-op-safe
    // when Mailgun env is unset; must never fail the subscribe request.
    if (isNewSubscriber) {
      try {
        await sendSubscriberWelcomeEmail(email);
      } catch (err) {
        console.error("[Subscribe] welcome email failed (non-fatal):", err);
      }
    }

    return NextResponse.json({ subscribed: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("[Subscribe] error:", error);
    return NextResponse.json(
      { error: "Unable to subscribe right now." },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
