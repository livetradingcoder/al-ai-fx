import { useTranslations } from "next-intl";

export default function FAQ() {
  const t = useTranslations("FAQ");
  const faqs = [
    {
      q: t("q1"),
      a: t("a1")
    },
    {
      q: t("q2"),
      a: t("a2")
    },
    {
      q: t("q3"),
      a: t("a3")
    },
    {
      q: t("q4"),
      a: t("a4")
    }
  ];

  return (
    <main className="main-content" style={{ maxWidth: '800px', margin: '0 auto', padding: '6rem 2rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '3rem' }}>{t("title")}</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '4rem' }}>
        {t("subtitle")}
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
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{t("stillHaveQuestions")}</p>
        <a href="mailto:support@AL-ai-FX.com" className="btn-primary">{t("contactSupport")}</a>
      </div>
    </main>
  );
}
