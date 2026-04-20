import test from "node:test";
import assert from "node:assert/strict";

import { buildPassPlans, buildSubscriptionPlans } from "./pricing-showcase";

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
});

test("pass plans include the free trial card before paid lifetime options", () => {
  const plans = buildPassPlans(t);

  assert.deepEqual(
    plans.map((plan) => plan.id),
    ["free-trial", "lifetime", "lifetime-source"],
  );
  assert.equal(plans[0]?.price, "$0");
});
