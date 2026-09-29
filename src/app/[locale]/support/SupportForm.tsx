"use client";

import { useState } from "react";
import { Send } from "lucide-react";

// There is no support inbox API, so the form composes an email in the
// visitor's own mail app — addressed to the right team for the topic, with
// the details filled in. Nothing is sent without them seeing it first.
const TOPICS = [
  { id: "technical", label: "Setup & technical", to: "support@AL-ai-FX.com" },
  { id: "licence", label: "Licence & MT5 account", to: "support@AL-ai-FX.com" },
  { id: "billing", label: "Billing & refunds", to: "billing@AL-ai-FX.com" },
  { id: "other", label: "Something else", to: "support@AL-ai-FX.com" },
] as const;

export default function SupportForm() {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["id"]>("technical");
  const [email, setEmail] = useState("");
  const [mt5, setMt5] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = TOPICS.find((t) => t.id === topic) ?? TOPICS[0];

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) {
      setError("Tell us what you need help with.");
      return;
    }
    setError(null);
    const body = [
      message.trim(),
      "",
      "—",
      email.trim() && `Account email: ${email.trim()}`,
      mt5.trim() && `MT5 account number: ${mt5.trim()}`,
      `Topic: ${selected.label}`,
    ]
      .filter(Boolean)
      .join("\n");
    const subject = `[${selected.label}] Support request`;
    window.location.href = `mailto:${selected.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <form className="sp-form" onSubmit={onSubmit}>
      <h2>Send us a message</h2>
      <p>Pick a topic and we&apos;ll route it to the right team.</p>

      <div className="sp-field">
        <span>Topic</span>
        <div className="sp-topics" role="group" aria-label="Topic">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={topic === t.id}
              onClick={() => setTopic(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <label className="sp-field">
        <span>Your account email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@domain.com"
          autoComplete="email"
        />
      </label>

      <label className="sp-field">
        <span>MT5 account number (optional)</span>
        <input
          type="text"
          inputMode="numeric"
          value={mt5}
          onChange={(e) => setMt5(e.target.value)}
          placeholder="e.g. 50123487"
        />
      </label>

      <label className="sp-field">
        <span>How can we help?</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the issue — what you tried, and any message MetaTrader showed."
          required
        />
      </label>

      {error && (
        <p className="sp-form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="sp-btn is-primary is-large">
        <Send size={16} aria-hidden="true" />
        Continue in your email app
      </button>
      <p className="sp-form-note">
        Opens your email app with the message addressed to {selected.to}, ready to send. Never
        include your MT5 password.
      </p>
    </form>
  );
}
