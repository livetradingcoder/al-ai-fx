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

    // Client-side validation
    if (password.length < 12) {
      setError("Password must be at least 12 characters long.");
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter.");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }

    if (!/\d/.test(password)) {
      setError("Password must contain at least one number.");
      return;
    }

    if (!/[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      setError("Password must contain at least one special character.");
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

        <div style={{ 
          background: "var(--bg-secondary)", 
          padding: "1rem", 
          borderRadius: "var(--radius-sm)", 
          marginBottom: "1.5rem",
          border: "1px solid var(--border-color)"
        }}>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem", fontWeight: "600" }}>
            Password Requirements:
          </p>
          <ul style={{ fontSize: "0.8rem", color: "var(--text-muted)", paddingLeft: "1.5rem", margin: 0 }}>
            <li>At least 12 characters long</li>
            <li>One uppercase letter (A-Z)</li>
            <li>One lowercase letter (a-z)</li>
            <li>One number (0-9)</li>
            <li>One special character (@$!%*?&#, etc.)</li>
          </ul>
        </div>

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
