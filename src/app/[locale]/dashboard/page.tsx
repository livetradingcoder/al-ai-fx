import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

const LockIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V7.5a3.5 3.5 0 017 0v3" />
  </svg>
);

export default async function DashboardOverview() {
  const t = await getTranslations("Dashboard");
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscriptions: {
        where: { status: "ACTIVE" },
        include: {
          compilations: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const activeSub = user?.subscriptions[0];
  const build = activeSub?.compilations[0];
  const hasPlan = Boolean(activeSub);
  const hasAccount = Boolean(activeSub?.mt5AccountNumber);
  const hasBuild = build?.status === "COMPLETED" && Boolean(build.id);

  // The checklist is the page's spine: it reflects real rows, so a customer
  // always sees exactly which of the four things is still outstanding.
  const steps = [
    { done: true, title: t("stepAccount"), note: t("stepAccountNote") },
    { done: hasAccount, title: t("stepLock"), note: t("stepLockNote") },
    { done: hasBuild, title: t("stepBuild"), note: t("stepBuildNote") },
    { done: false, title: t("stepInstall"), note: t("stepInstallNote") },
  ];
  const currentIndex = steps.findIndex((s) => !s.done);

  return (
    <>
      <header style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>
          {t("welcomeBack")} {user?.name || t("trader")}
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>{t("dashboardSubtitle")}</p>
      </header>

      <div className="card-grid" style={{ marginBottom: "20px" }}>
        <div className="card">
          <p className="card-label">{t("activePlan")}</p>
          <p className="card-value">
            {activeSub?.tier ? activeSub.tier.replace(/_/g, " ") : t("noActivePlan")}
          </p>
          <p
            style={{
              marginTop: "10px",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: hasPlan ? "var(--accent-success)" : "var(--text-muted)",
            }}
          >
            ● {hasPlan ? t("active") : t("inactive")}
          </p>
        </div>

        <div className="card">
          <p className="card-label">{t("registeredMt5")}</p>
          {hasAccount ? (
            <p className="plate">
              {LockIcon}
              {activeSub?.mt5AccountNumber}
            </p>
          ) : (
            <p className="card-value" style={{ color: "var(--text-muted)" }}>
              {t("notLinked")}
            </p>
          )}
          <p style={{ marginTop: "12px" }}>
            <Link
              href="/dashboard/licenses"
              style={{ color: "var(--accent-primary)", fontSize: "0.88rem", fontWeight: 600 }}
            >
              {hasAccount ? t("changeAccount") : t("linkAccountNow")}
            </Link>
          </p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: "20px" }}>
        <p className="card-label">{t("gettingStarted")}</p>
        <div className="steps">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="step-row"
              data-state={step.done ? "done" : i === currentIndex ? "now" : "todo"}
            >
              <span className="step-mark">{step.done ? "✓" : i + 1}</span>
              <span>
                <span className="step-title">{step.title}</span>
                <span className="step-note" style={{ display: "block" }}>
                  {step.note}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: "18px", display: "flex", gap: "18px", flexWrap: "wrap" }}>
          <Link
            href="/dashboard/onboarding"
            style={{ color: "var(--accent-primary)", fontSize: "0.88rem", fontWeight: 600 }}
          >
            {t("guidedSetup")} →
          </Link>
          <Link
            href="/tutorials/1"
            style={{ color: "var(--text-secondary)", fontSize: "0.88rem", fontWeight: 600 }}
          >
            {t("openTutorial")}
          </Link>
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: "1.3rem", textAlign: "left", marginBottom: "14px" }}>
          {t("downloadEA")}
        </h2>
        {hasPlan ? (
          <div className="card licence-head" style={{ marginBottom: 0 }}>
            <div style={{ minWidth: 0 }}>
              <p className="card-label">{t("lockedBuild")}</p>
              <p className="plate plate-sm">
                GoldBot_v2.0_{activeSub?.tier}.ex5
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.86rem", marginTop: "10px" }}>
                {hasAccount
                  ? t("lockedToAccount", { account: activeSub?.mt5AccountNumber ?? "" })
                  : t("linkToDownload")}
              </p>
            </div>
            {hasAccount && hasBuild ? (
              <a
                href={`/api/compiler/download?jobId=${build?.id}`}
                download
                className="btn-primary"
                style={{ textDecoration: "none", whiteSpace: "nowrap" }}
              >
                {t("downloadBuild")}
              </a>
            ) : (
              <Link
                href="/dashboard/licenses"
                className="btn-primary"
                style={{ textDecoration: "none", whiteSpace: "nowrap" }}
              >
                {hasAccount ? t("manageDownload") : t("setupLicense")}
              </Link>
            )}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: "40px 26px" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "18px" }}>
              {t("noSubscription")}
            </p>
            <Link href="/#pricing" className="btn-primary">
              {t("viewPricing")}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
