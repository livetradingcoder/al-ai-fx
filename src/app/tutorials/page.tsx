export default function Tutorials() {
  const tutorials = [
    {
      id: 1,
      title: "Installing the EA on MetaTrader 5",
      type: "Article",
      duration: "5 mins read",
      desc: "Step-by-step guide on moving the compiled .ex5 from your Dashboard into your terminal's Expert folder."
    },
    {
      id: 2,
      title: "Configuring the Smart Hedging Parameters",
      type: "Article",
      duration: "10 mins read",
      desc: "Deep dive into recovery dynamics, lot sizing multipliers, and how to safely configure the EA based on your exact starting balance."
    },
    {
      id: 3,
      title: "Understanding the Global Liquidity Guard",
      type: "Article",
      duration: "3 mins read",
      desc: "Learn how the holiday filters protect your equity by automatically dodging low liquidity days across major banks."
    }
  ];

  return (
    <main className="main-content" style={{ maxWidth: '1000px', margin: '0 auto', padding: '6rem 2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Platform Tutorials</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Master GoldBot and maximize your edge in the markets with precise configurations.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {tutorials.map((tut) => (
          <div key={tut.id} className="feature-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span className="badge" style={{ position: 'relative', top: '0', left: '0', transform: 'none' }}>
                {tut.type}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{tut.duration}</span>
            </div>
            <h3 style={{ marginBottom: '1rem' }}>{tut.title}</h3>
            <p style={{ color: 'var(--text-secondary)', flexGrow: '1', marginBottom: '2rem' }}>{tut.desc}</p>
            <a href={`/tutorials/${tut.id}`} className="btn-secondary" style={{ textAlign: 'center' }}>Read Article</a>
          </div>
        ))}
      </div>
    </main>
  );
}
