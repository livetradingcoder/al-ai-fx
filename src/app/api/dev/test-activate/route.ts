import { NextResponse } from "next/server";
import { provisionSubscription } from "@/lib/subscriptions";
import { UnknownTierError } from "@/lib/pricing-tiers";
import { UnknownRobotError, UnknownRobotPriceError } from "@/lib/robot-pricing";

/**
 * PAYMENT BYPASS — test activation without Paygate.
 *
 * Provisions a subscription through the SAME `provisionSubscription` path a
 * real callback uses (same tier resolution, same expiry math, same purchase
 * email), so a test exercises the production code, not a parallel one.
 *
 * THREE GATES, all required — this endpoint runs on the live site:
 *   1. TEST_ACTIVATION_SECRET must be set in the environment (absent = 404,
 *      the endpoint does not exist as far as the internet is concerned).
 *   2. Caller must send that secret as `Authorization: Bearer <secret>`.
 *   3. Orders created here are tagged `TEST-<timestamp>` in Order.paygateId so
 *      test grants are always distinguishable from paid ones in the DB.
 *
 * Unset TEST_ACTIVATION_SECRET in Coolify when testing is finished.
 *
 * POST /api/dev/test-activate
 *   { "email": "...", "tier": "1-month", "robot": "goldbot" }
 */
export async function POST(req: Request) {
  const secret = process.env.TEST_ACTIVATION_SECRET;

  // Gate 1 — endpoint is invisible unless explicitly enabled.
  if (!secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Gate 2 — bearer must match.
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    console.warn("[TestActivate] REJECTED: bad or missing bearer token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: unknown; tier?: unknown; robot?: unknown; ref?: unknown; amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const tier = String(body.tier ?? "1-month").trim();
  const robot = String(body.robot ?? "goldbot").trim().toLowerCase();
  // Optional referral code, so an affiliate attribution can be exercised
  // end-to-end without a real card. Mirrors what the Paygate callback carries.
  const ref = body.ref ? String(body.ref).trim().toUpperCase() : null;
  const amount = body.amount === undefined ? 0 : Number(body.amount);

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Gate 3 — unmistakable marker in the payments table.
  const paygateId = `TEST-${Date.now()}`;

  console.warn(
    `[TestActivate] ⚠️ PAYMENT BYPASS USED — email=${email} tier=${tier} robot=${robot} ref=${paygateId}`,
  );

  try {
    const result = await provisionSubscription(email, tier, robot, paygateId, amount, "USD", ref);
    console.warn(`[TestActivate] result: ${JSON.stringify(result)}`);
    return NextResponse.json({ ok: true, testOrder: paygateId, ...result });
  } catch (err) {
    if (
      err instanceof UnknownTierError ||
      err instanceof UnknownRobotError ||
      err instanceof UnknownRobotPriceError
    ) {
      console.error(`[TestActivate] rejected: ${err.message}`);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[TestActivate] failed:", err);
    return NextResponse.json({ error: "Activation failed" }, { status: 500 });
  }
}
