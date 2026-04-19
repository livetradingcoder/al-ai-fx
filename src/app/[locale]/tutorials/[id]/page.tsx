import Link from "next/link";
import Image from "next/image";
import { getTranslations } from 'next-intl/server';

export default async function TutorialDetail({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = await params;
  const t = await getTranslations("Tutorials");

  const contentMap: Record<string, { title: string, type: string, duration: string, body: React.ReactNode }> = {
    "1": {
      title: t("tut1Title"),
      type: t("typeArticle"),
      duration: t("tut1Duration"),
      body: (
        <>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>{t("step1Title")}</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            {t("step1Desc")}
          </p>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>{t("step2Title")}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {t("step2Desc")}
          </p>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>{t("step3Title")}</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            {t("step3Desc1")}
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>
            {t("step3Desc2")}
          </p>
        </>
      )
    },
    "2": {
      title: t("tut2Title"),
      type: t("typeArticle"),
      duration: t("tut2Duration"),
      body: (
        <>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>{t("drawdownTitle")}</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            {t("drawdownDesc")}
          </p>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>{t("adjustLotTitle")}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            {t("adjustLotDesc")}
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
      title: t("tut3Title"),
      type: t("typeArticle"),
      duration: t("tut3Duration"),
      body: (
        <>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>{t("liquidityGuardTitle")}</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            {t("liquidityGuardDesc")}
          </p>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>{t("manualFxTitle")}</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            {t("manualFxDesc")}
          </p>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: '2rem' }}>{t("configFlagsTitle")}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {t("configFlagsDesc")}
          </p>
        </>
      )
    }
  };

  const tutorial = contentMap[id] || contentMap["1"];

  return (
    <main className="main-content" style={{ maxWidth: '900px', margin: '0 auto', padding: '6rem 2rem' }}>
      <div style={{ marginBottom: '3rem' }}>
        <Link href="/tutorials" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: '1rem', display: 'inline-block' }}>&larr; {t("backToTutorials")}</Link>
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
