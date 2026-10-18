import test from "node:test";
import assert from "node:assert/strict";

import { buildComingSoonProducts, buildContactOffers } from "./pricing-showcase";

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
