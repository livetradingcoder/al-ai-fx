"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import {
  CONSENT_OPEN_EVENT,
  CONSENT_STORAGE_KEY,
  consentState,
  parseConsentChoice,
  type ConsentChoice,
} from "@/lib/consent";

// gtag's consent commands must reach the dataLayer as an `arguments` object;
// a plain array is ignored by Google tags.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function pushConsentUpdate(..._args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

const CONSENT_CHANGE_EVENT = "al:consent-change";

function readStoredChoice(): ConsentChoice | "none" {
  try {
    return parseConsentChoice(window.localStorage.getItem(CONSENT_STORAGE_KEY)) ?? "none";
  } catch {
    return "none";
  }
}

function subscribeToChoice(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export default function ConsentBanner() {
  const t = useTranslations("Consent");
  // "unknown" on the server keeps the banner out of the static HTML; the
  // client then shows it only if no choice is stored.
  const stored = useSyncExternalStore(subscribeToChoice, readStoredChoice, () => "unknown");
  // Set by "Cookie settings" (open) or a click (closed); it wins over storage
  // so the banner also stays shut where localStorage can't be written.
  const [override, setOverride] = useState<"open" | "closed" | null>(null);

  useEffect(() => {
    const reopen = () => setOverride("open");
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  function choose(choice: ConsentChoice) {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    } catch {
      // Private mode: the choice still applies to this page view.
    }
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));

    pushConsentUpdate("consent", "update", consentState(choice));
    window.dataLayer?.push({ event: "consent_update", consent_choice: choice });
    window.fbq?.("consent", choice === "granted" ? "grant" : "revoke");
    setOverride("closed");
  }

  const isOpen = override ? override === "open" : stored === "none";

  if (!isOpen) {
    return null;
  }

  return (
    <div className="consent-banner" role="dialog" aria-live="polite" aria-label={t("title")}>
      <p className="consent-banner-text">
        <strong>{t("title")}</strong> {t("body")}{" "}
        <Link href="/privacy-policy">{t("learnMore")}</Link>
      </p>
      <div className="consent-banner-actions">
        <button type="button" className="btn-secondary" onClick={() => choose("denied")}>
          {t("reject")}
        </button>
        <button type="button" className="btn-primary" onClick={() => choose("granted")}>
          {t("accept")}
        </button>
      </div>
    </div>
  );
}

export function CookieSettingsButton() {
  const t = useTranslations("Consent");

  return (
    <button
      type="button"
      className="footer-link-button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
    >
      {t("settings")}
    </button>
  );
}
