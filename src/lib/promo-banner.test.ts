import test from "node:test";
import assert from "node:assert/strict";

import { couponLabel, couponShowable, safeSitePath, suggestedBannerMessage } from "./promo-banner";

const NOW = new Date("2026-10-18T12:00:00Z");
const ok = {
  kind: "PERCENT",
  active: true,
  expiresAt: null as Date | null,
  maxRedemptions: null as number | null,
  redeemedCount: 0,
  restrictedEmail: null as string | null,
};

test("an ordinary live code can be shown", () => {
  assert.equal(couponShowable(ok, NOW), true);
  assert.equal(couponShowable({ ...ok, kind: "FIXED", expiresAt: new Date("2026-12-01T00:00:00Z") }, NOW), true);
});

test("a free-licence code is never advertised", () => {
  assert.equal(couponShowable({ ...ok, kind: "FREE" }, NOW), false);
});

test("a code reserved for one person is never advertised", () => {
  assert.equal(couponShowable({ ...ok, restrictedEmail: "a@b.co" }, NOW), false);
});

test("switched off, expired and used-up codes are hidden", () => {
  assert.equal(couponShowable({ ...ok, active: false }, NOW), false);
  assert.equal(couponShowable({ ...ok, expiresAt: new Date("2026-10-18T11:59:59Z") }, NOW), false);
  assert.equal(couponShowable({ ...ok, expiresAt: NOW }, NOW), false);
  assert.equal(couponShowable({ ...ok, maxRedemptions: 5, redeemedCount: 5 }, NOW), false);
  assert.equal(couponShowable({ ...ok, maxRedemptions: 5, redeemedCount: 4 }, NOW), true);
});

test("labels read as an offer", () => {
  assert.equal(couponLabel("PERCENT", 30), "30% off");
  assert.equal(couponLabel("FIXED", 5), "$5 off");
  assert.equal(couponLabel("FREE", 100), "");
});

test("link targets must stay on this site", () => {
  assert.equal(safeSitePath("/catalog", "/x"), "/catalog");
  assert.equal(safeSitePath("/checkout?coupon=A", "/x"), "/checkout?coupon=A");
  for (const bad of ["https://evil.example", "//evil.example", "javascript:alert(1)", "catalog", "/a\\b", "", null, undefined, "/" + "a".repeat(250)]) {
    assert.equal(safeSitePath(bad as string | null | undefined, "/x"), "/x", String(bad));
  }
});

test("a one-click banner message reads naturally, with or without a label", () => {
  assert.equal(suggestedBannerMessage("30% off"), "30% off at checkout");
  assert.equal(suggestedBannerMessage(""), "Discount code");
});
