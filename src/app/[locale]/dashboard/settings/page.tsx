import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PasswordForm from "@/components/dashboard/PasswordForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, email: true },
  });

  const hasPassword = Boolean(user?.passwordHash);

  return (
    <>
      <header style={{ marginBottom: "22px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Settings</h1>
        <p style={{ color: "var(--text-secondary)" }}>Security and sign-in.</p>
      </header>

      <section className="card" style={{ marginBottom: "20px" }}>
        <p className="card-label">Password</p>
        <h2 style={{ fontSize: "1.15rem", margin: "0 0 6px" }}>
          {hasPassword ? "Change your password" : "Set a password"}
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: "20px" }}>
          {hasPassword
            ? "Use a strong, unique password. Minimum 8 characters."
            : "You sign in with emailed links. Setting a password lets you sign in directly as well."}
        </p>
        <PasswordForm hasPassword={hasPassword} />
      </section>

      <section className="card">
        <p className="card-label">How you sign in</p>
        <h2 style={{ fontSize: "1.15rem", margin: "0 0 6px" }}>Emailed sign-in links</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", lineHeight: 1.7 }}>
          We send a single-use link to <strong>{user?.email}</strong> that signs you in and expires
          after 30 minutes. Anyone with access to that inbox can reach your account, so keep it
          secured — and if you ever lose access to it, contact support rather than creating a
          second account, since licences are tied to the email that bought them.
        </p>
      </section>
    </>
  );
}
