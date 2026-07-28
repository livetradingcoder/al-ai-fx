"use client";

import { useState, useTransition } from "react";
import { joinProgram, requestPayout, savePayoutDetails } from "./actions";

function useAction() {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const run = (fn: () => Promise<string | void>) =>
    start(async () => {
      setNotice(null);
      try {
        const text = await fn();
        if (text) setNotice({ kind: "ok", text });
      } catch (err) {
        setNotice({ kind: "error", text: err instanceof Error ? err.message : "Something went wrong" });
      }
    });
  return { pending, notice, run };
}

/** The card a user sees before they have a code. */
export function JoinCard({ rate }: { rate: number }) {
  const { pending, notice, run } = useAction();

  return (
    <section className="card" style={{ maxWidth: "760px" }}>
      <p className="card-label">Affiliate programme</p>
      <h2 style={{ fontSize: "1.5rem", margin: "6px 0 12px" }}>
        Earn {rate}% of everything you refer — for as long as they stay.
      </h2>
      <ul className="onboarding-points">
        <li>Share one link. Anyone who buys through it earns you commission.</li>
        <li>You keep earning on their renewals, not just the first purchase.</li>
        <li>Your rate climbs as you earn: 15% → 25% → 35%.</li>
        <li>The people you send get 15% off their first purchase.</li>
      </ul>
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() => run(async () => void (await joinProgram()))}
      >
        {pending ? "Setting up…" : "Get my link"}
      </button>
      {notice && (
        <p className={`admin-notice is-${notice.kind}`} style={{ marginTop: "16px" }}>
          {notice.text}
        </p>
      )}
    </section>
  );
}

/** Link, code, and the share buttons that make someone actually post it. */
export function ShareBox({ code, origin }: { code: string; origin: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const link = `${origin}/r/${code}`;
  const pitch = `I run my gold trading on autopilot with this MT5 robot — get 15% off your first month: ${link}`;

  async function copy(what: "link" | "code" | "pitch") {
    const text = what === "link" ? link : what === "code" ? code : pitch;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  const share = [
    { label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(pitch)}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(pitch)}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(pitch.replace(link, "").trim())}` },
    { label: "Email", href: `mailto:?subject=${encodeURIComponent("A gold robot worth a look")}&body=${encodeURIComponent(pitch)}` },
  ];

  return (
    <section className="card">
      <p className="card-label">Your link</p>
      <div className="share-row">
        <code className="share-link">{link}</code>
        <button type="button" className="btn-mini" onClick={() => copy("link")}>
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
      </div>

      <div className="share-row" style={{ marginTop: "12px" }}>
        <code className="share-link is-code">{code}</code>
        <button type="button" className="btn-mini" onClick={() => copy("code")}>
          {copied === "code" ? "Copied" : "Copy code"}
        </button>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: "14px 0 8px" }}>
        Anyone landing on any page of the site with this link is credited to you for 30 days —
        and permanently once they create an account.
      </p>

      <div className="share-buttons">
        {share.map((s) => (
          <a
            key={s.label}
            className="btn-mini"
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            Share on {s.label}
          </a>
        ))}
        <button type="button" className="btn-mini" onClick={() => copy("pitch")}>
          {copied === "pitch" ? "Copied" : "Copy a ready-made post"}
        </button>
      </div>
    </section>
  );
}

/** Payout details plus the request button. */
export function PayoutPanel({
  method,
  address,
  approved,
  minPayout,
}: {
  method: string | null;
  address: string | null;
  approved: number;
  minPayout: number;
}) {
  const [form, setForm] = useState({ method: method ?? "", address: address ?? "" });
  const { pending, notice, run } = useAction();
  const canRequest = approved >= minPayout && Boolean(form.address);

  return (
    <section className="card">
      <p className="card-label">Getting paid</p>
      <h2 style={{ fontSize: "1.15rem", margin: "6px 0 16px" }}>Payout details</h2>

      <div className="settings-grid">
        <label>
          <span className="card-label">Method</span>
          <input
            className="enroll-input"
            style={{ marginTop: "8px" }}
            placeholder="USDT TRC20, Wise, bank…"
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
          />
        </label>
        <label>
          <span className="card-label">Address or account</span>
          <input
            className="enroll-input"
            style={{ marginTop: "8px" }}
            placeholder="Where the money should go"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </label>
        <div className="settings-grid-actions">
          <button
            type="button"
            className="btn-mini"
            disabled={pending}
            onClick={() => run(async () => {
              await savePayoutDetails(form.method, form.address);
              return "Payout details saved.";
            })}
          >
            Save details
          </button>
        </div>
      </div>

      <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={pending || !canRequest}
          onClick={() => run(async () => {
            const res = await requestPayout();
            return `Payout of $${res.amount.toFixed(2)} requested.`;
          })}
        >
          {pending ? "Working…" : "Request payout"}
        </button>
        <span style={{ color: "var(--text-muted)", fontSize: "0.84rem" }}>
          {approved >= minPayout
            ? `$${approved.toFixed(2)} ready to withdraw.`
            : `$${approved.toFixed(2)} approved — minimum payout is $${minPayout}.`}
        </span>
      </div>

      {notice && (
        <p className={`admin-notice is-${notice.kind}`} style={{ marginTop: "16px" }}>
          {notice.text}
        </p>
      )}
    </section>
  );
}
