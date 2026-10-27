import { NextResponse } from "next/server";
import { markAttemptOutcome } from "@/lib/payment-attempts";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";

// <PROVIDER>-<uuid>, the reference the checkout route handed back and the
// provider put on the return URL. Anything else is not ours to touch.
const ORDER_REF = /^(WHOP|OXAPAY|POLAR)-[A-Za-z0-9-]{8,64}$/;

const OUTCOMES = { failed: "FAILED", canceled: "CANCELED" } as const;

/**
 * POST /api/checkout/attempt-outcome { orderRef, status }
 *
 * The thank-you page calls this when the provider sent the buyer back with
 * status=failed or canceled, so the admin's payment-attempts list says what
 * happened instead of leaving the attempt open. It can only close an attempt
 * that is still open: a paid one never moves, and nothing here reads or
 * returns any data.
 */
export async function POST(req: Request) {
  const { success } = await checkApiRateLimit(getClientIdentifier(req));
  if (!success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: { orderRef?: string; status?: string };
  try {
    body = (await req.json()) as { orderRef?: string; status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const orderRef = (body.orderRef ?? "").trim();
  const outcome = OUTCOMES[(body.status ?? "") as keyof typeof OUTCOMES];
  if (!ORDER_REF.test(orderRef) || !outcome) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await markAttemptOutcome(orderRef, outcome, `The provider returned the buyer as ${body.status}`);
  return NextResponse.json({ ok: true });
}
