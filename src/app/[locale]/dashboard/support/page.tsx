import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SupportForm from "@/components/dashboard/SupportForm";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <>
      <header style={{ marginBottom: "22px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Support</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Message the team. We reply to the email on your account.
        </p>
      </header>

      <div
        className="card-grid"
        style={{ gridTemplateColumns: "1fr minmax(240px, 340px)", alignItems: "start" }}
      >
        <div className="card">
          <SupportForm />
        </div>

        <div className="card">
          <p className="card-label">Before you write</p>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.7 }}>
            Most questions are about installing the robot. Two things catch nearly everyone:
          </p>
          <ol className="next-steps" style={{ marginTop: "16px" }}>
            <li>
              The robot only appears in MetaTrader after you right-click{" "}
              <strong>Expert Advisors</strong> in the Navigator and choose{" "}
              <strong>Refresh</strong> (Aktualisieren on German terminals).
            </li>
            <li>
              A build runs only on the MT5 account it was compiled for. On any other account it
              refuses to start.
            </li>
          </ol>
          <p style={{ marginTop: "18px" }}>
            <Link
              href="/tutorials/1"
              style={{ color: "var(--accent-primary)", fontWeight: 600, fontSize: "0.88rem" }}
            >
              Read the install guide →
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
