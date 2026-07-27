import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CompileServerStatus from "@/components/dashboard/CompileServerStatus";
import { HEARTBEAT_DEAD_SECONDS } from "@/lib/compiler-config";

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  
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

  // 6. DLVR-04 dashboard flag: stale compile-worker heartbeat OR recent terminal failures.
  // Mailtrap-independent — satisfies "admin alerted via email OR dashboard flag" without
  // depending on MAILTRAP_TOKEN/ADMIN_ALERT_EMAIL being provisioned.
  const hb = await prisma.workerHeartbeat.findUnique({ where: { id: "compiler" } });
  const now = new Date();
  const hbAgeSec = hb ? Math.floor((now.getTime() - hb.lastSeenAt.getTime()) / 1000) : null;
  const heartbeatStale = hbAgeSec === null || hbAgeSec > HEARTBEAT_DEAD_SECONDS;
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
  const recentFailures = await prisma.compilation.count({
    where: { status: "FAILED", updatedAt: { gte: dayAgo } },
  });
  const showAlertFlag = heartbeatStale || recentFailures > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="admin-container">
        <h1 style={{ fontSize: '2.1rem', marginBottom: '1.75rem' }}>Platform Overview</h1>

        {showAlertFlag && (
          <div style={{ padding: '1rem 1.5rem', marginBottom: '2rem', background: 'rgba(255, 68, 68, 0.1)', border: '1px solid rgba(255, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: '#ff4444', fontWeight: 500 }}>
            {heartbeatStale && (
              <p style={{ margin: 0 }}>
                ⚠ Compile worker {hbAgeSec === null ? 'has never reported in' : `offline — last seen ${hbAgeSec}s ago`} (threshold: {HEARTBEAT_DEAD_SECONDS}s).
              </p>
            )}
            {recentFailures > 0 && (
              <p style={{ margin: heartbeatStale ? '0.5rem 0 0' : 0 }}>
                ⚠ {recentFailures} compile job{recentFailures === 1 ? '' : 's'} failed in the last 24h — check the pipeline.
              </p>
            )}
          </div>
        )}

        <div className="card-grid" style={{ marginBottom: '24px' }}>
          <div className="card">
            <p className="card-label">Active users</p>
            <p className="card-value num">{totalUsers}</p>
          </div>
          <div className="card">
            <p className="card-label">Revenue generated</p>
            <p className="card-value num" style={{ color: 'var(--accent-primary)' }}>
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="card">
            <p className="card-label">Compilations today</p>
            <p className="card-value num">{todayCompilations}</p>
          </div>
          <CompileServerStatus />
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Recent Licenses Issued</h2>
          <div className="table-wrap"><table className="data-table">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th>Email</th>
                <th>MT5 Account</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Date</th>
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
                  <td style={{ padding: '1.5rem 1rem' }}>{sub.user.email}</td>
                  <td style={{ padding: '1.5rem 1rem', fontFamily: 'monospace' }}>
                    {sub.mt5AccountNumber || <span style={{ color: 'var(--text-muted)' }}>Not linked</span>}
                  </td>
                  <td style={{ padding: '1.5rem 1rem', whiteSpace: 'nowrap' }}>{sub.tier.replace('_', ' ')}</td>
                  <td style={{ padding: '1.5rem 1rem' }}>
                    <span style={{ color: sub.status === "ACTIVE" ? 'var(--accent-accent)' : 'var(--text-secondary)' }}>
                      {sub.status}
                    </span>
                  </td>
                  <td style={{ padding: '1.5rem 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {new Date(sub.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>

        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>SMTP Configuration</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Environment variables active on the server. If these are incorrect, adjust your deployment settings.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr)', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>SMTP Host / Port</label>
              <input disabled type="text" className="form-input" style={{opacity: 0.7, maxWidth: '500px'}} value={`${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>From Name & Email</label>
              <input disabled type="text" className="form-input" style={{opacity: 0.7, maxWidth: '500px'}} value={`${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>SMTP Username</label>
              <input disabled type="text" className="form-input" style={{opacity: 0.7, maxWidth: '500px'}} value={process.env.SMTP_USER || ''} />
            </div>
          </div>
          <div style={{ marginTop: '2rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>* Note: To make modifications to these configurations, you must redeploy your server after updating the `env` file.</p>
          </div>
        </div>

        <div className="glass-panel" style={{ overflowX: 'auto', marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Recent Order Transactions</h2>
          <div className="table-wrap"><table className="data-table">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th>Email</th>
                <th>Tier</th>
                <th>Amount</th>
                <th>Order Ref (Paygate ID)</th>
                <th>Status</th>
                <th>Date</th>
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
                  <td style={{ padding: '1.5rem 1rem' }}>{order.user.email}</td>
                  <td style={{ padding: '1.5rem 1rem', whiteSpace: 'nowrap' }}>{order.pricingTier.replace('_', ' ')}</td>
                  <td style={{ padding: '1.5rem 1rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    ${order.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {order.currency}
                  </td>
                  <td style={{ padding: '1.5rem 1rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                    {order.paygateId || <span style={{ color: 'var(--text-secondary)' }}>N/A</span>}
                  </td>
                  <td style={{ padding: '1.5rem 1rem' }}>
                    <span style={{ color: order.status === "SUCCESS" ? 'var(--accent-accent)' : order.status === "PENDING" ? 'var(--text-secondary)' : '#fca5a5' }}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ padding: '1.5rem 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
