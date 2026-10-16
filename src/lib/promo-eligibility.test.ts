import test from "node:test";
import assert from "node:assert/strict";

import {
  blockedCountries,
  isPromoBlockedCountry,
  isPromoBlockedLocale,
  promoEligibilityForRequest,
} from "./promo-eligibility";

test("the country gate is off unless the env var lists countries", () => {
  const blocked = blockedCountries(undefined);
  assert.equal(blocked.size, 0);
  for (const c of ["PK", "IN", "BD", "NG", "KE", "ZA", "DE", "ES", "US"]) {
    assert.equal(isPromoBlockedCountry(c, blocked), false, c);
  }
});

test("the env var turns the country gate on for the countries it lists", () => {
  const listed = blockedCountries("PK,IN");
  assert.equal(isPromoBlockedCountry("PK", listed), true);
  assert.equal(isPromoBlockedCountry("NG", listed), false);
});

test("the env var parses codes loosely, and empty means off", () => {
  const custom = blockedCountries("ng, ke ,x1,,toolong");
  assert.deepEqual([...custom].sort(), ["KE", "NG"]);
  assert.equal(blockedCountries("").size, 0);
  assert.equal(isPromoBlockedCountry("PK", blockedCountries("")), false);
});

test("country matching is case-insensitive and tolerates missing values", () => {
  const blocked = blockedCountries("PK");
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
