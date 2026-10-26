import test from "node:test";
import assert from "node:assert/strict";

import { drawableEntries, PAID_TRIAL_BONUS, pickWinner } from "./giveaway";

test("pickWinner returns null for an empty or zero-weight pool", () => {
  assert.equal(pickWinner([]), null);
  assert.equal(pickWinner([{ id: "a", weight: 0 }]), null);
});

test("pickWinner walks the weighted ranges", () => {
  const pool = [
    { id: "a", weight: 1 },
    { id: "b", weight: 3 },
    { id: "c", weight: 2 },
  ];
  // total 6: ticket 0 -> a, 1..3 -> b, 4..5 -> c
  assert.equal(pickWinner(pool, () => 0), "a");
  assert.equal(pickWinner(pool, () => 1), "b");
  assert.equal(pickWinner(pool, () => 3), "b");
  assert.equal(pickWinner(pool, () => 4), "c");
  assert.equal(pickWinner(pool, () => 5), "c");
});

test("pickWinner's tickets are drawn from the full weight", () => {
  let asked = 0;
  pickWinner([{ id: "a", weight: 2 }, { id: "b", weight: 5 }], (max) => { asked = max; return 0; });
  assert.equal(asked, 7);
});

test("every entry can win, in proportion to its weight", () => {
  const pool = [{ id: "a", weight: 1 }, { id: "b", weight: 4 }];
  const wins: Record<string, number> = { a: 0, b: 0 };
  for (let ticket = 0; ticket < 5; ticket++) wins[pickWinner(pool, () => ticket)!]++;
  assert.deepEqual(wins, { a: 1, b: 4 });
});

test("drawable entries weigh 1 plus bonus and drop countries on the block list", () => {
  const saved = process.env.PROMO_BLOCKED_COUNTRIES;
  process.env.PROMO_BLOCKED_COUNTRIES = "PK";
  try {
    const out = drawableEntries([
      { id: "ng", email: "ng@x.co", bonusEntries: 0, country: "NG" },
      { id: "ke", email: "ke@x.co", bonusEntries: 2, country: "KE" },
      { id: "pk", email: "pk@x.co", bonusEntries: 2, country: "PK" },
      { id: "none", email: "none@x.co", bonusEntries: 0, country: null },
      { id: "neg", email: "neg@x.co", bonusEntries: -3, country: "DE" },
    ]);
    assert.deepEqual(out, [
      { id: "ng", weight: 1 },
      { id: "ke", weight: 3 },
      { id: "none", weight: 1 },
      { id: "neg", weight: 1 },
    ]);
  } finally {
    if (saved === undefined) delete process.env.PROMO_BLOCKED_COUNTRIES;
    else process.env.PROMO_BLOCKED_COUNTRIES = saved;
  }
});

test("with the country gate off (the default) nobody is dropped for their country", () => {
  const saved = process.env.PROMO_BLOCKED_COUNTRIES;
  delete process.env.PROMO_BLOCKED_COUNTRIES;
  try {
    const out = drawableEntries([
      { id: "pk", email: "pk@x.co", bonusEntries: 1, country: "PK" },
      { id: "in", email: "in@x.co", bonusEntries: 0, country: "IN" },
    ]);
    assert.deepEqual(out, [
      { id: "pk", weight: 2 },
      { id: "in", weight: 1 },
    ]);
  } finally {
    if (saved !== undefined) process.env.PROMO_BLOCKED_COUNTRIES = saved;
  }
});

test("a paid trial adds PAID_TRIAL_BONUS chances, matched on the email without case", () => {
  const saved = process.env.PROMO_BLOCKED_COUNTRIES;
  delete process.env.PROMO_BLOCKED_COUNTRIES;
  try {
    const out = drawableEntries(
      [
        { id: "paid", email: "Paid@X.co", bonusEntries: 1, country: "DE" },
        { id: "free", email: "free@x.co", bonusEntries: 0, country: "DE" },
      ],
      new Set(["paid@x.co"]),
    );
    assert.deepEqual(out, [
      { id: "paid", weight: 2 + PAID_TRIAL_BONUS },
      { id: "free", weight: 1 },
    ]);
    assert.equal(PAID_TRIAL_BONUS, 9);
  } finally {
    if (saved !== undefined) process.env.PROMO_BLOCKED_COUNTRIES = saved;
  }
});
