"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { KeyRound, LoaderCircle, Send, TriangleAlert } from "lucide-react";

import { Link } from "@/i18n/routing";
import { AuthShell } from "@/components/auth/AuthShell";

function MagicLogin() {
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

  const failed = missingToken || Boolean(error);

  return (
    <AuthShell
      icon={KeyRound}
      eyebrow="Magic link"
      title={failed ? "This link didn't work" : "Signing you in"}
    >
      <div className="au-status">
        {failed ? (
          <>
            <span className="au-status-icon is-error" aria-hidden="true">
              <TriangleAlert size={30} />
            </span>
            <p>
              {missingToken
                ? "This sign-in link is missing a token. Request a fresh link."
                : error}
            </p>
            <Link href="/forgot-password" className="au-submit">
              <Send size={16} aria-hidden="true" />
              Request a new sign-in link
            </Link>
          </>
        ) : (
          <>
            <span className="au-status-icon is-pending" aria-hidden="true">
              <LoaderCircle size={30} className="au-spin" />
            </span>
            <p role="status">We are securely opening your GoldBot dashboard now.</p>
          </>
        )}
      </div>
    </AuthShell>
  );
}

export default function MagicLoginPage() {
  return (
    <Suspense fallback={null}>
      <MagicLogin />
    </Suspense>
  );
}
