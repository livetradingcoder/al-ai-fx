import test from "node:test";
import assert from "node:assert/strict";

import { changeAllowance, changeFee, FREE_CHANGES_PER_USER, MIN_CHANGE_FEE } from "./mt5-changes";

test("the fee is half the plan price, to the cent, and never below the card minimum", () => {
  assert.equal(changeFee(67), 33.5);
  assert.equal(changeFee(349), 174.5);
  assert.equal(changeFee(39.99), 20);
  assert.equal(changeFee(6), 3);
  assert.equal(changeFee(1), MIN_CHANGE_FEE);
  assert.equal(changeFee(0), MIN_CHANGE_FEE);
});

// Just enough of the Prisma client for changeAllowance.
function fakeDb(freeUsed: number, credits: { id: string }[]) {
  const seen: unknown[] = [];
  const db = {
    mt5AccountChange: { count: async (args: unknown) => (seen.push(args), freeUsed) },
    mt5ChangeCredit: { findFirst: async (args: unknown) => (seen.push(args), credits[0] ?? null) },
  };
  return { db: db as never, seen };
}

test("the first change is free; the second needs a credit; a credit is spent on its own licence", async () => {
  assert.equal(FREE_CHANGES_PER_USER, 1);
  const input = { userId: "u1", subscriptionId: "s1" };

  assert.deepEqual(await changeAllowance(fakeDb(0, []).db, input), { kind: "free" });
  assert.deepEqual(await changeAllowance(fakeDb(1, []).db, input), { kind: "payment" });
  assert.deepEqual(await changeAllowance(fakeDb(1, [{ id: "c1" }]).db, input), { kind: "credit", creditId: "c1" });
});

test("only changes that took the free allowance count against it, and credits are looked up per licence", async () => {
  const { db, seen } = fakeDb(1, []);
  await changeAllowance(db, { userId: "u1", subscriptionId: "s9" });
  assert.deepEqual(seen[0], { where: { userId: "u1", creditId: null } });
  assert.deepEqual((seen[1] as { where: unknown }).where, {
    userId: "u1",
    subscriptionId: "s9",
    change: { is: null },
  });
});
