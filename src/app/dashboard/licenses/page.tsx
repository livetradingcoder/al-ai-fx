export default function LicensesPage() {
  return (
    <div style={{ maxWidth: '900px' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>My Licenses</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your active EA subscriptions and locked MT5 accounts.</p>
      </header>

      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>GoldBot_v2.0_Lifetime</h3>
            <p style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 600 }}>Lifetime Access</p>
          </div>
          <div>
            <span className="badge" style={{ position: 'relative', top: 0, left: 0, transform: 'none', background: 'var(--accent-accent)' }}>Active</span>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Locked MT5 Account</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input type="text" value="12345678" readOnly style={{ 
                padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', 
                background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', fontFamily: 'inherit', width: '100%'
              }} />
              <button className="btn-secondary">Edit</button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Changes allow 2 more times this month.</p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Download Latest Build</p>
            <button className="btn-primary" style={{ border: 'none', alignSelf: 'flex-start' }}>Compile & Download .ex5</button>
          </div>
        </div>
      </div>
    </div>
  );
}
