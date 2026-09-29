"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, CircleAlert, LoaderCircle, Lock, ShieldCheck, X } from "lucide-react";

import { AuthAlert, AuthField, AuthShell } from "@/components/auth/AuthShell";

// One list drives both the live checklist and submit validation, so what the
// user sees ticked is exactly what is enforced.
const RULES = [
  { key: "length", test: (p: string) => p.length >= 12, label: "reqLength", error: "errPassLength" },
  { key: "upper", test: (p: string) => /[A-Z]/.test(p), label: "reqUpper", error: "errPassUpper" },
  { key: "lower", test: (p: string) => /[a-z]/.test(p), label: "reqLower", error: "errPassLower" },
  { key: "number", test: (p: string) => /\d/.test(p), label: "reqNumber", error: "errPassNumber" },
  {
    key: "special",
    test: (p: string) => /[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(p),
    label: "reqSpecial",
    error: "errPassSpecial",
  },
] as const;

export default function ForceResetPassword() {
  const t = useTranslations("Auth");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const met = RULES.map((rule) => rule.test(password));
  const score = met.filter(Boolean).length;
  const matches = confirmPassword.length > 0 && confirmPassword === password;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const failed = RULES.find((rule) => !rule.test(password));
    if (failed) {
      setError(t(failed.error));
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
    <AuthShell
      compact
      icon={ShieldCheck}
      eyebrow="Account security"
      title={t("resetYourPassword")}
      subtitle={t("resetPasswordSubtitle")}
    >
      <form className="au-form" onSubmit={handleReset}>
        {error && (
          <AuthAlert tone="error">
            <CircleAlert size={16} aria-hidden="true" />
            {error}
          </AuthAlert>
        )}

        <AuthField
          label={t("newPassword")}
          icon={Lock}
          type="password"
          placeholder={t("min8Chars")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          autoFocus
        />

        <div className="au-strength" aria-label={t("passRequirements")}>
          <div className={`au-strength-bar is-${score}`} aria-hidden="true">
            {RULES.map((rule) => (
              <span key={rule.key} />
            ))}
          </div>
          <ul className="au-checklist">
            {RULES.map((rule, index) => (
              <li key={rule.key} className={met[index] ? "is-met" : ""}>
                {met[index] ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
                {t(rule.label)}
              </li>
            ))}
          </ul>
        </div>

        <AuthField
          label={t("confirmNewPassword")}
          icon={Lock}
          type="password"
          placeholder={t("repeatPassword")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
          hint={
            confirmPassword.length > 0 ? (
              <span style={{ color: matches ? "var(--au-up)" : "var(--au-down)" }}>
                {matches ? "Passwords match" : t("errPassMismatch")}
              </span>
            ) : undefined
          }
        />

        <button type="submit" className="au-submit" disabled={loading}>
          {loading ? (
            <LoaderCircle size={18} className="au-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck size={18} aria-hidden="true" />
          )}
          {loading ? t("updating") : t("updatePasswordContinue")}
        </button>
      </form>
    </AuthShell>
  );
}
