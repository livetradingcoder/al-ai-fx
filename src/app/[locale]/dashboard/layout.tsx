import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Dashboard");
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="dashboard-layout">
      
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>{t("menu")}</h3>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <li><Link href="/dashboard" style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>{t("overview")}</Link></li>
            <li><Link href="/dashboard/licenses" style={{ color: 'var(--text-secondary)' }}>{t("myLicenses")}</Link></li>
            <li><Link href="/dashboard/billing" style={{ color: 'var(--text-secondary)' }}>{t("billing")}</Link></li>
            <li style={{ marginTop: '2rem' }}><Link href="/api/auth/signout" style={{ color: 'var(--text-muted)' }}>{t("logout")} &rarr;</Link></li>
          </ul>
        </div>

        {isAdmin && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>{t("administration")}</h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <li><Link href="/dashboard/admin" style={{ color: 'var(--accent-accent)', fontWeight: '600' }}>{t("adminOverview")}</Link></li>
              <li><Link href="/dashboard/admin/users" style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>{t("manageUsers")} &rarr;</Link></li>
            </ul>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {children}
      </main>
      
    </div>
  );
}
