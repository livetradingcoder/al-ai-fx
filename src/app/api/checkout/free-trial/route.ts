import { NextResponse } from "next/server";
import { provisionSubscription } from "@/lib/subscriptions";
import { UnknownTierError } from "@/lib/pricing-tiers";
import { checkFreeTrialRateLimit, getClientIdentifier } from "@/lib/rate-limit";
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
    const { email } = body;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[Free Trial] Processing trial for: ${normalizedEmail}`);

    let result;
    try {
      result = await provisionSubscription(normalizedEmail, "free-trial");
    } catch (err) {
      if (err instanceof UnknownTierError) {
        // Defensive: should never fire for hardcoded "free-trial", but matches
        // the webhook + create-session pattern (Plan 02-02) — no silent 500 on tier drift.
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
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
