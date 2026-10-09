import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  callbackSignaturePayload,
  isOxapayPaid,
  oxapayOrderRef,
  signCallbackParams,
  verifyCallbackParams,
  verifyOxapayBody,
  type CallbackParams,
} from "./oxapay";

const KEY = "merchant-key-for-tests";
const params: CallbackParams = {
  order_ref: "11111111-2222-3333-4444-555555555555",
  email: "buyer@example.com",
  robot: "gold-multirange-4",
  tier: "10-days",
  amount: "29.00",
};

test("verifyOxapayBody: HMAC-SHA512 hex of the raw body, keyed with the merchant key", () => {
  const body = '{"track_id":"151811887","status":"Paid","type":"invoice","order_id":"abc"}';
  const sig = createHmac("sha512", KEY).update(body).digest("hex");
  assert.equal(verifyOxapayBody(KEY, body, sig), true);
  assert.equal(verifyOxapayBody(KEY, body, sig.toUpperCase()), true, "hex case does not matter");
  assert.equal(verifyOxapayBody(KEY, body + " ", sig), false, "body must match byte for byte");
  assert.equal(verifyOxapayBody("other-key", body, sig), false);
  assert.equal(verifyOxapayBody(KEY, body, null), false);
  assert.equal(verifyOxapayBody(KEY, body, "deadbeef"), false, "wrong length never throws");
});

test("callback params: payload order is order_ref, email, robot, tier, amount", () => {
  assert.equal(
    callbackSignaturePayload(params),
    "11111111-2222-3333-4444-555555555555buyer@example.comgold-multirange-410-days29.00",
  );
});

test("callback params: signature round-trips and binds every field", () => {
  const sig = signCallbackParams(KEY, params);
  assert.equal(verifyCallbackParams(KEY, params, sig), true);
  assert.equal(verifyCallbackParams(KEY, { ...params, tier: "lifetime" }, sig), false, "tier swap");
  assert.equal(verifyCallbackParams(KEY, { ...params, robot: "precision-trader" }, sig), false, "robot swap");
  assert.equal(verifyCallbackParams(KEY, { ...params, email: "x@example.com" }, sig), false, "email swap");
  assert.equal(verifyCallbackParams(KEY, { ...params, amount: "0.00" }, sig), false, "amount swap");
  assert.equal(verifyCallbackParams("other-key", params, sig), false);
  assert.equal(verifyCallbackParams(KEY, params, undefined), false);
});

test("isOxapayPaid: only 'paid', in any case; 'paying' is not fulfilment", () => {
  assert.equal(isOxapayPaid("Paid"), true);
  assert.equal(isOxapayPaid("paid"), true);
  assert.equal(isOxapayPaid("Paying"), false);
  assert.equal(isOxapayPaid("underpaid"), false);
  assert.equal(isOxapayPaid("expired"), false);
  assert.equal(isOxapayPaid(undefined), false);
  assert.equal(isOxapayPaid(1), false);
});

test("oxapayOrderRef: prefixed so it can share Order.paygateId with other providers", () => {
  assert.equal(oxapayOrderRef("abc"), "OXAPAY-abc");
});
