// Consent Mode v2 for the Tag Manager container. The defaults run inline in
// <head> before GTM loads, so every Google tag starts out with the right
// consent state; the banner then records the visitor's choice.

export const CONSENT_STORAGE_KEY = "al_consent_v1";
export const CONSENT_OPEN_EVENT = "al:open-consent";

export type ConsentChoice = "granted" | "denied";

// EEA, UK and Switzerland: storage is denied until the visitor accepts.
// Everywhere else Google tags run as before unless the visitor rejects.
export const CONSENT_REQUIRED_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
];

export function consentState(choice: ConsentChoice) {
  return {
    ad_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
    analytics_storage: choice,
  };
}

export function parseConsentChoice(value: string | null | undefined): ConsentChoice | null {
  return value === "granted" || value === "denied" ? value : null;
}

/**
 * The inline script that sets the consent defaults, then re-applies a choice
 * the visitor already made on an earlier visit. It uses a local gtag() rather
 * than window.gtag so Google Ads code elsewhere can't be confused by it.
 */
export function buildConsentDefaultsScript() {
  const denied = JSON.stringify({
    ...consentState("denied"),
    region: CONSENT_REQUIRED_REGIONS,
    wait_for_update: 500,
  });
  const granted = JSON.stringify(consentState("granted"));

  return `(function(){window.dataLayer=window.dataLayer||[];function g(){dataLayer.push(arguments);}
g('consent','default',${denied});
g('consent','default',${granted});
g('set','ads_data_redaction',true);
try{var c=localStorage.getItem('${CONSENT_STORAGE_KEY}');if(c==='granted'||c==='denied'){g('consent','update',{ad_storage:c,ad_user_data:c,ad_personalization:c,analytics_storage:c});}}catch(e){}
})();`;
}
