"use client";

import { useState } from "react";
import Link from "next/link";

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
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "450px", margin: "6rem auto" }}>
      <div className="glass-panel" style={{ padding: "3rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem", textAlign: "center" }}>Reset Password</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", textAlign: "center", fontSize: "0.9rem" }}>
          Enter your email and we'll send you a temporary password to regain access to your account.
        </p>

        {!message ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Email Address</label>
              <input
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {error && <p style={{ color: "#fca5a5", fontSize: "0.85rem", textAlign: "center" }}>{error}</p>}

            <button
              type="submit"
              className="btn-primary fill"
              disabled={loading}
              style={{ marginTop: "1rem" }}
            >
              {loading ? "Sending..." : "Send Reset Email"}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✉️</div>
            <p style={{ color: "#4ade80", marginBottom: "1.5rem" }}>{message}</p>
            <Link href="/login" className="btn-primary fill" style={{ textDecoration: "none", display: "inline-block", width: "100%" }}>
              Back to Login
            </Link>
          </div>
        )}

        <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.9rem" }}>
          <span>Remember your password? </span>
          <Link href="/login" style={{ color: "var(--accent-primary)", textDecoration: "none", fontWeight: "600" }}>
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
