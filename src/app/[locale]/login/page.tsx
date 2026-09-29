"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CircleAlert, LoaderCircle, Lock, LogIn, Mail } from "lucide-react";

import { Link } from "@/i18n/routing";
import { AuthAlert, AuthField, AuthShell } from "@/components/auth/AuthShell";

// Only same-site paths are honoured, so ?callbackUrl= can't bounce a
// freshly signed-in user to another host.
function safeCallback(raw: string | null, fallback: string) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

// NextAuth reports failures as codes; blocked/deleted accounts throw their
// own readable message from authorize(), which is passed through as-is.
function describeError(code: string | null | undefined, fallback: string) {
  if (!code) return null;
  if (code === "CredentialsSignin") return "Incorrect email or password.";
  if (code === "SessionRequired") return "Please sign in to continue.";
  if (/restricted|deleted/i.test(code)) return code;
  return fallback;
}

function LoginForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const fallback = locale === "en" ? "/dashboard" : `/${locale}/dashboard`;
  const callbackUrl = safeCallback(searchParams?.get("callbackUrl") ?? null, fallback);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    describeError(searchParams?.get("error"), t("unexpectedError")),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (!res || res.error) {
        setError(describeError(res?.error ?? "unknown", t("unexpectedError")));
        setLoading(false);
        return;
      }
      // Full navigation so the new session is picked up everywhere.
      window.location.assign(callbackUrl);
    } catch {
      setError(t("unexpectedError"));
      setLoading(false);
    }
  };

  return (
    <AuthShell
      icon={LogIn}
      eyebrow={t("secureLogin")}
      title="Welcome back"
      subtitle={t("accessDashboard")}
      footer={
        <>
          {t("noAccount")} <Link href="/#pricing">{t("buyGoldBot")}</Link>
        </>
      }
    >
      <form className="au-form" onSubmit={handleSubmit} noValidate={false}>
        {error && (
          <AuthAlert tone="error">
            <CircleAlert size={16} aria-hidden="true" />
            {error}
          </AuthAlert>
        )}

        <AuthField
          label={t("email")}
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@domain.com"
          autoComplete="email"
          required
          autoFocus
        />

        <AuthField
          label={t("password")}
          icon={Lock}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          trailing={<Link href="/forgot-password">{t("forgotPassword")}</Link>}
        />

        <button type="submit" className="au-submit" disabled={loading}>
          {loading ? (
            <LoaderCircle size={18} className="au-spin" aria-hidden="true" />
          ) : (
            <ArrowRight size={18} aria-hidden="true" />
          )}
          {loading ? "Signing in…" : t("signIn")}
        </button>

        <div className="au-divider">or</div>

        <Link href="/forgot-password" className="au-submit is-secondary">
          <Mail size={16} aria-hidden="true" />
          Email me a magic link
        </Link>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
