import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrismaClient, PricingTier } from "@prisma/client";
import { getTranslations } from "next-intl/server";

export default async function BillingPage() {
  const t = await getTranslations("Dashboard");
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' }
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const formatTier = (tier: PricingTier) => {
    return tier.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{t("billingPayments")}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t("billingSubtitle")}</p>
      </header>

      <div className="glass-panel" style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>{t("transactionHistory")}</h2>
        
        {orders.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>{t("noTransactions")}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>{t("date")}</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>{t("plan")}</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>{t("amount")}</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1.5rem 0' }}>{formatDate(order.createdAt)}</td>
                  <td style={{ padding: '1.5rem 0' }}>{formatTier(order.pricingTier)}</td>
                  <td style={{ padding: '1.5rem 0', fontWeight: 'bold' }}>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(order.amount)}
                  </td>
                  <td style={{ padding: '1.5rem 0' }}>
                    <span style={{ color: order.status === 'SUCCESS' ? 'var(--accent-accent)' : 'var(--text-error)' }}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
