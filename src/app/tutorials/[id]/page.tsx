type Params = {
  params: { id: string };
};

export default function TutorialDetail({ params }: Params) {
  const { id } = params;

  const contentMap: Record<string, { title: string, type: string, duration: string, body: React.ReactNode }> = {
    "1": {
      title: "Installing the EA on MetaTrader 5",
      type: "Video Tutorial",
      duration: "5 mins",
      body: (
        <>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>Step 1: Download your unique Build</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            Navigate to your GoldBot Dashboard and locate your active license. Click the <strong>Compile & Download</strong> button to trigger the windows service to compile a fresh .ex5 locked to your account number.
          </p>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>Step 2: Open MT5 Data Folder</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Launch MetaTrader 5. Click <code>File</code> in the top navigation, and select <code>Open Data Folder</code>. Navigate to <code>MQL5 / Experts</code> and paste the downloaded <strong>GoldBot_v2.ex5</strong> into this folder.
          </p>
        </>
      )
    },
    "2": {
      title: "Configuring the Smart Hedging Parameters",
      type: "Article",
      duration: "10 mins read",
      body: (
        <>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>Understanding Drawdown Recovery</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            GoldBot utilizes a selective recovery mechanism. Once the primary position goes into drawdown by X pips (defined as your Grid parameter), the EA deploys pending stop orders in the same zone rather than immediately executing at market.
          </p>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>Adjusting Lot Multipliers</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            For prop firms, we recommend a strict 1.3x to 1.5x lot multiplier. Never exceed 1.5x unless you are trading on a personal account with higher risk tolerance. The maximum allowed open steps constraint is also critical—cap this at 5 steps to avoid catastrophic risk.
          </p>
        </>
      )
    },
    "3": {
      title: "Understanding the Global Liquidity Guard",
      type: "Video Tutorial",
      duration: "3 mins",
      body: (
        <>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>What is the Liquidity Guard?</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            Major bank holidays affect trading volume globally. GoldBot automatically cross-references its internal calendar with UK, US, DE, FR, and IT holidays. If a Tier-1 country is offline, the EA drastically reduces its entry frequency or pauses entirely.
          </p>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>Configuration Flags</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            You can verify if the guard is active via the on-screen dashboard. Next to the "Holiday Status", it will read "Active" if today is a monitored holiday. You can force-bypass this in the inputs (<code>IgnoreHolidays = true</code>), but taking this risk invalidates our recommended setup.
          </p>
        </>
      )
    }
  };

  const tutorial = contentMap[id] || contentMap["1"];

  return (
    <main className="main-content" style={{ maxWidth: '900px', margin: '0 auto', padding: '6rem 2rem' }}>
      <div style={{ marginBottom: '3rem' }}>
        <a href="/tutorials" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: '1rem', display: 'inline-block' }}>&larr; Back to Tutorials</a>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <span className="badge" style={{ position: 'relative', top: 0, left: 0, transform: 'none' }}>{tutorial.type}</span>
          <span style={{ color: 'var(--text-muted)' }}>{tutorial.duration}</span>
        </div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{tutorial.title}</h1>
      </div>

      {tutorial.type.includes("Video") && (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', height: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '3rem', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '15px solid white', marginLeft: '5px' }}></div>
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>Click to play video</p>
          </div>
        </div>
      )}

      <article style={{ lineHeight: '1.8', color: 'var(--text-primary)' }}>
        {tutorial.body}
      </article>
    </main>
  );
}
