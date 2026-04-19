"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import { Link } from "@/i18n/routing";

export default function MagicLoginPage() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";
  const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const missingToken = !token;

  useEffect(() => {
    if (missingToken) {
      return;
    }

    void signIn("magic-link", {
      token,
      callbackUrl,
      redirect: true,
    }).catch(() => {
      setError("This sign-in link is invalid or expired. Request a fresh one.");
    });
  }, [callbackUrl, missingToken, token]);

  return (
    <main
      className="main-content"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <div className="card-glass" style={{ width: "100%", maxWidth: "520px", padding: "3rem" }}>
        <h1 style={{ textAlign: "center", marginBottom: "1rem", fontSize: "2.25rem" }}>
          Signing you in
        </h1>
        <p style={{ textAlign: "center", color: "var(--text-secondary)", lineHeight: 1.7 }}>
          We are securely opening your GoldBot dashboard now.
        </p>
        {missingToken || error ? (
          <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
            <p style={{ color: "#fca5a5", marginBottom: "1rem" }}>
              {missingToken
                ? "This sign-in link is missing a token. Request a fresh link."
                : error}
            </p>
            <Link href="/forgot-password" className="btn-primary">
              Request a new sign-in link
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
