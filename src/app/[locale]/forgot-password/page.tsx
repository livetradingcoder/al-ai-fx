"use client";

import { useState } from "react";
import { CircleAlert, LoaderCircle, Mail, MailCheck, Send } from "lucide-react";

import { Link } from "@/i18n/routing";
import { AuthAlert, AuthField, AuthShell } from "@/components/auth/AuthShell";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
      } else {
        setError(data.error || "Failed to process request.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      icon={message ? MailCheck : Send}
      eyebrow="Passwordless sign-in"
      title={message ? "Check your inbox" : "Email me a magic link"}
      subtitle={
        message
          ? undefined
          : "Enter your email and we'll send you a secure sign-in link — no temporary password needed."
      }
      footer={
        <>
          Prefer your password instead? <Link href="/login">Log in</Link>
        </>
      }
    >
      {message ? (
        <div className="au-status">
          <span className="au-status-icon" aria-hidden="true">
            <MailCheck size={32} />
          </span>
          <p>{message}</p>
          <ol className="au-steps">
            <li>
              <span>1</span>
              Open the email from GoldBot
            </li>
            <li>
              <span>2</span>
              Click the secure sign-in link
            </li>
            <li>
              <span>3</span>
              Not there? Check your spam folder
            </li>
          </ol>
          <button
            type="button"
            className="au-submit is-secondary"
            onClick={() => {
              setMessage(null);
            }}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form className="au-form" onSubmit={handleSubmit}>
          {error && (
            <AuthAlert tone="error">
              <CircleAlert size={16} aria-hidden="true" />
              {error}
            </AuthAlert>
          )}

          <AuthField
            label="Email address"
            icon={Mail}
            type="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />

          <button type="submit" className="au-submit" disabled={loading}>
            {loading ? (
              <LoaderCircle size={18} className="au-spin" aria-hidden="true" />
            ) : (
              <Send size={16} aria-hidden="true" />
            )}
            {loading ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
