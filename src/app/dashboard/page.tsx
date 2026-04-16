export default function DashboardOverview() {
  return (
    <div style={{ maxWidth: '900px' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Welcome back, Trader</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your GoldBot licenses and account data.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
        
        {/* Active Subscription Card */}
        <div className="feature-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>Active Plan</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'Outfit, sans-serif', marginBottom: '1rem' }}>Lifetime Pass</div>
          <p style={{ color: 'var(--accent-accent)', fontSize: '0.9rem', fontWeight: '600' }}>● Active</p>
        </div>

        {/* Linked Account Card */}
        <div className="feature-card">
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>Registered MT5 Account</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'Outfit, sans-serif', marginBottom: '1rem' }}>12345678</div>
          <a href="#" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: '600' }}>Change Account</a>
        </div>
      </div>

      <section>
        <h2 style={{ fontSize: '1.8rem', textAlign: 'left', marginBottom: '1.5rem' }}>Download EA</h2>
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ marginBottom: '0.5rem' }}>GoldBot_v2.0_Lifetime.ex5</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Compiled on April 15, 2026. Locked to Account 12345678.</p>
          </div>
          <button className="btn-primary" style={{ border: 'none', fontSize: '1rem', padding: '0.8rem 2rem' }}>
            Download Build
          </button>
        </div>
      </section>
    </div>
  );
}
