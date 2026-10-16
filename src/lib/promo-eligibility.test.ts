import test from "node:test";
import assert from "node:assert/strict";

import {
  blockedCountries,
  isPromoBlockedCountry,
  isPromoBlockedLocale,
  promoEligibilityForRequest,
} from "./promo-eligibility";

test("the default list blocks the restricted markets and nothing else we care about", () => {
  const blocked = blockedCountries(undefined);
  for (const c of ["PK", "IN", "BD", "AE", "SA", "EG"]) assert.equal(isPromoBlockedCountry(c, blocked), true, c);
  for (const c of ["NG", "KE", "ZA", "DE", "ES", "NL", "UG", "US"]) assert.equal(isPromoBlockedCountry(c, blocked), false, c);
});

test("the env var overrides the default, and empty switches the gate off", () => {
  const custom = blockedCountries("ng, ke ,x1,,toolong");
  assert.deepEqual([...custom].sort(), ["KE", "NG"]);
  assert.equal(blockedCountries("").size, 0);
  assert.equal(isPromoBlockedCountry("PK", blockedCountries("")), false);
});

test("country matching is case-insensitive and tolerates missing values", () => {
  const blocked = blockedCountries(undefined);
  assert.equal(isPromoBlockedCountry("pk", blocked), true);
  assert.equal(isPromoBlockedCountry(null, blocked), false);
  assert.equal(isPromoBlockedCountry(undefined, blocked), false);
});

test("the restricted languages are blocked, the rest are not", () => {
  for (const l of ["ar", "hi", "ur", "bn", "AR"]) assert.equal(isPromoBlockedLocale(l), true, l);
  for (const l of ["en", "es", "de", null, undefined]) assert.equal(isPromoBlockedLocale(l), false, String(l));
});

test("a request in a blocked locale is refused before any lookup", async () => {
  const r = await promoEligibilityForRequest(new Request("https://x.test/"), "ur");
  assert.deepEqual(r, { eligible: false, country: null, reason: "locale" });
});

test("a request we cannot place is allowed", async () => {
  const r = await promoEligibilityForRequest(new Request("https://x.test/", { headers: { "x-forwarded-for": "10.0.0.5" } }), "en");
  assert.equal(r.eligible, true);
  assert.equal(r.country, null);
});
