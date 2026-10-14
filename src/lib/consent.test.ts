import test from "node:test";
import assert from "node:assert/strict";

import {
  CONSENT_REQUIRED_REGIONS,
  buildAskFirstScript,
  buildConsentDefaultsScript,
  consentState,
  effectiveConsentChoice,
  parseConsentChoice,
  timeZoneRequiresConsent,
} from "./consent";

test("consentState sets all four Consent Mode v2 signals", () => {
  assert.deepEqual(consentState("denied"), {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
});

test("parseConsentChoice only accepts a stored choice", () => {
  assert.equal(parseConsentChoice("granted"), "granted");
  assert.equal(parseConsentChoice("denied"), "denied");
  assert.equal(parseConsentChoice("yes"), null);
  assert.equal(parseConsentChoice(null), null);
});

test("the EEA list covers the EU, EEA, UK and Switzerland", () => {
  assert.equal(CONSENT_REQUIRED_REGIONS.length, 32);
  for (const code of ["DE", "ES", "NO", "GB", "CH"]) {
    assert.ok(CONSENT_REQUIRED_REGIONS.includes(code), code);
  }
});

test("European time zones are asked first; the rest of the world is not", () => {
  for (const tz of ["Europe/Berlin", "Europe/London", "Atlantic/Canary", "Atlantic/Reykjavik", "GB", null, ""]) {
    assert.equal(timeZoneRequiresConsent(tz), true, String(tz));
  }
  for (const tz of ["Asia/Karachi", "Asia/Manila", "Asia/Kuala_Lumpur", "Africa/Lagos", "Africa/Johannesburg", "Africa/Nairobi", "America/New_York"]) {
    assert.equal(timeZoneRequiresConsent(tz), false, tz);
  }
});

test("a stored choice always wins over the regional default", () => {
  assert.equal(effectiveConsentChoice(null, "Asia/Karachi"), "granted");
  assert.equal(effectiveConsentChoice(null, "Europe/Paris"), null);
  assert.equal(effectiveConsentChoice("denied", "Asia/Karachi"), "denied");
  assert.equal(effectiveConsentChoice("granted", "Europe/Paris"), "granted");
});

test("the inline snippet applies the same rule as timeZoneRequiresConsent", () => {
  const askFirstFor = (tz: string) =>
    new Function(
      "Intl",
      `${buildAskFirstScript()};return askFirst;`,
    )({ DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: tz }) }) }) as boolean;

  for (const tz of ["Europe/Madrid", "Atlantic/Madeira", "Asia/Manila", "Africa/Lagos", ""]) {
    assert.equal(askFirstFor(tz), timeZoneRequiresConsent(tz), tz);
  }
});

test("the defaults script denies in the EEA before granting elsewhere", () => {
  const script = buildConsentDefaultsScript();
  const deniedAt = script.indexOf('"analytics_storage":"denied","region"');
  const grantedAt = script.indexOf('"analytics_storage":"granted"');

  assert.ok(deniedAt > 0 && grantedAt > deniedAt);
  assert.ok(!script.includes("window.gtag"));
});
