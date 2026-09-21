"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { buildDashboardMagicLink } from "@/lib/magic-links";
import { sendAccountInviteEmail, sendAdminRoleAlertEmail } from "@/lib/mail";
import { validateEmail } from "@/lib/validation";

// Expected failures come back as values, not throws: Next.js replaces a
// thrown Server Function error with a generic message in production.
export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

type Role = "USER" | "ADMIN";

export async function toggleBlockUser(userId: string, currentBlockStatus: boolean) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Prevent blocking self
  if (userId === session.user.id) {
    throw new Error("You cannot block your own account");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isBlocked: !currentBlockStatus },
  });

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Prevent deleting self
  if (userId === session.user.id) {
    throw new Error("You cannot delete your own account");
  }

  // Perform a soft delete by marking the user as deleted in the database.
  await prisma.user.update({
    where: { id: userId },
    data: { isDeleted: true },
  });

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

/**
 * Grants or removes admin access. Takes effect on the person's next request:
 * the auth callback re-reads the role, so they need not sign out.
 */
export async function setUserRole(userId: string, role: Role): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Admins only." };
  }
  if (role !== "USER" && role !== "ADMIN") {
    return { ok: false, error: "Unknown role." };
  }
  // Nobody changes their own role. Besides stopping an admin locking
  // themselves out, it means the last admin can never be demoted.
  if (userId === session.user.id) {
    return { ok: false, error: "You can't change your own role." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, isDeleted: true },
  });
  if (!user || user.isDeleted) {
    return { ok: false, error: "That user no longer exists." };
  }
  if (user.role === role) {
    return { ok: true, message: `${user.email} is already ${role === "ADMIN" ? "an admin" : "a customer"}.` };
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  await sendAdminRoleAlertEmail({
    email: user.email,
    granted: role === "ADMIN",
    by: session.user.email ?? "an admin",
  });

  revalidatePath("/dashboard/admin/users");
  return {
    ok: true,
    message:
      role === "ADMIN"
        ? `${user.email} is now an admin.`
        : `${user.email} is no longer an admin.`,
  };
}

/**
 * Creates an account (or finds the existing one), optionally as an admin, and
 * emails a sign-in link. Customers normally never need this — checkout and the
 * free trial create their accounts — but it covers admins and support cases.
 * Never demotes: taking admin away is done from the table, on purpose.
 */
export async function addUser(input: { email: string; role: Role }): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Admins only." };
  }

  const raw = typeof input?.email === "string" ? input.email : "";
  const check = validateEmail(raw);
  if (!check.valid) {
    return { ok: false, error: check.error ?? "Enter a valid email." };
  }
  const email = raw.trim().toLowerCase();
  const wantsAdmin = input.role === "ADMIN";

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, isBlocked: true, isDeleted: true },
  });
  if (existing?.isDeleted) {
    return { ok: false, error: `${email} belongs to a deleted account.` };
  }
  if (existing?.isBlocked) {
    return { ok: false, error: `${email} is blocked — unblock it first.` };
  }

  let userId: string;
  let role: Role;
  let promoted = false;

  if (existing) {
    userId = existing.id;
    role = existing.role;
    if (wantsAdmin && existing.role !== "ADMIN") {
      await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
      role = "ADMIN";
      promoted = true;
    }
  } else {
    role = wantsAdmin ? "ADMIN" : "USER";
    const created = await prisma.user.create({
      data: { email, name: email.split("@")[0], role },
      select: { id: true },
    });
    userId = created.id;
    promoted = wantsAdmin;
  }

  if (promoted) {
    await sendAdminRoleAlertEmail({ email, granted: true, by: session.user.email ?? "an admin" });
  }

  let emailed = false;
  try {
    emailed = await sendAccountInviteEmail({
      email,
      magicLinkUrl: buildDashboardMagicLink({ email, userId }),
      role,
    });
  } catch (err) {
    console.error("[Admin] Account invite email failed:", err);
  }

  revalidatePath("/dashboard/admin/users");

  const what = !existing
    ? role === "ADMIN"
      ? `Admin account created for ${email}`
      : `Account created for ${email}`
    : promoted
      ? `${email} is now an admin`
      : `${email} already has an account`;
  const mail = emailed
    ? "sign-in link sent."
    : "but the email didn't go out — they can use Forgot password on the login page.";

  return { ok: true, message: `${what} — ${mail}` };
}
