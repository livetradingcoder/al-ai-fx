import test from "node:test";
import assert from "node:assert/strict";

import {
  CONSENT_REQUIRED_REGIONS,
  buildConsentDefaultsScript,
  consentState,
  parseConsentChoice,
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

test("the defaults script denies in the EEA before granting elsewhere", () => {
  const script = buildConsentDefaultsScript();
  const deniedAt = script.indexOf('"analytics_storage":"denied","region"');
  const grantedAt = script.indexOf('"analytics_storage":"granted"');

  assert.ok(deniedAt > 0 && grantedAt > deniedAt);
  assert.ok(!script.includes("window.gtag"));
});
