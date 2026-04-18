import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sendResetPasswordEmail } from "@/lib/mail";
import { checkForgotPasswordRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";

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

    // Always perform the same operations to prevent timing attacks
    const tempPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    if (user && !user.isDeleted && !user.isBlocked) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          shouldResetPassword: true,
        },
      });

      // Send the email
      try {
        await sendResetPasswordEmail(user.email, tempPassword);
      } catch (error) {
        console.error("[Forgot Password API] Failed to send email:", error);
        // Don't reveal email sending failure to user
      }
    }

    // Always return the same response regardless of whether user exists
    return NextResponse.json({ 
      success: true, 
      message: "If an account exists with that email, a password reset link has been sent." 
    });
  } catch (error) {
    console.error("[Forgot Password API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
