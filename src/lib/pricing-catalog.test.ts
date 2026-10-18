import test from "node:test";
import assert from "node:assert/strict";
import { PricingTier } from "@prisma/client";

import {
  buildPricingCatalog,
  fillTemplate,
  formatUsd,
  ladderInversions,
  rangeCount,
  type PricingRobotRow,
} from "./pricing-catalog";

const row = (
  slug: string,
  name: string,
  prices: [PricingTier, number][],
  sortOrder = 0,
  badge: string | null = null,
): PricingRobotRow => ({
  slug,
  name,
  shortDescription: `${name} description`,
  badge,
  sortOrder,
  prices: prices.map(([tier, amount]) => ({ tier, amount })),
});

const MULTIRANGE_4 = row(
  "gold-multirange-4",
  "Gold MultiRange 4",
  [
    [PricingTier.FREE_TRIAL, 1.99],
    [PricingTier.TEN_DAYS, 39],
    [PricingTier.ONE_MONTH, 99],
    [PricingTier.SIX_MONTHS, 449],
    [PricingTier.ONE_YEAR, 799],
  ],
  1,
  "Prop firm compatible",
);
// PrecisionTrader as it was priced when this was written ($9 / 10 days, $39 /
// month, $179, $399): the ladder is upside down, a year costs more per day than
// ten days. Kept as it is because the page must show the database as it is.
const PRECISION = row(
  "precision-trader",
  "PrecisionTrader",
  [
    [PricingTier.FREE_TRIAL, 0.99],
    [PricingTier.TEN_DAYS, 9],
    [PricingTier.ONE_MONTH, 39],
    [PricingTier.SIX_MONTHS, 179],
    [PricingTier.ONE_YEAR, 399],
  ],
  0,
);

test("every robot with something to buy is listed, in catalog order, and the flagship is selected first", () => {
  const catalog = buildPricingCatalog([MULTIRANGE_4, PRECISION], "gold-multirange-4");

  assert.ok(catalog);
  assert.deepEqual(
    catalog.robots.map((r) => r.slug),
    ["precision-trader", "gold-multirange-4"],
  );
  assert.equal(catalog.defaultSlug, "gold-multirange-4");
  assert.equal(catalog.robots[1].flagship, true);
  assert.equal(catalog.robots[1].badge, "Prop firm compatible");
});

test("without the flagship on sale the first robot is selected", () => {
  const catalog = buildPricingCatalog([PRECISION], "gold-multirange-4");
  assert.equal(catalog?.defaultSlug, "precision-trader");
});

test("a robot with no active price is coming soon and is left out; no robots at all gives null", () => {
  const soon = row("gold-multirange-7", "Gold MultiRange 7", []);
  assert.deepEqual(
    buildPricingCatalog([PRECISION, soon], "x")?.robots.map((r) => r.slug),
    ["precision-trader"],
  );
  assert.equal(buildPricingCatalog([soon], "x"), null);
  assert.equal(buildPricingCatalog([], "x"), null);
});

test("plan prices are the database prices, with the per-day and per-month figures worked out from them", () => {
  const plans = buildPricingCatalog([MULTIRANGE_4], "gold-multirange-4")!.robots[0].plans;

  assert.deepEqual(
    plans.map((p) => [p.tier, p.amount, p.days]),
    [
      ["10-days", 39, 10],
      ["1-month", 99, 30],
      ["6-months", 449, 182],
      ["1-year", 799, 365],
    ],
  );
  assert.deepEqual(
    plans.map((p) => p.perDay),
    [3.9, 3.3, 2.47, 2.19],
  );
  assert.deepEqual(
    plans.map((p) => p.perMonth),
    [null, null, 74.83, 66.58],
  );
});

test("a well-ordered ladder gets a saving on the half-year and year only", () => {
  const plans = buildPricingCatalog([MULTIRANGE_4], "x")!.robots[0].plans;

  assert.deepEqual(ladderInversions(plans), []);
  for (let i = 1; i < plans.length; i++) assert.ok(plans[i].perDay < plans[i - 1].perDay, plans[i].tier);
  assert.deepEqual(
    plans.map((p) => p.savingsPercent),
    [null, null, 25, 34],
  );
});

