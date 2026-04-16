import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions) as any;
  
  if (!session?.user?.id || session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // 1. Fetch Total Users
  const totalUsers = await prisma.user.count({
    where: { role: "USER" }
  });

  // 2. Fetch Total Revenue
  const revenueResult = await prisma.order.aggregate({
    _sum: { amount: true },
    where: { status: "SUCCESS" }
  });
  const totalRevenue = revenueResult._sum.amount || 0;

  // 3. Compilations Today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const todayCompilations = await prisma.compilation.count({
    where: {
      createdAt: { gte: startOfDay }
    }
  });

  // 4. Recent Licenses/Subscriptions
  const recentSubscriptions = await prisma.subscription.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      user: true
    }
  });

  // 5. Recent Orders
  const recentOrders = await prisma.order.findMany({
    take: 15,
    orderBy: { createdAt: 'desc' },
    include: { user: true }
  });

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="navbar" style={{ position: 'sticky' }}>
        <div className="nav-container">
          <a href="/admin" className="logo" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            GoldBot <span style={{fontSize: '0.8rem', fontWeight: 500, color: 'var(--accent-primary)'}}>Admin Center</span>
          </a>
          <div className="nav-links">
            <a href="/dashboard" className="btn-secondary">Back to Site</a>
            <a href="/api/auth/signout" className="btn-primary" style={{ marginLeft: '1rem' }}>Logout</a>
          </div>
        </div>
      </nav>

      <div style={{ padding: '4rem 2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '3rem' }}>Platform Overview</h1>

        <div className="features-grid" style={{ marginBottom: '4rem' }}>
          <div className="feature-card">
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Total Active Users</h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'Outfit' }}>{totalUsers}</p>
          </div>
          <div className="feature-card">
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Total Revenue Generated</h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'Outfit', color: 'var(--accent-accent)' }}>
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="feature-card">
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>EA Compilations Today</h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'Outfit' }}>{todayCompilations}</p>
          </div>
        </div>

        <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '2rem' }}>
          <div className="glass-panel" style={{ overflowX: 'auto' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Recent Licenses Issued</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Email</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>MT5 Account</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Tier</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentSubscriptions.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No licenses found.
                  </td>
                </tr>
              )}
              {recentSubscriptions.map(sub => (
                <tr key={sub.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1.5rem 0' }}>{sub.user.email}</td>
                  <td style={{ padding: '1.5rem 0', fontFamily: 'monospace' }}>
                    {sub.mt5AccountNumber || <span style={{ color: 'var(--text-muted)' }}>Not linked</span>}
                  </td>
                  <td style={{ padding: '1.5rem 0' }}>{sub.tier.replace('_', ' ')}</td>
                  <td style={{ padding: '1.5rem 0' }}>
                    <span style={{ color: sub.status === "ACTIVE" ? 'var(--accent-accent)' : 'var(--text-secondary)' }}>
                      {sub.status}
                    </span>
                  </td>
                  <td style={{ padding: '1.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {new Date(sub.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>

          <div className="glass-panel">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>SMTP Configuration</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Environment variables active on the server. If these are incorrect, adjust your deployment settings.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>SMTP Host / Port</label>
                <input disabled type="text" className="form-input" style={{opacity: 0.7}} value={`${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>From Name & Email</label>
                <input disabled type="text" className="form-input" style={{opacity: 0.7}} value={`${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>SMTP Username</label>
                <input disabled type="text" className="form-input" style={{opacity: 0.7}} value={process.env.SMTP_USER || ''} />
              </div>
            </div>
            <div style={{ marginTop: '2rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>* Note: To make modifications to these configurations, you must redeploy your server after updating the `env` file.</p>
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ overflowX: 'auto', marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Recent Order Transactions</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Email</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Tier</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Amount</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Order Ref (Paygate ID)</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No orders found.
                  </td>
                </tr>
              )}
              {recentOrders.map(order => (
                <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1.5rem 0' }}>{order.user.email}</td>
                  <td style={{ padding: '1.5rem 0' }}>{order.pricingTier.replace('_', ' ')}</td>
                  <td style={{ padding: '1.5rem 0', fontWeight: 'bold' }}>
                    ${order.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {order.currency}
                  </td>
                  <td style={{ padding: '1.5rem 0', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                    {order.paygateId || <span style={{ color: 'var(--text-secondary)' }}>N/A</span>}
                  </td>
                  <td style={{ padding: '1.5rem 0' }}>
                    <span style={{ color: order.status === "SUCCESS" ? 'var(--accent-accent)' : order.status === "PENDING" ? 'var(--text-secondary)' : '#fca5a5' }}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ padding: '1.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

