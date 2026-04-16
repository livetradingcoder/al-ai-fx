export default function FAQ() {
  const faqs = [
    {
      q: "How does the cloud compilation work?",
      a: "Once you purchase a subscription and enter your MT5 account number in your Dashboard, our dedicated Windows Cloud Service dynamically modifies the source code of the EA and runs the MetaEditor compiler. This ensures the output .ex5 file is totally unique and locked securely to your account for maximum performance without lag-inducing web-requests."
    },
    {
      q: "Can I use the EA on multiple accounts?",
      a: "Each subscription tier typically ties to one MT5 account to prevent unauthorized distribution. However, you can change your registered MT5 Account ID from the Dashboard up to 2 times a month."
    },
    {
      q: "What happens when my subscription expires?",
      a: "The EA checks its embedded expiration date locally on instantiation. Once the date passes, the EA will stop opening new trades."
    },
    {
      q: "Does GoldBot handle Prop Firm rules?",
      a: "Yes! With our Smart Hedging Mode and Global Liquidity Guard avoiding high-impact holidays, GoldBot is heavily optimized for Prop Firm passing and long-term funding."
    }
  ];

  return (
    <main className="main-content" style={{ maxWidth: '800px', margin: '0 auto', padding: '6rem 2rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '3rem' }}>Frequently Asked Questions</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '4rem' }}>
        Everything you need to know about GoldBot and the AL-ai-FX platform.
      </p>

      <div style={{ display: 'grid', gap: '2rem' }}>
        {faqs.map((faq, idx) => (
          <div key={idx} className="feature-card" style={{ padding: '2rem' }}>
            <h3 style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}>{faq.q}</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>{faq.a}</p>
          </div>
        ))}
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '4rem' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Still have questions?</p>
        <a href="mailto:support@AL-ai-FX.com" className="btn-primary">Contact Support</a>
      </div>
    </main>
  );
}