test("an upside-down ladder is shown as it is, claims no saving it doesn't have, and is reported", () => {
  const plans = buildPricingCatalog([PRECISION], "x")!.robots[0].plans;

  assert.deepEqual(
    plans.map((p) => p.amount),
    [9, 39, 179, 399],
  );
  // Savings are measured against the monthly plan, so they stay true even here: 6 months is 24% under a month per day,
  // a year 16%. The year is nonetheless dearer per day than 6 months, which is what the inversions below report.
  assert.deepEqual(
    plans.map((p) => p.savingsPercent),
    [null, null, 24, 16],
  );
  assert.deepEqual(
    ladderInversions(plans).map((i) => [i.shorter, i.longer]),
    [
      ["10-days", "1-month"],
      ["6-months", "1-year"],
    ],
  );
});

test("one plan is highlighted when there is a choice: the year, else the half-year, else the month", () => {
  const popular = (r: PricingRobotRow) =>
    buildPricingCatalog([r], "x")!.robots[0].plans.filter((p) => p.popular).map((p) => p.tier);

  assert.deepEqual(popular(MULTIRANGE_4), ["1-year"]);
  assert.deepEqual(
    popular(row("a", "A", [[PricingTier.ONE_MONTH, 10], [PricingTier.SIX_MONTHS, 50]])),
    ["6-months"],
  );
  assert.deepEqual(popular(row("b", "B", [[PricingTier.ONE_MONTH, 10], [PricingTier.TEN_DAYS, 4]])), ["1-month"]);
  // Nothing is "most popular" among a single plan.
  assert.deepEqual(popular(row("c", "C", [[PricingTier.ONE_MONTH, 10]])), []);
});

test("the trial price sets its length: $0.99 is 3 days, $1.99 is 7, $0 is the free trial", () => {
  const trial = (price: number) =>
    buildPricingCatalog([row("t", "T", [[PricingTier.FREE_TRIAL, price], [PricingTier.ONE_MONTH, 20]])], "x")!.robots[0].trial;

  assert.deepEqual(trial(0), { amount: 0, days: 3, free: true });
  assert.deepEqual(trial(0.99), { amount: 0.99, days: 3, free: false });
  assert.deepEqual(trial(1.99), { amount: 1.99, days: 7, free: false });
  assert.equal(buildPricingCatalog([row("n", "N", [[PricingTier.ONE_MONTH, 20]])], "x")!.robots[0].trial, null);
});

test("a plan priced at zero is not shown, and the trial is never counted as a plan", () => {
  const stray = row("s", "S", [
    [PricingTier.FREE_TRIAL, 1.99],
    [PricingTier.TEN_DAYS, 0],
    [PricingTier.ONE_MONTH, 20],
  ]);
  const robot = buildPricingCatalog([stray], "x")!.robots[0];

  assert.deepEqual(
    robot.plans.map((p) => p.tier),
    ["1-month"],
  );
  assert.equal(robot.trial?.amount, 1.99);
});

test("contact-only and internal tiers never reach the page", () => {
  const robot = buildPricingCatalog(
    [
      row("x", "X", [
        [PricingTier.ONE_MONTH, 20],
        [PricingTier.LIFETIME, 9999],
        [PricingTier.LIFETIME_SOURCE, 99999],
        [PricingTier.SECRET_TEST_TIER, 10],
      ]),
    ],
    "x",
  )!.robots[0];
  assert.deepEqual(
    robot.plans.map((p) => p.tier),
    ["1-month"],
  );
});

test("the range count comes from the robot's name, and says nothing when the name doesn't", () => {
  assert.equal(rangeCount("Gold MultiRange 4"), 4);
  assert.equal(rangeCount("Gold MultiRange 6 Aggressive"), 6);
  assert.equal(rangeCount("GoldBot Double Range"), 2);
  assert.equal(rangeCount("Gold Breakout Conservative"), 1);
  assert.equal(rangeCount("PrecisionTrader"), 1);
  assert.equal(rangeCount("Sniper Lite"), null);
});

test("money shows cents only when there are some, and templates fill their blanks", () => {
  assert.equal(formatUsd(99), "$99");
  assert.equal(formatUsd(1.99), "$1.99");
  assert.equal(formatUsd(0.99), "$0.99");
  assert.equal(formatUsd(1799), "$1,799");
  assert.equal(formatUsd(66.58), "$66.58");
  assert.equal(fillTemplate("Get {name} for {price}", { name: "X", price: "$1" }), "Get X for $1");
  assert.equal(fillTemplate("{missing} stays", {}), "{missing} stays");
});
