import { NextResponse } from "next/server";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateCoupon } from "@/lib/coupons";

/**
 * Preview what a code does to a price, for the checkout field.
 *
 * Display only — create-session re-validates and re-prices server-side, so a
 * forged response here buys nothing. Rate-limited because this endpoint would
 * otherwise let someone guess codes.
 */
export async function POST(req: Request) {
  const { success } = await checkApiRateLimit(getClientIdentifier(req));
  if (!success) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  let body: { code?: unknown; robotSlug?: unknown; tier?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const code = String(body.code ?? "").trim();
  const robotSlug = String(body.robotSlug ?? "").trim().toLowerCase();
  const tier = String(body.tier ?? "").trim();
  const email = body.email ? String(body.email).trim().toLowerCase() : null;

  if (!code || !robotSlug || !tier) {
    return NextResponse.json({ error: "Missing code, robot or plan." }, { status: 400 });
  }

  const result = await validateCoupon({ code, robotSlug, tier, email });
  if (!result.ok) {
    return NextResponse.json({ valid: false, reason: result.reason }, { status: 200 });
  }

  return NextResponse.json({
    valid: true,
    code: result.code,
    label: result.label,
    priceBefore: result.priceBefore,
    priceAfter: result.priceAfter,
    free: result.free,
  });
}
