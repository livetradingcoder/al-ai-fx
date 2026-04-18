import { NextResponse } from "next/server";
import { provisionSubscription } from "@/lib/subscriptions";
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

    const result = await provisionSubscription(normalizedEmail, "free-trial");

    if (!result.emailSuccess) {
      return NextResponse.json({
        error: "Your account was created, but we failed to send the welcome email with your credentials. Please contact support@al-ai-fx.xyz immediately to get your password."
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
