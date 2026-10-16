import test from "node:test";
import assert from "node:assert/strict";

import { cleanDisplayName, pickRewardSubscription, rewardProgress } from "./proof-portal";

test("keeps a plain first name or handle", () => {
  assert.equal(cleanDisplayName("Amina"), "Amina");
  assert.equal(cleanDisplayName("  Trader   Joe "), "Trader Joe");
});

test("drops anything that looks like an email or an account number", () => {
  assert.equal(cleanDisplayName("me@mail.com"), null);
  assert.equal(cleanDisplayName("MT5 26252623"), null);
  assert.equal(cleanDisplayName("12345"), null);
});

test("strips markup and control characters and caps the length", () => {
  assert.equal(cleanDisplayName("<b>Sam</b>\u0000"), "bSam/b");
  assert.equal(cleanDisplayName("x".repeat(100))?.length, 40);
});

test("empty and non-string input gives no name", () => {
  assert.equal(cleanDisplayName(""), null);
  assert.equal(cleanDisplayName("   "), null);
  assert.equal(cleanDisplayName(null), null);
  assert.equal(cleanDisplayName(12), null);
});

test("the reward licence is the newest one with MT5 linked, else the newest", () => {
  const subs = [
    { id: "new", mt5AccountNumber: null },
    { id: "linked", mt5AccountNumber: "26252623" },
    { id: "old", mt5AccountNumber: "11111" },
  ];
  assert.equal(pickRewardSubscription(subs)?.id, "linked");
  assert.equal(pickRewardSubscription([{ id: "a", mt5AccountNumber: "  " }, { id: "b", mt5AccountNumber: null }])?.id, "a");
  assert.equal(pickRewardSubscription([]), null);
});

const proof = (status: "PENDING" | "APPROVED" | "REJECTED") => ({
  id: "p", status, createdAt: "2026-10-16T00:00:00Z", published: false, adminNote: null,
});
const coupon = { code: "GB-AAAAAAAA", percent: 25, expiresAt: null };
const share = (withCoupon: boolean) => ({
  status: withCoupon ? ("APPROVED" as const) : ("PENDING" as const), platform: "X", url: "https://x.com/a/status/1", adminNote: null,
  coupon: withCoupon ? coupon : null,
});

test("progress counts link, results and share when promotions are offered", () => {
  assert.deepEqual(rewardProgress({ linked: false, proofs: [], share: null, promoEligible: true }), { done: 0, total: 3, percent: 0 });
  assert.deepEqual(rewardProgress({ linked: true, proofs: [], share: null, promoEligible: true }), { done: 1, total: 3, percent: 33 });
  assert.deepEqual(rewardProgress({ linked: true, proofs: [proof("PENDING")], share: share(false), promoEligible: true }), { done: 2, total: 3, percent: 67 });
  assert.deepEqual(rewardProgress({ linked: true, proofs: [proof("APPROVED")], share: share(true), promoEligible: true }), { done: 3, total: 3, percent: 100 });
});

test("a rejected screenshot does not count, and the share step drops out where promotions are off", () => {
  assert.equal(rewardProgress({ linked: true, proofs: [proof("REJECTED")], share: null, promoEligible: true }).done, 1);
  assert.deepEqual(rewardProgress({ linked: true, proofs: [proof("APPROVED")], share: null, promoEligible: false }), { done: 2, total: 2, percent: 100 });
});
