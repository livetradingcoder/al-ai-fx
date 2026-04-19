import Link from "next/link";
import Image from "next/image";

export default async function TutorialDetail({ params }: PageProps<"/tutorials/[id]">) {
  const { id } = await params;

  const contentMap: Record<string, { title: string, type: string, duration: string, body: React.ReactNode }> = {
    "1": {
      title: "Installing the EA on MetaTrader 5",
      type: "Article",
      duration: "5 mins read",
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
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>Step 3: Execution & VPS Recommendations</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            For optimal performance, it is highly recommended to leave the EA running 24/5 on a <strong>Virtual Private Server (VPS)</strong>. This guarantees uninterrupted connectivity and execution.
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>
            If you decide to run the EA manually on your local computer, you <strong>must turn it on every day at 7:00 AM CET</strong> and leave it running completely uninterrupted until it successfully executes a trade.
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
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>Adjusting Lot Multipliers per Balance</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            For prop firms, we recommend a strict 1.3x to 1.5x lot multiplier. Never exceed 1.5x unless you are trading on a personal account with higher risk tolerance. Below are specific recommended parameter configurations based on your starting capital.
          </p>

          <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', marginTop: '2rem' }}>$100 Balance Configuration</h3>
          <div style={{ marginBottom: '2rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <Image src="/tutorials/100usd.png" alt="$100 Settings" width={1200} height={400} style={{ width: '100%', height: 'auto', display: 'block' }} unoptimized={true} />
          </div>

          <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', marginTop: '2rem' }}>$1,000 Balance Configuration</h3>
          <div style={{ marginBottom: '2rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <Image src="/tutorials/1000usd.png" alt="$1,000 Settings" width={1200} height={400} style={{ width: '100%', height: 'auto', display: 'block' }} unoptimized={true} />
          </div>

          <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', marginTop: '2rem' }}>$2,000 Balance Configuration</h3>
          <div style={{ marginBottom: '2rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <Image src="/tutorials/2000usd.png" alt="$2,000 Settings" width={1200} height={400} style={{ width: '100%', height: 'auto', display: 'block' }} unoptimized={true} />
          </div>

          <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', marginTop: '2rem' }}>$5,000 Balance Configuration</h3>
          <div style={{ marginBottom: '2rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <Image src="/tutorials/5000uskd.png" alt="$5,000 Settings" width={1200} height={400} style={{ width: '100%', height: 'auto', display: 'block' }} unoptimized={true} />
          </div>

          <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', marginTop: '2rem' }}>$10,000 Balance Configuration</h3>
          <div style={{ marginBottom: '2rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <Image src="/tutorials/10000usd.png" alt="$10,000 Settings" width={1200} height={400} style={{ width: '100%', height: 'auto', display: 'block' }} unoptimized={true} />
          </div>
        </>
      )
    },
    "3": {
      title: "Understanding the Global Liquidity Guard",
      type: "Article",
      duration: "3 mins read",
      body: (
        <>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>What is the Liquidity Guard?</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            Major bank holidays affect trading volume globally. GoldBot automatically cross-references its internal calendar with UK, US, DE, FR, and IT holidays. If a Tier-1 country is offline, the EA drastically reduces its entry frequency or pauses entirely.
          </p>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>Manual FX News Tracking</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            <strong>Important:</strong> Always check the FX news and economic calendars on your own. When the market is observing a holiday, the bot should strictly be kept OFF. If powerful countries have a public holiday, you must keep the bot turned OFF manually, because the volatility and dramatically lower market volume can cause high spread spikes and erratic movements.
          </p>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>Configuration Flags</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            You can verify if the guard is active via the on-screen dashboard. Next to the &quot;Holiday Status&quot;, it will read &quot;Active&quot; if today is a monitored holiday. You can force-bypass this in the inputs (<code>IgnoreHolidays = true</code>), but taking this risk invalidates our recommended setup.
          </p>
        </>
      )
    }
  };

  const tutorial = contentMap[id] || contentMap["1"];

  return (
    <main className="main-content" style={{ maxWidth: '900px', margin: '0 auto', padding: '6rem 2rem' }}>
      <div style={{ marginBottom: '3rem' }}>
        <Link href="/tutorials" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: '1rem', display: 'inline-block' }}>&larr; Back to Tutorials</Link>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <span className="badge" style={{ position: 'relative', top: 0, left: 0, transform: 'none' }}>{tutorial.type}</span>
          <span style={{ color: 'var(--text-muted)' }}>{tutorial.duration}</span>
        </div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{tutorial.title}</h1>
      </div>

      <article style={{ lineHeight: '1.8', color: 'var(--text-primary)' }}>
        {tutorial.body}
      </article>
    </main>
  );
}
