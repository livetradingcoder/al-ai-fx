import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfileForm from "@/components/dashboard/ProfileForm";
import PasswordForm from "@/components/dashboard/PasswordForm";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { _count: { select: { subscriptions: true, orders: true } } },
  });
  const hasPassword = Boolean(user?.passwordHash);
  if (!user) redirect("/login");

  const initials = (user.name || user.email).replace(/@.*/, "").slice(0, 2).toUpperCase();

  return (
    <>
      <header style={{ marginBottom: "22px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Profile</h1>
        <p style={{ color: "var(--text-secondary)" }}>Your account details.</p>
      </header>

      <div className="split-grid">
        <div className="card" style={{ textAlign: "center" }}>
          <span
            className="topbar-avatar"
            style={{ width: 78, height: 78, fontSize: "1.5rem", margin: "0 auto 16px" }}
            aria-hidden="true"
          >
            {initials}
          </span>
          <p style={{ fontSize: "1.15rem", fontWeight: 700 }}>{user.name || "Trader"}</p>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
            {user.email}
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              gap: "12px",
              marginTop: "22px",
              paddingTop: "18px",
              borderTop: "1px solid var(--border-color)",
            }}
          >
            <div>
              <p className="card-label" style={{ marginBottom: "4px" }}>Role</p>
              <p style={{ fontWeight: 700 }}>{user.role}</p>
            </div>
            <div>
              <p className="card-label" style={{ marginBottom: "4px" }}>Licences</p>
              <p style={{ fontWeight: 700 }} className="num">{user._count.subscriptions}</p>
            </div>
            <div>
              <p className="card-label" style={{ marginBottom: "4px" }}>Orders</p>
              <p style={{ fontWeight: 700 }} className="num">{user._count.orders}</p>
            </div>
          </div>

          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "18px" }}>
            Member since {user.createdAt.toLocaleDateString()}
          </p>
        </div>

        <div className="card">
          <p className="card-label">Personal information</p>
          <h2 style={{ fontSize: "1.15rem", margin: "0 0 18px" }}>Edit your details</h2>
          <ProfileForm initialName={user.name || ""} />
          <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "22px" }}>
            Your email is the identity your licences and receipts are tied to, so it can only be
            changed by support.
          </p>
        </div>
      </div>

      <section className="card" style={{ marginTop: "20px" }}>
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
    </>
  );
}
