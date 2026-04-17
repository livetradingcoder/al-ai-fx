import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions) as any;
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="dashboard-layout">
      
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>Menu</h3>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <li><a href="/dashboard" style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>Overview</a></li>
            <li><a href="/dashboard/licenses" style={{ color: 'var(--text-secondary)' }}>My Licenses</a></li>
            <li><a href="/dashboard/billing" style={{ color: 'var(--text-secondary)' }}>Billing</a></li>
            <li style={{ marginTop: '2rem' }}><a href="/api/auth/signout" style={{ color: 'var(--text-muted)' }}>Logout &rarr;</a></li>
          </ul>
        </div>

        {isAdmin && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>Administration</h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <li><a href="/dashboard/admin" style={{ color: 'var(--accent-accent)', fontWeight: '600' }}>Admin Center &rarr;</a></li>
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
