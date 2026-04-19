import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

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
          compilations: {
            orderBy: { createdAt: "desc" },
            take: 1
          }
        },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (user?.shouldResetPassword) {
    redirect("/dashboard/reset-password");
  }

  const activeSub = user?.subscriptions[0];

  return (
    <div style={{ maxWidth: '900px' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{t("welcomeBack")} {user?.name || t("trader")}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t("dashboardSubtitle")}</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
        
        {/* Active Subscription Card */}
        <div className="feature-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>{t("activePlan")}</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'Outfit, sans-serif', marginBottom: '1rem' }}>
            {activeSub?.tier ? activeSub.tier.replace('_', ' ') : t("noActivePlan")}
          </div>
          <p style={{ color: activeSub ? 'var(--accent-accent)' : 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '600' }}>
            ● {activeSub ? t("active") : t("inactive")}
          </p>
        </div>

        {/* Linked Account Card */}
        <div className="feature-card">
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>{t("registeredMt5")}</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'Outfit, sans-serif', marginBottom: '1rem' }}>
            {activeSub?.mt5AccountNumber || t("notLinked")}
          </div>
          <Link href="/dashboard/licenses" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: '600' }}>
            {activeSub?.mt5AccountNumber ? t("changeAccount") : t("linkAccountNow")}
          </Link>
        </div>
      </div>

      <section>
        <h2 style={{ fontSize: '1.8rem', textAlign: 'left', marginBottom: '1.5rem' }}>{t("downloadEA")}</h2>
        {activeSub ? (
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ marginBottom: '0.5rem' }}>GoldBot_v2.0_{activeSub.tier}.ex5</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {activeSub.mt5AccountNumber 
                  ? t("lockedToAccount", { account: activeSub.mt5AccountNumber }) 
                  : t("linkToDownload")}
              </p>
            </div>
            {activeSub.mt5AccountNumber ? (
              user?.subscriptions[0]?.compilations[0]?.id ? (
                <a 
                  href={`/api/compiler/download?jobId=${user.subscriptions[0].compilations[0].id}`} 
                  download 
                  className="btn-primary" 
                  style={{ textDecoration: 'none', padding: '0.8rem 2rem' }}
                >
                  {t("downloadBuild")}
                </a>
              ) : (
                <Link href="/dashboard/licenses" className="btn-primary" style={{ textDecoration: 'none', padding: '0.8rem 2rem' }}>
                  {t("manageDownload")}
                </Link>
              )
            ) : (
              <Link href="/dashboard/licenses" className="btn-primary" style={{ textDecoration: 'none', padding: '0.8rem 2rem' }}>
                {t("setupLicense")}
              </Link>
            )}
          </div>
        ) : (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{t("noSubscription")}</p>
            <Link href="/#pricing" className="btn-primary">{t("viewPricing")}</Link>
          </div>
        )}
      </section>
    </div>
  );
}
