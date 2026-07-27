import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import SupportForm from "@/components/dashboard/SupportForm";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const tt = await getTranslations("Tutorials");
  // Same three guides as /tutorials on the site — linked here because most
  // tickets are answered by them.
  const guides = [1, 2, 3].map((n) => ({
    id: String(n),
    title: tt(`tut${n}Title`),
    duration: tt(`tut${n}Duration`),
    description: tt(`tut${n}Desc`),
  }));

  return (
    <>
      <header style={{ marginBottom: "22px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Support</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Message the team. We reply to the email on your account.
        </p>
      </header>

      <div className="split-grid split-grid-wide-first">
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

      <section className="card" style={{ marginTop: "20px" }}>
        <p className="card-label">Guides</p>
        <h2 style={{ fontSize: "1.15rem", margin: "0 0 16px" }}>Tutorials</h2>
        <div className="guide-list">
          <Link href="/dashboard/onboarding" className="guide-row">
            <span>
              <span className="guide-title">Guided setup</span>
              <span className="guide-desc">
                Walks you from licence to a running robot, tracking what you&apos;ve already done.
              </span>
            </span>
            <span className="guide-meta">5 steps</span>
          </Link>
          {guides.map((g) => (
            <Link key={g.id} href={`/tutorials/${g.id}`} className="guide-row">
              <span>
                <span className="guide-title">{g.title}</span>
                <span className="guide-desc">{g.description}</span>
              </span>
              <span className="guide-meta">{g.duration}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
