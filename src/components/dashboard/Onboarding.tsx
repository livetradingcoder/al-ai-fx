"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  subscriptionId: string | null;
  tier: string | null;
  mt5Account: string | null;
  jobId: string | null;
  jobStatus: string | null;
};

const STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "account", label: "Lock account" },
  { key: "build", label: "Your build" },
  { key: "install", label: "Install" },
  { key: "run", label: "Run it" },
] as const;

const Check = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** Five steps that match what actually happens: lock an account, we compile a
 *  build for it, install it, run it. No broker linking or verification stages
 *  — the robot never talks back to us, so there is nothing to verify. */
export default function Onboarding({
  subscriptionId,
  tier,
  mt5Account,
  jobId,
  jobStatus,
}: Props) {
  const router = useRouter();
  const hasAccount = Boolean(mt5Account);
  const hasBuild = jobStatus === "COMPLETED" && Boolean(jobId);

  const firstIncomplete = !hasAccount ? 1 : !hasBuild ? 2 : 3;
  const [step, setStep] = useState(firstIncomplete);

  const [account, setAccount] = useState(mt5Account ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(false);

  const done = (i: number) =>
    i === 0 || (i === 1 && hasAccount) || (i === 2 && hasBuild);

  async function lockAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!subscriptionId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/licenses/update-mt5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId, mt5AccountNumber: account }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save that number");
      setPolling(true);
      setStep(2);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that number");
    } finally {
      setSaving(false);
    }
  }

  // While a build compiles, refresh until it lands (typically a few seconds).
  useEffect(() => {
    if (!polling || hasBuild) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [polling, hasBuild, router]);

  return (
    <>
      <ol className="stepper" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s.key} className="stepper-item">
            <button
              type="button"
              className="stepper-node"
              data-state={done(i) ? "done" : i === step ? "current" : "todo"}
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="stepper-mark">{done(i) ? Check : i + 1}</span>
              <span className="stepper-label">{s.label}</span>
            </button>
          </li>
        ))}
      </ol>

      <section className="card onboarding-card">
        {step === 0 && (
          <>
            <p className="card-label">Step 1 — Welcome</p>
            <h2 className="onboarding-title">
              Let&apos;s get your robot running on XAU/USD.
            </h2>
            <p className="onboarding-lead">
              Four short steps: lock the MT5 account you&apos;ll trade on, we compile a build
              for exactly that account, you copy it into MetaTrader, and you drag it onto a
              gold chart.
            </p>
            <ul className="onboarding-points">
              <li>Your build only runs on the account you name — nobody else can use it.</li>
              <li>Compiling takes a few seconds; we email you when it&apos;s ready.</li>
              <li>Nothing here is reversible by accident: the account is set once.</li>
            </ul>
            <button type="button" className="btn-primary" onClick={() => setStep(1)}>
              Begin setup →
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <p className="card-label">Step 2 — Lock account</p>
            <h2 className="onboarding-title">Which MT5 account will run it?</h2>
            <p className="onboarding-lead">
              Enter the login number of the MetaTrader 5 account you trade on. It&apos;s the
              number your broker gave you, 5–15 digits.
            </p>

            {!subscriptionId ? (
              <p style={{ color: "var(--text-muted)" }}>
                You need an active licence first.{" "}
                <Link href="/#pricing" style={{ color: "var(--accent-primary)" }}>
                  See plans
                </Link>
                .
              </p>
            ) : hasAccount ? (
              <>
                <p className="plate">{mt5Account}</p>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "12px" }}>
                  This licence is locked to that account permanently.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: "18px" }}
                  onClick={() => setStep(2)}
                >
                  Next →
                </button>
              </>
            ) : (
              <form onSubmit={lockAccount}>
                <input
                  className="enroll-input"
                  style={{ width: "100%", maxWidth: "320px", display: "block" }}
                  inputMode="numeric"
                  placeholder="e.g. 4587463239820"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  required
                />
                <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: "10px 0 18px" }}>
                  You can only set this once — it cannot be changed later.
                </p>
                <button type="submit" className="btn-primary" disabled={saving || !account}>
                  {saving ? "Saving…" : "Save & lock"}
                </button>
                {error && (
                  <p style={{ marginTop: "12px", color: "var(--accent-danger)", fontSize: "0.86rem" }}>
                    {error}
                  </p>
                )}
              </form>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <p className="card-label">Step 3 — Your build</p>
            <h2 className="onboarding-title">Grab the binary for your account.</h2>
            <p className="onboarding-lead">
              Compiled for {mt5Account ? <strong>{mt5Account}</strong> : "your account"} and
              nobody else&apos;s.
            </p>

            {hasBuild ? (
              <>
                <p className="plate plate-sm">GoldBot_v2.0_{tier}.ex5</p>
                <p style={{ marginTop: "20px" }}>
                  <a
                    href={`/api/compiler/download?jobId=${jobId}`}
                    download
                    className="btn-primary"
                    style={{ textDecoration: "none" }}
                  >
                    Download .ex5
                  </a>
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: "14px" }}
                  onClick={() => setStep(3)}
                >
                  I&apos;ve downloaded it →
                </button>
              </>
            ) : hasAccount ? (
              <p style={{ color: "var(--text-secondary)" }}>
                Compiling your build now — this usually takes a few seconds. This page updates
                itself, and we&apos;ll email you when it&apos;s ready.
              </p>
            ) : (
              <p style={{ color: "var(--text-muted)" }}>
                Lock an MT5 account first and we&apos;ll compile your build.
              </p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <p className="card-label">Step 4 — Install</p>
            <h2 className="onboarding-title">Put the file where MetaTrader looks.</h2>

            <div className="mt5-mock" aria-hidden="true">
              <div className="mt5-mock-bar">
                <span className="mt5-dot" /><span className="mt5-dot" /><span className="mt5-dot" />
                <span className="mt5-mock-title">MetaTrader 5 — XAUUSD, M5</span>
              </div>
              <div className="mt5-mock-body">
                <div className="mt5-nav">
                  <p className="mt5-nav-label">Navigator</p>
                  <p className="mt5-nav-group">▾ Expert Advisors</p>
                  <p className="mt5-nav-item is-ea">GoldBot</p>
                  <p className="mt5-nav-item">Moving Average</p>
                  <p className="mt5-nav-item">MACD Sample</p>
                </div>
                <div className="mt5-chart">
                  {[38, 52, 30, 61, 44, 70, 55, 82, 66, 91].map((h, i) => (
                    <span
                      key={i}
                      className={i % 3 === 1 ? "candle down" : "candle up"}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <ol className="next-steps" style={{ marginTop: "22px" }}>
              <li>In MetaTrader: <strong>File → Open Data Folder</strong>.</li>
              <li>Open <strong>MQL5 / Experts</strong> and paste the .ex5 there (not in a sub-folder).</li>
              <li>
                In the Navigator panel, right-click <strong>Expert Advisors</strong> and choose{" "}
                <strong>Refresh</strong> — <em>Aktualisieren</em> on German terminals. The robot
                will not appear until you do this.
              </li>
            </ol>

            <button type="button" className="btn-primary" style={{ marginTop: "20px" }} onClick={() => setStep(4)}>
              It&apos;s in the list →
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <p className="card-label">Step 5 — Run it</p>
            <h2 className="onboarding-title">Drag it onto a gold chart.</h2>
            <ol className="next-steps">
              <li>Open an <strong>XAUUSD</strong> chart (M5 is a good default).</li>
              <li>Drag <strong>GoldBot</strong> from the Navigator onto that chart.</li>
              <li>
                In the inputs, set your <strong>Risk Percent</strong> and <strong>Trading Hours</strong>{" "}
                as per the guide.
              </li>
              <li>
                Turn on <strong>Algo Trading</strong> in the toolbar. A smiley face on the chart
                means it&apos;s live.
              </li>
            </ol>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "18px" }}>
              If it refuses to start with &ldquo;Unauthorized account&rdquo;, the chart is on a
              different MT5 login than the one this build was compiled for.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "22px" }}>
              <Link href="/tutorials/1" className="btn-primary" style={{ textDecoration: "none" }}>
                Read the full guide
              </Link>
              <Link href="/dashboard" className="btn-secondary" style={{ textDecoration: "none" }}>
                Go to dashboard
              </Link>
            </div>
          </>
        )}
      </section>
    </>
  );
}
