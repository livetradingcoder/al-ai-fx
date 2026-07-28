import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CompileServerStatus from "@/components/dashboard/CompileServerStatus";
import LicencesTable from "./LicencesTable";
import OrdersTable from "./OrdersTable";
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

  // 4. Licences. The table searches, filters and paginates in the browser, so
  // send a working set rather than a 10-row slice — capped so the page stays
  // cheap if the platform grows into thousands.
  const subscriptionRows = await prisma.subscription.findMany({
    take: 500,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } }, robot: { select: { name: true } } },
  });
  const licences = subscriptionRows.map((sub) => ({
    id: sub.id,
    email: sub.user.email,
    mt5AccountNumber: sub.mt5AccountNumber,
    robot: sub.robot?.name ?? '—',
    tier: sub.tier,
    status: sub.status,
    createdAt: sub.createdAt.toISOString(),
  }));

  // 5. Orders, same treatment.
  const orderRows = await prisma.order.findMany({
    take: 500,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } } },
  });
  const orders = orderRows.map((order) => ({
    id: order.id,
    email: order.user.email,
    tier: order.pricingTier,
    amount: order.amount,
    currency: order.currency,
    paygateId: order.paygateId,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  }));

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

        <LicencesTable licences={licences} />

        <OrdersTable orders={orders} />

        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Email delivery</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Environment variables active on the server. If these are incorrect, adjust your deployment settings.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr)', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>SMTP Host / Port</label>
              <input disabled type="text" className="enroll-input" style={{opacity: 0.7, maxWidth: '500px'}} value={`${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>From Name & Email</label>
              <input disabled type="text" className="enroll-input" style={{opacity: 0.7, maxWidth: '500px'}} value={`${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>SMTP Username</label>
              <input disabled type="text" className="enroll-input" style={{opacity: 0.7, maxWidth: '500px'}} value={process.env.SMTP_USER || ''} />
            </div>
          </div>
          <div style={{ marginTop: '2rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>* Note: To make modifications to these configurations, you must redeploy your server after updating the `env` file.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
