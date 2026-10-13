import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/routing";
import CompileServerStatus from "@/components/dashboard/CompileServerStatus";
import { HEARTBEAT_DEAD_SECONDS } from "@/lib/compiler-config";
import { mailDeliveryStatus } from "@/lib/mail";
import { timeAgo } from "@/lib/time-ago";

const DAY = 24 * 60 * 60_000;

const money = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function orderTone(status: string) {
  if (status === "SUCCESS") return "live";
  if (status === "PENDING") return "soon";
  return "bad";
}

type Attention = { key: string; tone: "bad" | "soon"; text: string; href?: string };

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const mail = mailDeliveryStatus();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const dayAgo = new Date(now.getTime() - DAY);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Customers are real accounts: admins and soft-deleted rows are not.
  const customerWhere = { role: "USER" as const, isDeleted: false };

  const [
    customers,
    newCustomers,
    revenue,
    revenueMonth,
    activeLicences,
    activeTrials,
    todayCompilations,
    heartbeat,
    recentFailures,
    payoutRequests,
    commissionsDue,
    latestCustomers,
    latestOrders,
  ] = await Promise.all([
    prisma.user.count({ where: customerWhere }),
    prisma.user.count({ where: { ...customerWhere, createdAt: { gte: weekAgo } } }),
    prisma.order.aggregate({ _sum: { amount: true }, where: { status: "SUCCESS" } }),
    prisma.order.aggregate({
      _sum: { amount: true },
      where: { status: "SUCCESS", createdAt: { gte: monthAgo } },
    }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "ACTIVE", tier: "FREE_TRIAL" } }),
    prisma.compilation.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.workerHeartbeat.findUnique({ where: { id: "compiler" } }),
    prisma.compilation.count({ where: { status: "FAILED", updatedAt: { gte: dayAgo } } }),
    prisma.affiliatePayout.aggregate({
      where: { status: "REQUESTED" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.commission.count({ where: { status: "PENDING", holdUntil: { lte: now } } }),
    prisma.user.findMany({
      where: customerWhere,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        email: true,
        createdAt: true,
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            tier: true,
            status: true,
            mt5AccountNumber: true,
            robot: { select: { name: true } },
          },
        },
      },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { email: true } } },
    }),
  ]);

  const totalRevenue = revenue._sum.amount ?? 0;
  const monthRevenue = revenueMonth._sum.amount ?? 0;

  // DLVR-04 dashboard flag: stale compile-worker heartbeat OR recent terminal
  // failures. Needs no mail provider, so it still shows when mail is down.
  const heartbeatAgeSec = heartbeat
    ? Math.floor((now.getTime() - heartbeat.lastSeenAt.getTime()) / 1000)
    : null;
  const heartbeatStale = heartbeatAgeSec === null || heartbeatAgeSec > HEARTBEAT_DEAD_SECONDS;

  const attention: Attention[] = [];
  if (heartbeatStale) {
    attention.push({
      key: "worker",
      tone: "bad",
      text:
        heartbeatAgeSec === null
          ? "Compile worker has never reported in."
          : `Compile worker offline — last seen ${heartbeatAgeSec}s ago (threshold: ${HEARTBEAT_DEAD_SECONDS}s).`,
    });
  }
  if (recentFailures > 0) {
    attention.push({
      key: "failures",
      tone: "bad",
      text: `${plural(recentFailures, "compile job")} failed in the last 24h — check the pipeline.`,
    });
  }
  const requested = payoutRequests._count._all;
  if (requested > 0) {
    attention.push({
      key: "payouts",
      tone: "soon",
      text: `${plural(requested, "affiliate payout request")} waiting — $${money(payoutRequests._sum.amount ?? 0)} to send.`,
      href: "/dashboard/admin/affiliates",
    });
  }
  if (commissionsDue > 0) {
    attention.push({
      key: "commissions",
      tone: "soon",
      text: `${plural(commissionsDue, "commission")} past the refund hold, ready to approve.`,
      href: "/dashboard/admin/affiliates",
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="admin-container">
        <header className="admin-head">
          <div>
            <h1 style={{ fontSize: '2.1rem', marginBottom: '0.35rem' }}>Admin</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              New customers, orders and anything waiting on you.
            </p>
          </div>
          <div className="admin-actions">
            <Link href="/dashboard/admin/users#add" className="btn-primary btn-sm">
              Add a person
            </Link>
            <Link href="/dashboard/admin/users" className="btn-mini">
              Manage customers
            </Link>
          </div>
        </header>

        {attention.length > 0 && (
          <section className="card" style={{ marginBottom: '20px' }} aria-label="Needs attention">
            <p className="card-label">Needs attention</p>
            <ul className="attn-list">
              {attention.map((item) => (
                <li key={item.key} className="attn-row" data-tone={item.tone}>
                  <span className="attn-dot" aria-hidden="true" />
                  <span className="attn-text">{item.text}</span>
                  {item.href && (
                    <Link href={item.href} className="btn-mini">
                      Review
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="card-grid" style={{ marginBottom: '20px' }}>
          <div className="card">
            <p className="card-label">Customers</p>
            <p className="card-value num">{customers}</p>
            <p className="cell-note">
              <span className="stat-delta">+{newCustomers}</span> this week
            </p>
          </div>
          <div className="card">
            <p className="card-label">Revenue</p>
            <p className="card-value num" style={{ color: 'var(--accent-primary)' }}>
              ${money(totalRevenue)}
            </p>
            <p className="cell-note">${money(monthRevenue)} in the last 30 days</p>
          </div>
          <div className="card">
            <p className="card-label">Active licences</p>
            <p className="card-value num">{activeLicences}</p>
            <p className="cell-note">{plural(activeTrials, "free trial")}</p>
          </div>
          <CompileServerStatus />
        </div>

        <div className="admin-split">
          <section className="card">
            <div className="admin-table-head">
              <div>
                <p className="card-label">People</p>
                <h2 style={{ fontSize: '1.15rem', margin: 0 }}>New customers</h2>
              </div>
              <Link href="/dashboard/admin/users" className="btn-mini">
                View all
              </Link>
            </div>
            {latestCustomers.length === 0 ? (
              <p className="cell-note" style={{ marginTop: 0 }}>No customers yet.</p>
            ) : (
              <ul className="latest-list">
                {latestCustomers.map((customer) => {
                  const licence = customer.subscriptions[0];
                  const live = licence?.status === 'ACTIVE';
                  return (
                    <li key={customer.id} className="latest-row">
                      <span className="cell-stack">
                        <span className="robot-name">{customer.email}</span>
                        <span className="cell-note" style={{ marginTop: 0 }}>
                          {licence ? `${licence.robot?.name ?? '—'} · ` : ''}
                          {timeAgo(customer.createdAt, now)}
                          {licence && live && !licence.mt5AccountNumber ? ' · No MT5 yet' : ''}
                        </span>
                      </span>
                      {licence ? (
                        <span
                          className="pill"
                          data-tone={!live ? 'bad' : licence.tier === 'FREE_TRIAL' ? 'soon' : 'live'}
                        >
                          {live ? licence.tier.replace(/_/g, ' ') : licence.status}
                        </span>
                      ) : (
                        <span className="pill">No licence</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="admin-table-head">
              <div>
                <p className="card-label">Payments</p>
                <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Recent orders</h2>
              </div>
              <Link href="/dashboard/admin/orders" className="btn-mini">
                View all
              </Link>
            </div>
            {latestOrders.length === 0 ? (
              <p className="cell-note" style={{ marginTop: 0 }}>No orders yet.</p>
            ) : (
              <ul className="latest-list">
                {latestOrders.map((order) => (
                  <li key={order.id} className="latest-row">
                    <span className="cell-stack">
                      <span className="robot-name">{order.user.email}</span>
                      <span className="cell-note" style={{ marginTop: 0 }}>
                        {order.pricingTier.replace(/_/g, ' ')} · {timeAgo(order.createdAt, now)}
                      </span>
                    </span>
                    <span className="latest-end">
                      <strong>${money(order.amount)}</strong>
                      <span className="pill" data-tone={orderTone(order.status)}>
                        {order.status}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <p className="card-label" style={{ marginTop: '32px' }}>System</p>
        <p className="cell-note" style={{ marginTop: 0, marginBottom: '12px' }}>
          {plural(todayCompilations, 'compilation')} so far today.
        </p>
        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Email delivery</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Mail leaves through the Mailgun API — these are the environment variables active on the server. If these are incorrect, adjust your deployment settings.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr)', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Mailgun domain</label>
              <input disabled type="text" className="enroll-input" style={{opacity: 0.7, maxWidth: '500px'}} value={mail.domain ?? 'Not set'} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Mailgun API key</label>
              <input disabled type="text" className="enroll-input" style={{opacity: 0.7, maxWidth: '500px'}} value={mail.apiKeySet ? 'Set' : 'Not set'} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>From Name & Email</label>
              <input disabled type="text" className="enroll-input" style={{opacity: 0.7, maxWidth: '500px'}} value={mail.sender} />
            </div>
          </div>
          <div style={{ marginTop: '2rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {mail.sending
                ? '* Note: To make modifications to these configurations, you must redeploy your server after updating the `env` file.'
                : '* Nothing is being sent: set MAILGUN_API_KEY and MAILGUN_DOMAIN, then redeploy.'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
