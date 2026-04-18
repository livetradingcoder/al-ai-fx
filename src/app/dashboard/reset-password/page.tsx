"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForceResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(data.error || "Failed to update password.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "450px", margin: "4rem auto" }}>
      <div className="glass-panel" style={{ padding: "3rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem", textAlign: "center" }}>Reset Your Password</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", textAlign: "center", fontSize: "0.9rem" }}>
          For security reasons, you must change your temporary password before accessing your dashboard.
        </p>

        <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>New Password</label>
            <input
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                padding: "1rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Confirm New Password</label>
            <input
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                padding: "1rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
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
            {loading ? "Updating..." : "Update Password & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
