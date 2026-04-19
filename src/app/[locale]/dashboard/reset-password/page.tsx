"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function ForceResetPassword() {
  const t = useTranslations("Auth");
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
      setError(t("errPassLength"));
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError(t("errPassLower"));
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError(t("errPassUpper"));
      return;
    }

    if (!/\d/.test(password)) {
      setError(t("errPassNumber"));
      return;
    }

    if (!/[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      setError(t("errPassSpecial"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("errPassMismatch"));
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
        setError(data.error || t("errPassFailed"));
      }
    } catch {
      setError(t("unexpectedError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "450px", margin: "4rem auto" }}>
      <div className="glass-panel" style={{ padding: "3rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem", textAlign: "center" }}>{t("resetYourPassword")}</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", textAlign: "center", fontSize: "0.9rem" }}>
          {t("resetPasswordSubtitle")}
        </p>

        <div style={{ 
          background: "var(--bg-secondary)", 
          padding: "1rem", 
          borderRadius: "var(--radius-sm)", 
          marginBottom: "1.5rem",
          border: "1px solid var(--border-color)"
        }}>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem", fontWeight: "600" }}>
            {t("passRequirements")}:
          </p>
          <ul style={{ fontSize: "0.8rem", color: "var(--text-muted)", paddingLeft: "1.5rem", margin: 0 }}>
            <li>{t("reqLength")}</li>
            <li>{t("reqUpper")}</li>
            <li>{t("reqLower")}</li>
            <li>{t("reqNumber")}</li>
            <li>{t("reqSpecial")}</li>
          </ul>
        </div>

        <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{t("newPassword")}</label>
            <input
              type="password"
              placeholder={t("min8Chars")}
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
            <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{t("confirmNewPassword")}</label>
            <input
              type="password"
              placeholder={t("repeatPassword")}
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
            {loading ? t("updating") : t("updatePasswordContinue")}
          </button>
        </form>
      </div>
    </div>
  );
}
