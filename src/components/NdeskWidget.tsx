"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useSession } from "next-auth/react";

/**
 * nDesk support chat.
 *
 * The site key is public by design — nDesk refuses to start the widget on any
 * domain that is not on the workspace allowlist, so the key alone is worth
 * nothing to anyone who copies it. The ADMIN key (sk_…) is a different thing
 * entirely and must never appear in anything shipped to a browser.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_NDESK_SITE_KEY ?? "pk_kC_4aQun_qeOOqdGQTPfU4jV";

declare global {
  interface Window {
    ChatWidget?: (action: string, payload?: Record<string, unknown>) => void;
  }
}

export default function NdeskWidget() {
  const { data: session, status } = useSession();

  // Tell the widget who it is talking to, so a signed-in customer skips the
  // pre-chat form and support sees the account behind the question. The loader
  // is async, so ChatWidget may not exist yet when this runs — poll briefly
  // rather than racing it, and give up instead of spinning forever.
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;

    let attempts = 0;
    const timer = setInterval(() => {
      if (window.ChatWidget) {
        clearInterval(timer);
        window.ChatWidget("identify", {
          name: session.user.name ?? undefined,
          email: session.user.email ?? undefined,
          externalUserId: session.user.id,
        });
      } else if (++attempts > 25) {
        clearInterval(timer);
      }
    }, 400);

    return () => clearInterval(timer);
  }, [session, status]);

  return (
    <Script
      src="https://cdn.ndesk.chat/loader.js"
      data-site-key={SITE_KEY}
      strategy="afterInteractive"
    />
  );
}
