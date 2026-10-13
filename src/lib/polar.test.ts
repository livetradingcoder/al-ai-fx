import test from "node:test";
import assert from "node:assert/strict";

import {
  polarBuyerDetails,
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
  assert.deepEqual(target, {
    robotSlug: "gold-multirange-4",
    tierSlug: "10-days",
    refCode: null,
    couponCode: null,
  });
});

test("resolvePolarOrderTarget: checkout metadata wins over product metadata and carries ref + coupon", () => {
  const target = resolvePolarOrderTarget({
    metadata: { robot: "Precision-Trader", tier: "1-MONTH", ref: "ABC123", coupon: "LAUNCH50" },
    product: product({ robot: "gold-multirange-4", tier: "10-days" }),
  });
  assert.deepEqual(target, {
    robotSlug: "precision-trader",
    tierSlug: "1-month",
    refCode: "ABC123",
    couponCode: "LAUNCH50",
  });
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

const buyerOrder = (over: Record<string, unknown>) =>
  ({
    billing_name: null,
    billing_address: null,
    customer: { name: null, billing_address: null },
    ...over,
  }) as unknown as Parameters<typeof polarBuyerDetails>[0];

test("polarBuyerDetails: splits the billing name and reads the address", () => {
  assert.deepEqual(
    polarBuyerDetails(
      buyerOrder({
        billing_name: "  Ana Maria de Souza ",
        billing_address: { city: "Lisbon", state: null, postal_code: "1000-001", country: "PT" },
      }),
    ),
    {
      firstName: "Ana",
      lastName: "Maria de Souza",
      city: "Lisbon",
      state: undefined,
      zip: "1000-001",
      country: "PT",
    },
  );
});

test("polarBuyerDetails: falls back to the customer's name and address, and survives having neither", () => {
  assert.deepEqual(
    polarBuyerDetails(
      buyerOrder({ customer: { name: "Cher", billing_address: { country: "US", postal_code: "94043" } } }),
    ),
    { firstName: "Cher", lastName: undefined, city: undefined, state: undefined, zip: "94043", country: "US" },
  );
  assert.deepEqual(polarBuyerDetails(buyerOrder({})), {
    firstName: undefined,
    lastName: undefined,
    city: undefined,
    state: undefined,
    zip: undefined,
    country: undefined,
  });
});
