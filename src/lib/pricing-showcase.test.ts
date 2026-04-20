import test from "node:test";
import assert from "node:assert/strict";

import {
  buildComingSoonProducts,
  buildContactOffers,
  buildPassPlans,
  buildSubscriptionPlans,
} from "./pricing-showcase";

type TranslatorValues = {
  fallback?: string;
  price?: string;
};

const t = (_key: string, values?: TranslatorValues) => {
  if (values?.price) {
    return `(${values.price} / month)`;
  }

  return values?.fallback ?? _key;
};

test("subscription plans keep the yearly plan featured", () => {
  const plans = buildSubscriptionPlans(t);
  const featuredPlan = plans.find((plan) => plan.featured);

  assert.equal(plans.length, 4);
  assert.equal(featuredPlan?.id, "1-year");
  assert.deepEqual(
    plans.map((plan) => plan.price),
    ["$69", "$199", "$999", "$1,799"],
  );
  assert.equal(plans[2]?.note, "($167 / month)");
  assert.equal(plans[3]?.note, "($149.92 / month)");
});

test("pass plans keep only the free trial public", () => {
  const plans = buildPassPlans(t);

  assert.deepEqual(
    plans.map((plan) => plan.id),
    ["free-trial"],
  );
  assert.equal(plans[0]?.price, "$0");
});

test("coming soon products are ordered for the next gold expansion wave", () => {
  const products = buildComingSoonProducts(t);

  assert.deepEqual(
    products.map((product) => product.title),
    ["GoldGap", "GoldBot for TradingView", "GoldBot for cTrader"],
  );
  assert.deepEqual(
    products.map((product) => product.status),
    ["Coming Soon", "Signal Stack", "Execution Stack"],
  );
});

test("contact offers replace public lifetime pricing with concierge paths", () => {
  const offers = buildContactOffers(t);

  assert.deepEqual(
    offers.map((offer) => offer.title),
    ["Lifetime Access", "Source Code Licensing", "Private Deployment"],
  );
  assert.deepEqual(
    offers.map((offer) => offer.cta),
    ["Contact Us", "Contact Us", "Contact Us"],
  );
});
