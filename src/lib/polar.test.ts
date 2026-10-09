import test from "node:test";
import assert from "node:assert/strict";

import {
  polarCheckoutRef,
  polarOrderAmount,
  polarOrderRef,
  resolvePolarOrderTarget,
} from "./polar";

const product = (metadata: Record<string, string | number | boolean>) =>
  ({ metadata }) as unknown as NonNullable<Parameters<typeof resolvePolarOrderTarget>[0]["product"]>;

test("resolvePolarOrderTarget: product metadata maps the order", () => {
  const target = resolvePolarOrderTarget({
    metadata: {},
    product: product({ robot: "gold-multirange-4", tier: "10-days" }),
  });
  assert.deepEqual(target, { robotSlug: "gold-multirange-4", tierSlug: "10-days", refCode: null });
});

test("resolvePolarOrderTarget: checkout metadata wins over product metadata and carries ref", () => {
  const target = resolvePolarOrderTarget({
    metadata: { robot: "Precision-Trader", tier: "1-MONTH", ref: "ABC123" },
    product: product({ robot: "gold-multirange-4", tier: "10-days" }),
  });
  assert.deepEqual(target, { robotSlug: "precision-trader", tierSlug: "1-month", refCode: "ABC123" });
});

test("resolvePolarOrderTarget: refuses orders without a full mapping", () => {
  assert.equal(resolvePolarOrderTarget({ metadata: {}, product: null }), null);
  assert.equal(resolvePolarOrderTarget({ metadata: { robot: "goldbot" }, product: null }), null);
  assert.equal(resolvePolarOrderTarget({ metadata: { robot: " ", tier: "10-days" }, product: null }), null);
  assert.equal(resolvePolarOrderTarget({ metadata: { robot: 42, tier: "10-days" }, product: null }), null);
});

test("polarOrderRef: keyed on the checkout, falling back to the order id", () => {
  assert.equal(polarOrderRef({ id: "ord_1", checkout_id: "co_1" }), "POLAR-co_1");
  assert.equal(polarOrderRef({ id: "ord_1", checkout_id: null }), "POLAR-ord_1");
  assert.equal(polarCheckoutRef("co_1"), polarOrderRef({ id: "ord_1", checkout_id: "co_1" }));
});

test("polarOrderAmount: cents → dollars, currency upper-cased", () => {
  assert.deepEqual(polarOrderAmount({ net_amount: 1000, currency: "usd" }), { amount: 10, currency: "USD" });
  assert.deepEqual(polarOrderAmount({ net_amount: 0, currency: "usd" }), { amount: 0, currency: "USD" });
  assert.deepEqual(polarOrderAmount({ net_amount: 2999, currency: "eur" }), { amount: 29.99, currency: "EUR" });
});
