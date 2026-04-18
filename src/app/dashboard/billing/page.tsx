import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PricingTier } from "@prisma/client";

export default async function BillingPage() {
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
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Billing & Payments</h1>
        <p style={{ color: 'var(--text-secondary)' }}>View your transaction history and manage payment methods via Paygate.to.</p>
      </header>

      <div className="glass-panel" style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Transaction History</h2>
        
        {orders.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>No transactions found for your account.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Date</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Plan</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Amount</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
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
