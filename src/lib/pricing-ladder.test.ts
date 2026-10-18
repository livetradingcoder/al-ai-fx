import test from "node:test";
import assert from "node:assert/strict";

import { PRICING_TIERS, type TierId } from "@/config/pricing";
import { TIER_METADATA } from "./pricing-tiers";

// The plans in the order they get longer. A buyer must never do better by
// choosing a shorter plan: the longer one has to win on price per day.
const LADDER: TierId[] = ["10-days", "1-month", "6-months", "1-year"];

function days(tier: TierId): number {
  const { durationDays } = TIER_METADATA[tier];
  assert.equal(typeof durationDays, "number", `${tier} has a fixed length`);
  return durationDays as number;
}

const perDay = (tier: TierId) => PRICING_TIERS[tier].amount / days(tier);

test("every longer plan costs less per day than the one before it", () => {
  for (let i = 1; i < LADDER.length; i++) {
    const shorter = LADDER[i - 1];
    const longer = LADDER[i];
    assert.ok(
      perDay(longer) < perDay(shorter),
      `${longer} ($${perDay(longer).toFixed(2)}/day) must undercut ${shorter} ($${perDay(shorter).toFixed(2)}/day)`,
    );
  }
});

test("a longer plan is never dearer than buying the shorter one on repeat", () => {
  // 3 x 10 days, 6 x 1 month, 2 x 6 months: each covers (roughly) the longer plan.
  assert.ok(PRICING_TIERS["1-month"].amount < 3 * PRICING_TIERS["10-days"].amount);
  assert.ok(PRICING_TIERS["6-months"].amount < 6 * PRICING_TIERS["1-month"].amount);
  assert.ok(PRICING_TIERS["1-year"].amount < 2 * PRICING_TIERS["6-months"].amount);
});

test("the prices the site shows match the defaults a new robot starts from", () => {
  for (const tier of LADDER) {
    assert.equal(PRICING_TIERS[tier].amount, TIER_METADATA[tier].amount, tier);
    assert.equal(PRICING_TIERS[tier].priceString, TIER_METADATA[tier].priceString, tier);
  }
});
