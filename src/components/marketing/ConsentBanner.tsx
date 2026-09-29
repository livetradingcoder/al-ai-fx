"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Cookie } from "lucide-react";

import { Link } from "@/i18n/routing";
import {
  CONSENT_OPEN_EVENT,
  CONSENT_STORAGE_KEY,
  consentState,
  parseConsentChoice,
  type ConsentChoice,
} from "@/lib/consent";
import "./consent-banner.css";

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

  // Non-modal: the page stays usable, and focus is left where it is.
  return (
    <section className="cb" role="region" aria-label={t("title")} aria-live="polite">
      <div className="cb-head">
        <span className="cb-icon" aria-hidden="true">
          <Cookie size={18} />
        </span>
        <strong className="cb-title">{t("title")}</strong>
      </div>
      <p className="cb-text">
        {t("body")} <Link href="/privacy-policy">{t("learnMore")}</Link>
      </p>
      {/* Equal-weight buttons: rejecting must be as easy as accepting. */}
      <div className="cb-actions">
        <button type="button" className="cb-btn" onClick={() => choose("denied")}>
          {t("reject")}
        </button>
        <button type="button" className="cb-btn is-primary" onClick={() => choose("granted")}>
          {t("accept")}
        </button>
      </div>
    </section>
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
