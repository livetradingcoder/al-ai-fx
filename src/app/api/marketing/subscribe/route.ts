import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";

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
    // Whitelist sources — never store arbitrary client strings.
    const source = body.source === "algotradingschool" ? "algotradingschool" : "unknown";

    try {
      await prisma.emailSubscriber.create({ data: { email, source } });
    } catch (err) {
      // Duplicate email = already subscribed. Same success response on
      // purpose: don't let the endpoint act as an email-existence oracle.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
        throw err;
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
