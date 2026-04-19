import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendResetPasswordEmail } from "@/lib/mail";
import { checkForgotPasswordRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";
import { buildMagicLinkUrl, createMagicLinkToken } from "@/lib/magic-links";

export async function POST(req: Request) {
  // Rate limiting
  const identifier = getClientIdentifier(req);
  const { success } = await checkForgotPasswordRateLimit(identifier);
  
  if (!success) {
    return NextResponse.json(
      { error: "Too many password reset attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { email } = await req.json();

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user && !user.isDeleted && !user.isBlocked) {
      const secret = process.env.NEXTAUTH_SECRET;
      const baseUrl = process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz";

      if (!secret) {
        throw new Error("NEXTAUTH_SECRET is required to send magic links.");
      }

      const token = createMagicLinkToken(
        {
          email: user.email,
          purpose: "reset",
          userId: user.id,
        },
        secret,
      );
      const magicLinkUrl = buildMagicLinkUrl({
        baseUrl,
        locale: "en",
        token,
      });

      // Send the email
      try {
        await sendResetPasswordEmail(user.email, magicLinkUrl);
      } catch (error) {
        console.error("[Forgot Password API] Failed to send email:", error);
        // Don't reveal email sending failure to user
      }
    }

    // Always return the same response regardless of whether user exists
    return NextResponse.json({ 
      success: true, 
      message: "If an account exists with that email, a secure sign-in link has been sent." 
    });
  } catch (error) {
    console.error("[Forgot Password API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
