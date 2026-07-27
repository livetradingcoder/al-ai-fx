import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password, currentPassword } = await req.json();

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.error }, { status: 400 });
    }

    // A session alone must not be enough to take over an account: anyone with
    // a borrowed session could otherwise set a new password and lock the owner
    // out. Require the current password whenever the account HAS one and is
    // not in the forced-reset flow (magic-link users have no password yet).
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true, shouldResetPassword: true },
    });

    const hasPassword = Boolean(existing?.passwordHash);
    if (hasPassword && !existing?.shouldResetPassword) {
      if (typeof currentPassword !== "string" || currentPassword.length === 0) {
        return NextResponse.json(
          { error: "Enter your current password" },
          { status: 400 },
        );
      }
      const matches = await bcrypt.compare(currentPassword, existing!.passwordHash!);
      if (!matches) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 403 },
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        passwordHash: hashedPassword,
        shouldResetPassword: false,
      },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("[Update Password API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
