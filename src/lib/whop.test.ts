import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  WHOP_SOURCE,
  isWhopPaid,
  resolveWhopPaymentTarget,
  verifyWhopWebhook,
  whopOrderRef,
  whopPaymentAmount,
  whopProductId,
} from "./whop";

const SECRET = "ws_test_secret_value";
const NOW = 1_800_000_000;

function sign(id: string, ts: number, body: string, secret = SECRET) {
  return `v1,${createHmac("sha256", secret).update(`${id}.${ts}.${body}`).digest("base64")}`;
}

test("verifyWhopWebhook: Standard Webhooks HMAC over id.timestamp.body", () => {
  const body = '{"type":"payment.succeeded","data":{"id":"pay_1"}}';
  const headers = { id: "msg_1", timestamp: String(NOW), signature: sign("msg_1", NOW, body) };
  assert.equal(verifyWhopWebhook(SECRET, body, headers, NOW), true);
  assert.equal(verifyWhopWebhook(SECRET, body + " ", headers, NOW), false, "raw body must match byte for byte");
  assert.equal(verifyWhopWebhook("ws_other", body, headers, NOW), false);
  assert.equal(verifyWhopWebhook(SECRET, body, { ...headers, id: "msg_2" }, NOW), false, "id is part of the signed content");
  assert.equal(verifyWhopWebhook(SECRET, body, { ...headers, signature: "v1,AAAA" }, NOW), false, "wrong length never throws");
  assert.equal(verifyWhopWebhook(SECRET, body, { ...headers, signature: null }, NOW), false);
  assert.equal(verifyWhopWebhook(SECRET, body, { ...headers, id: null }, NOW), false);
});

test("verifyWhopWebhook: any of several space-separated signatures may match; version must be v1", () => {
  const body = "{}";
  const good = sign("msg_1", NOW, body);
  const headers = { id: "msg_1", timestamp: String(NOW), signature: `v1,bogus ${good}` };
  assert.equal(verifyWhopWebhook(SECRET, body, headers, NOW), true);
  assert.equal(
    verifyWhopWebhook(SECRET, body, { ...headers, signature: good.replace("v1,", "v2,") }, NOW),
    false,
  );
});

test("verifyWhopWebhook: refuses timestamps more than 5 minutes off", () => {
  const body = "{}";
  const old = NOW - 301;
  const stale = { id: "msg_1", timestamp: String(old), signature: sign("msg_1", old, body) };
  assert.equal(verifyWhopWebhook(SECRET, body, stale, NOW), false);
  const recent = NOW - 299;
  const ok = { id: "msg_1", timestamp: String(recent), signature: sign("msg_1", recent, body) };
  assert.equal(verifyWhopWebhook(SECRET, body, ok, NOW), true);
  assert.equal(verifyWhopWebhook(SECRET, body, { ...ok, timestamp: "not-a-number" }, NOW), false);
});

test("resolveWhopPaymentTarget: only payments carrying our source marker and mapping", () => {
  const meta = { source: WHOP_SOURCE, order_ref: "abc", robot: "Gold-MultiRange-4", tier: "10-DAYS", email: "Buyer@Example.com", ref: "R1", coupon: "C1" };
  assert.deepEqual(resolveWhopPaymentTarget({ metadata: meta, customer_email: "other@example.com" }), {
    orderRef: "abc",
    robotSlug: "gold-multirange-4",
    tierSlug: "10-days",
    email: "buyer@example.com",
    refCode: "R1",
    couponCode: "C1",
  });
  // falls back to the email Whop collected
  assert.equal(
    resolveWhopPaymentTarget({ metadata: { ...meta, email: undefined }, customer_email: "Paid@Example.com" })?.email,
    "paid@example.com",
  );
  // payments from other apps/products in the same company are not ours
  assert.equal(resolveWhopPaymentTarget({ metadata: { product: "pro" }, customer_email: "x@y.z" }), null);
  assert.equal(resolveWhopPaymentTarget({ metadata: { ...meta, source: "someone-else" } }), null);
  assert.equal(resolveWhopPaymentTarget({ metadata: { ...meta, order_ref: "" } }), null);
  assert.equal(resolveWhopPaymentTarget({ metadata: null }), null);
});

test("whopPaymentAmount: decimal-string Money in major units, currency upper-cased", () => {
  assert.deepEqual(whopPaymentAmount({ total: { amount: "29.00", currency: "usd" } }), { amount: 29, currency: "USD" });
  assert.deepEqual(whopPaymentAmount({ total: { amount: "0.00", currency: "usd" } }), { amount: 0, currency: "USD" });
  assert.deepEqual(whopPaymentAmount({ total: { amount: 14.5 }, currency: "eur" }), { amount: 14.5, currency: "EUR" });
  assert.equal(whopPaymentAmount({ total: null }), null);
  assert.equal(whopPaymentAmount({ total: { amount: "-1" } }), null);
});

test("isWhopPaid: only a paid/succeeded payment fulfils", () => {
  assert.equal(isWhopPaid({ status: "paid", substatus: "succeeded" }), true);
  assert.equal(isWhopPaid({}), true, "the succeeded event itself is enough when status is absent");
  assert.equal(isWhopPaid({ status: "open" }), false);
  assert.equal(isWhopPaid({ status: "paid", substatus: "refunded" }), false);
});

test("whopProductId: per-robot map wins, then the shared product", () => {
  const prev = { json: process.env.WHOP_PRODUCTS_JSON, id: process.env.WHOP_PRODUCT_ID };
  try {
    process.env.WHOP_PRODUCT_ID = "prod_shared";
    process.env.WHOP_PRODUCTS_JSON = JSON.stringify({ "gold-multirange-4": "prod_gold" });
    assert.equal(whopProductId("gold-multirange-4"), "prod_gold");
    assert.equal(whopProductId("precision-trader"), "prod_shared");
    process.env.WHOP_PRODUCTS_JSON = "{not json";
    assert.equal(whopProductId("gold-multirange-4"), "prod_shared");
    delete process.env.WHOP_PRODUCT_ID;
    assert.equal(whopProductId("gold-multirange-4"), null);
  } finally {
    if (prev.json === undefined) delete process.env.WHOP_PRODUCTS_JSON; else process.env.WHOP_PRODUCTS_JSON = prev.json;
    if (prev.id === undefined) delete process.env.WHOP_PRODUCT_ID; else process.env.WHOP_PRODUCT_ID = prev.id;
  }
});

test("whopOrderRef: prefixed so it can share Order.paygateId with other providers", () => {
  assert.equal(whopOrderRef("abc"), "WHOP-abc");
});
