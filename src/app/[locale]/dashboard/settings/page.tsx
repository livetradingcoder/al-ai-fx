import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SessionsTable, { type SessionRow } from "@/components/dashboard/SessionsTable";

export const metadata = { title: "Settings" };

/** Turns a raw user-agent into something a person recognises. */
function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : "Browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [user, rows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    }),
    prisma.userSession.findMany({
      where: { userId: session.user.id, revokedAt: null },
      orderBy: { lastSeenAt: "desc" },
      take: 20,
    }),
  ]);

  const sessions: SessionRow[] = rows.map((r) => ({
    id: r.id,
    device: describeDevice(r.userAgent),
    ip: r.ip,
    createdAt: r.createdAt.toLocaleDateString(),
    lastSeenAt: r.lastSeenAt.toLocaleString(),
  }));

  return (
    <>
      <header style={{ marginBottom: "22px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Settings</h1>
        <p style={{ color: "var(--text-secondary)" }}>Security and signed-in devices.</p>
      </header>

      <section className="card" style={{ marginBottom: "20px" }}>
        <p className="card-label">Active sessions</p>
        <h2 style={{ fontSize: "1.15rem", margin: "0 0 6px" }}>Devices signed into your account</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: "20px" }}>
          Sign out any device you don&apos;t recognise. It loses access on its next request.
        </p>
        <SessionsTable sessions={sessions} />
      </section>

      <section className="card">
        <p className="card-label">How you sign in</p>
        <h2 style={{ fontSize: "1.15rem", margin: "0 0 6px" }}>Emailed sign-in links</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", lineHeight: 1.7 }}>
          We send a single-use link to <strong>{user?.email}</strong> that signs you in and expires
          after 30 minutes. Anyone with access to that inbox can reach your account, so keep it
          secured — and if you ever lose access to it, contact support rather than creating a
          second account, since licences are tied to the email that bought them. Your password
          lives on the <strong>Profile</strong> page.
        </p>
      </section>
    </>
  );
}
