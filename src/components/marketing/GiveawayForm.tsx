"use client";

import { useState } from "react";

import { Link } from "@/i18n/routing";
import "./rewards.css";

/**
 * The giveaway entry form. Used on the giveaway page and inside the exit-intent
 * pop-up. Entering needs an email and the rules; email updates are a separate,
 * unticked choice. `website` is a honeypot that real visitors never see.
 */
export default function GiveawayForm({
  locale,
  source,
  onDone,
}: {
  locale: string;
  source: "page" | "exit-intent";
  onDone?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [rules, setRules] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/giveaway/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, locale, acceptRules: rules, marketingOptIn: marketing, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "We could not save your entry. Please try again.");
      setState("done");
      onDone?.();
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "We could not save your entry. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="rw-scope">
        <p className="rw-ok" role="status">
          You&apos;re in. We sent a confirmation to your email. Want extra chances? Start your free trial, link your
          MT5 account and share your results.
        </p>
        <p style={{ marginTop: "12px" }}>
          <Link className="rw-btn rw-btn--small" href="/catalog">
            Start the free trial
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form className="rw-scope" onSubmit={submit} style={{ display: "grid", gap: "12px" }} noValidate={false}>
      <label className="rw-field">
        <span>Your email</span>
        <input
          className="rw-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <div className="rw-hp" aria-hidden="true">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <label className="rw-check">
        <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)} required />
        <span>
          I am 18 or over and accept the{" "}
          <Link href="/giveaway#rules" style={{ color: "#fcd535" }}>
            giveaway rules
          </Link>
          . No purchase necessary.
        </span>
      </label>

      <label className="rw-check">
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        <span>Also email me GoldBot news and offers. Optional, and I can unsubscribe at any time.</span>
      </label>

      {error && (
        <p className="rw-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="rw-btn" disabled={state === "sending" || !email.trim() || !rules}>
        {state === "sending" ? "Entering…" : "Enter the giveaway"}
      </button>
    </form>
  );
}
