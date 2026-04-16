export default function AdminDashboard() {
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
            <p style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'Outfit' }}>142</p>
          </div>
          <div className="feature-card">
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Monthly Recurring Revenue</h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'Outfit', color: 'var(--accent-accent)' }}>$12,450</p>
          </div>
          <div className="feature-card">
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>EA Compilations Today</h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'Outfit' }}>18</p>
          </div>
        </div>

        <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '2rem' }}>
          <div className="glass-panel">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Recent Users & Orders</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Email</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>MT5 Account</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Tier</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1.5rem 0' }}>trader@example.com</td>
                <td style={{ padding: '1.5rem 0', fontFamily: 'monospace' }}>12345678</td>
                <td style={{ padding: '1.5rem 0' }}>Lifetime</td>
                <td style={{ padding: '1.5rem 0' }}><span style={{ color: 'var(--accent-accent)' }}>Active</span></td>
                <td style={{ padding: '1.5rem 0' }}><button className="btn-secondary" style={{ padding: '0.4rem 1rem' }}>Edit User</button></td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1.5rem 0' }}>propfirm_pass@mail.com</td>
                <td style={{ padding: '1.5rem 0', fontFamily: 'monospace' }}>98765432</td>
                <td style={{ padding: '1.5rem 0' }}>1 Month</td>
                <td style={{ padding: '1.5rem 0' }}><span style={{ color: 'var(--text-secondary)' }}>Expired</span></td>
                <td style={{ padding: '1.5rem 0' }}><button className="btn-secondary" style={{ padding: '0.4rem 1rem' }}>Edit User</button></td>
              </tr>
            </tbody>
            </table>
          </div>

          <div className="glass-panel">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>SMTP Configuration</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Configure the email server to automatically send purchase confirmations and dashboard credentials.</p>
            <form style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>SMTP Host</label>
                <input type="text" className="form-input" placeholder="smtp.mailgun.org" defaultValue={process.env.SMTP_HOST || ''} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>SMTP Port</label>
                <input type="text" className="form-input" placeholder="587" defaultValue={process.env.SMTP_PORT || ''} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>From Name</label>
                <input type="text" className="form-input" placeholder="GoldBot Support" defaultValue={process.env.SMTP_FROM_NAME || ''} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>SMTP Username</label>
                <input type="text" className="form-input" placeholder="postmaster@AL-ai-FX.com" defaultValue={process.env.SMTP_USER || ''} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>SMTP Password</label>
                <input type="password" className="form-input" placeholder="********" defaultValue={process.env.SMTP_PASS || ''} />
              </div>
              <div style={{ gridColumn: 'span 2', marginTop: '0.5rem' }}>
                <button type="button" className="btn-primary" style={{ width: '100%' }}>Save Configuration</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
