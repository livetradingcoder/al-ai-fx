import test from "node:test";
import assert from "node:assert/strict";
import { PricingTier } from "@prisma/client";
import {
  mapTier,
  computeExpirationDate,
  TIER_METADATA,
  UnknownTierError,
} from "./pricing-tiers";

test("every TierId slug maps to the correct PricingTier enum value (no silent downgrade)", () => {
  for (const [slug, meta] of Object.entries(TIER_METADATA)) {
    assert.equal(mapTier(slug), meta.enum, `${slug} → ${meta.enum}`);
  }
});

test("mapTier throws UnknownTierError on unknown input (regression: PRIC-02 default fallthrough)", () => {
  assert.throws(() => mapTier("not-a-real-tier"), UnknownTierError);
  assert.throws(() => mapTier(""), UnknownTierError);
  assert.throws(() => mapTier("monthly"), UnknownTierError); // old alias — no longer supported
});

test("mapTier normalises case and whitespace", () => {
  assert.equal(mapTier("  1-YEAR  "), PricingTier.ONE_YEAR);
  assert.equal(mapTier("Lifetime-Source"), PricingTier.LIFETIME_SOURCE);
});

test("1-year does NOT silently downgrade to ONE_MONTH (regression: PRIC-02)", () => {
  assert.equal(mapTier("1-year"), PricingTier.ONE_YEAR);
  const expiry = computeExpirationDate(PricingTier.ONE_YEAR);
  const daysOut = Math.round((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  assert.ok(daysOut >= 364 && daysOut <= 366, `expected ~365 days, got ${daysOut}`);
});

test("lifetime-source does NOT silently downgrade to ONE_MONTH (regression: PRIC-02)", () => {
  assert.equal(mapTier("lifetime-source"), PricingTier.LIFETIME_SOURCE);
});

test("10-days does NOT silently downgrade to ONE_MONTH (regression: PRIC-02)", () => {
  assert.equal(mapTier("10-days"), PricingTier.TEN_DAYS);
  const expiry = computeExpirationDate(PricingTier.TEN_DAYS);
  const daysOut = Math.round((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  assert.ok(daysOut >= 9 && daysOut <= 11, `expected ~10 days, got ${daysOut}`);
});

test("computeExpirationDate returns a far-future date for lifetime tiers", () => {
  const lifetimeExpiry = computeExpirationDate(PricingTier.LIFETIME);
  const yearsOut = Math.round((lifetimeExpiry.getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000));
  assert.ok(yearsOut >= 99 && yearsOut <= 101, `expected ~100 years, got ${yearsOut}`);
});

test("computeExpirationDate handles every enum value (compile-time exhaustiveness)", () => {
  for (const meta of Object.values(TIER_METADATA)) {
    // Must not throw the assertNever runtime guard.
    assert.ok(computeExpirationDate(meta.enum) instanceof Date);
  }
});
