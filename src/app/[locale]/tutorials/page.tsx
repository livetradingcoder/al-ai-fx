import { useTranslations } from "next-intl";

export default function Tutorials() {
  const t = useTranslations("Tutorials");
  const tutorials = [
    {
      id: 1,
      title: t("tut1Title"),
      type: t("typeArticle"),
      duration: t("tut1Duration"),
      desc: t("tut1Desc")
    },
    {
      id: 2,
      title: t("tut2Title"),
      type: t("typeArticle"),
      duration: t("tut2Duration"),
      desc: t("tut2Desc")
    },
    {
      id: 3,
      title: t("tut3Title"),
      type: t("typeArticle"),
      duration: t("tut3Duration"),
      desc: t("tut3Desc")
    }
  ];

  return (
    <main className="main-content" style={{ maxWidth: '1000px', margin: '0 auto', padding: '6rem 2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>{t("platformTutorials")}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t("platformTutorialsSubtitle")}</p>
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
            <a href={`/tutorials/${tut.id}`} className="btn-secondary" style={{ textAlign: 'center' }}>{t("readArticle")}</a>
          </div>
        ))}
      </div>
    </main>
  );
}
