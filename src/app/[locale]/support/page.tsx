import type { Metadata } from "next";

import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("support", locale);
}

export default function SupportPage() {
  return (
    <main className="main-content" style={{ maxWidth: '800px', margin: '0 auto', padding: '6rem 2rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '3rem' }}>Support Center</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '4rem' }}>
        Need help with GoldBot? Our team is here to assist you 24/7.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '4rem' }}>
        <div className="feature-card" style={{ textAlign: 'center' }}>
          <h3 style={{ marginBottom: '1rem' }}>Technical Support</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Having issues with installation or configuration?</p>
          <a href="mailto:support@AL-ai-FX.com" className="btn-secondary">Email Support</a>
        </div>
        <div className="feature-card" style={{ textAlign: 'center' }}>
          <h3 style={{ marginBottom: '1rem' }}>Billing Inquiries</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Questions about your subscription or upgrades?</p>
          <a href="mailto:billing@AL-ai-FX.com" className="btn-secondary">Email Billing</a>
        </div>
      </div>

      <div className="glass-panel">
        <h2 style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>Send a Message</h2>
        <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Email Address</label>
            <input type="email" placeholder="you@domain.com" style={{ 
              padding: '1rem', 
              borderRadius: 'var(--radius-sm)', 
              border: '1px solid var(--border-color)', 
              background: 'var(--bg-secondary)', 
              color: 'var(--text-primary)',
              fontFamily: 'inherit'
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>How can we help?</label>
            <textarea rows={5} placeholder="Describe your issue..." style={{ 
              padding: '1rem', 
              borderRadius: 'var(--radius-sm)', 
              border: '1px solid var(--border-color)', 
              background: 'var(--bg-secondary)', 
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}></textarea>
          </div>
          <button type="button" className="btn-primary" style={{ border: 'none', alignSelf: 'flex-start' }}>Send Message</button>
        </form>
      </div>
    </main>
  );
}
