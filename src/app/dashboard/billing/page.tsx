export default function BillingPage() {
  return (
    <div style={{ maxWidth: '900px' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Billing & Payments</h1>
        <p style={{ color: 'var(--text-secondary)' }}>View your transaction history and manage payment methods via Paygate.to.</p>
      </header>

      <div className="glass-panel" style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Transaction History</h2>
        
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
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '1.5rem 0' }}>Apr 15, 2026</td>
              <td style={{ padding: '1.5rem 0' }}>Lifetime Access</td>
              <td style={{ padding: '1.5rem 0', fontWeight: 'bold' }}>$999.00</td>
              <td style={{ padding: '1.5rem 0' }}><span style={{ color: 'var(--accent-accent)' }}>Paid (Crypto)</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
