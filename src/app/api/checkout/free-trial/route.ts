import { NextResponse } from "next/server";
import { provisionSubscription } from "@/lib/subscriptions";
import { UnknownTierError } from "@/lib/pricing-tiers";
import { resolveRobotPrice, UnknownRobotError, UnknownRobotPriceError } from "@/lib/robot-pricing";
import { checkFreeTrialRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { REF_COOKIE } from "@/lib/affiliate";
import { validateEmail } from "@/lib/validation";

export async function POST(req: Request) {
  // Rate limiting - 2 trials per IP per day
  const identifier = getClientIdentifier(req);
  const { success } = await checkFreeTrialRateLimit(identifier);
  
  if (!success) {
    return NextResponse.json(
      { error: "Too many free trial requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { email, robotSlug: robotSlugRaw } = body;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    const robotSlug = String(robotSlugRaw || "").trim().toLowerCase();
    if (!robotSlug) {
      return NextResponse.json({ error: "Missing robotSlug." }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[Free Trial] Processing trial for: ${normalizedEmail}`);

    // Fail-closed resolve + assert the free-trial price is 0 (Pitfall 6 — a free
    // trial must never be claimable for an inactive/unpriced/misconfigured robot).
    let resolved;
    try {
      resolved = await resolveRobotPrice(robotSlug, "free-trial");
    } catch (err) {
      if (
        err instanceof UnknownTierError ||
        err instanceof UnknownRobotError ||
        err instanceof UnknownRobotPriceError
      ) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
    if (resolved.amount !== 0) {
      return NextResponse.json(
        { error: "Free trial is misconfigured for this robot." },
        { status: 400 },
      );
    }

    let result;
    try {
      // A trial earns nothing, but it still binds the customer to whoever sent
      // them: when they upgrade weeks later, the commission is already owed.
      const refCode = (await cookies()).get(REF_COOKIE)?.value ?? null;
      result = await provisionSubscription(
        normalizedEmail,
        "free-trial",
        robotSlug,
        undefined,
        undefined,
        undefined,
        refCode,
      );
    } catch (err) {
      if (err instanceof UnknownTierError || err instanceof UnknownRobotError || err instanceof UnknownRobotPriceError) {
        // Defensive: resolveRobotPrice above already validated this, but matches
        // the webhook + create-session pattern — no silent 500 on tier/robot drift.
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    if (result.duplicated && result.alreadyTrialed) {
      return NextResponse.json(
        { error: "You already used your free trial for this robot." },
        { status: 409 },
      );
    }

    if (!result.emailSuccess) {
      return NextResponse.json({
        error: "Your account was created, but we failed to send the welcome sign-in link. Please contact support@al-ai-fx.xyz for a secure sign-in link."
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Free trial activated successfully.",
      ...result
    }, { status: 201 });

  } catch (error) {
    console.error("Free trial error:", error);
    return NextResponse.json({ error: "Failed to process free trial." }, { status: 500 });
  }
}
