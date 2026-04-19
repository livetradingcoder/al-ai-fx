"use client";

import { useState } from "react";

import { Link } from "@/i18n/routing";

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
    <main className="main-content" style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, rgba(245, 158, 11, 0.08) 0%, transparent 50%), radial-gradient(ellipse at bottom, rgba(41, 98, 255, 0.06) 0%, transparent 50%)'
    }}>
      <div className="card-glass" style={{ width: "100%", maxWidth: "480px", padding: "48px 40px" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.75rem", textAlign: "center", fontWeight: 800 }}>Email Me a Magic Link</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "2.5rem", textAlign: "center", fontSize: "1.05rem" }}>
          Enter your email and we&apos;ll send you a secure sign-in link so you can access your GoldBot dashboard without resetting to a temporary password.
        </p>

        {!message ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <label style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: 600 }}>Email Address</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
              />
            </div>

            {error && <p style={{ color: "#ef4444", fontSize: "0.95rem", textAlign: "center", fontWeight: 600 }}>{error}</p>}

            <button
              type="submit"
              className="btn-primary fill"
              disabled={loading}
              style={{ marginTop: "0.5rem" }}
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>✉️</div>
            <p style={{ color: "#10b981", marginBottom: "2rem", fontSize: "1.05rem", fontWeight: 600 }}>{message}</p>
            <Link href="/login" className="btn-primary fill" style={{ textDecoration: "none", display: "inline-block", width: "100%" }}>
              Back to Login
            </Link>
          </div>
        )}

        <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.95rem" }}>
          <span style={{ color: "var(--text-muted)" }}>Prefer your password instead? </span>
          <Link href="/login" style={{ color: "var(--accent-primary)", textDecoration: "none", fontWeight: "600" }}>
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
