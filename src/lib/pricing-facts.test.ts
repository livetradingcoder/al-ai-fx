import test from "node:test";
import assert from "node:assert/strict";
import { PricingTier } from "@prisma/client";

import { buildPricingCatalog } from "./pricing-catalog";
import { buildPricingFacts } from "./pricing-facts";
import { FIXTURE_FACTS, FIXTURE_ROWS, NO_CATALOG_FACTS } from "./pricing-test-fixtures";

const factsFor = (rows: typeof FIXTURE_ROWS) => buildPricingFacts(buildPricingCatalog(rows, "gold-multirange-4"));

test("the trial sentence names each robot's trial, its length and its price, flagship first", () => {
  assert.equal(
    FIXTURE_FACTS.trialsSentence,
    "Gold MultiRange 4 has a 7-day trial for $1.99, PrecisionTrader has a 3-day trial for $0.99 and GoldBot Double Range has a 3-day free trial with no card.",
  );
  assert.equal(FIXTURE_FACTS.hasPaidTrial, true);
  assert.equal(FIXTURE_FACTS.hasFreeTrial, true);
  assert.equal(FIXTURE_FACTS.cheapestPaidTrial, "$0.99");
});

test("the answer to 'is there a free trial?' leads with the truth for the catalog it was built from", () => {
  assert.match(FIXTURE_FACTS.trialAnswer, /^Yes\. /);

  const onlyPaid = factsFor(FIXTURE_ROWS.filter((r) => r.slug !== "goldbot"));
  assert.match(onlyPaid.trialAnswer, /^Not free, but cheap\. /);
  assert.match(onlyPaid.trialFeeNote, /maintenance costs/);
  assert.equal(onlyPaid.hasFreeTrial, false);

  const onlyFree = factsFor(FIXTURE_ROWS.filter((r) => r.slug === "goldbot"));
  assert.equal(onlyFree.trialFeeNote, "", "no fee, so nothing to explain");
  assert.equal(onlyFree.cheapestPaidTrial, null);

  const none = factsFor(
    FIXTURE_ROWS.map((r) => ({ ...r, prices: r.prices.filter((p) => p.tier !== PricingTier.FREE_TRIAL) })),
  );
  assert.equal(none.trialAnswer, "No robot has a trial on offer right now.");
});

test("the flagship's plans carry the catalog's prices", () => {
  assert.deepEqual(
    FIXTURE_FACTS.flagship?.plans.map((p) => [p.title, p.price, p.period]),
    [
      ["10 Days", "$39", "for 10 days"],
      ["Monthly", "$99", "per month"],
      ["Biannual", "$449", "per 6 months"],
      ["1 Year", "$799", "for 1 year"],
    ],
  );
  assert.equal(factsFor(FIXTURE_ROWS.filter((r) => r.slug !== "gold-multirange-4")).flagship, null);
});

test("with no catalog the facts say nothing a price could contradict", () => {
  const everything = JSON.stringify(NO_CATALOG_FACTS);
  assert.ok(!/\$\d/.test(everything), everything);
  assert.equal(NO_CATALOG_FACTS.flagship, null);
  assert.equal(NO_CATALOG_FACTS.cheapestPaidTrial, null);
});
