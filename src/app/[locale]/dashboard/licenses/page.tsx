import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import LicenseManager from "@/components/dashboard/LicenseManager";
import { getTranslations } from "next-intl/server";

export default async function LicensesPage() {
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
        }
      }
    }
  });

  const activeSubs = user?.subscriptions || [];

  return (
    <div style={{ maxWidth: '900px' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{t("myLicenses")}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t("myLicensesSubtitle")}</p>
      </header>

      {activeSubs.length > 0 ? (
        activeSubs.map((sub) => (
          <LicenseManager 
            key={sub.id} 
            subscription={sub} 
            latestCompilation={sub.compilations[0] || null} 
          />
        ))
      ) : (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t("noActiveLicenses")}</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{t("noActiveLicensesDesc")}</p>
          <Link href="/#pricing" className="btn-primary">{t("viewPricingPlans")}</Link>
        </div>
      )}
    </div>
  );
}
