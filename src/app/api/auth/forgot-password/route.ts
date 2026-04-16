import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sendResetPasswordEmail } from "@/lib/mail";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // For security, don't reveal if user exists. Just say "If an account exists..."
    if (!user) {
      return NextResponse.json({ success: true, message: "If an account exists with that email, a reset link has been sent." });
    }

    // Generate new random password
    const tempPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        shouldResetPassword: true, // Force them to change it on next login
      },
    });

    // Send the email
    await sendResetPasswordEmail(user.email, tempPassword);

    return NextResponse.json({ success: true, message: "If an account exists with that email, a reset link has been sent." });
  } catch (error) {
    console.error("[Forgot Password API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
