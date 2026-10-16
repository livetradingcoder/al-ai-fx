import test from "node:test";
import assert from "node:assert/strict";

import { rewardCheckoutPath } from "./reward-links";

test("the reward link carries only the code, so it never points at a retired robot or plan", () => {
  assert.equal(rewardCheckoutPath("GB-K7M2QX9P"), "/checkout?coupon=GB-K7M2QX9P");
  assert.ok(!rewardCheckoutPath("GB-K7M2QX9P").includes("robot="));
  assert.ok(!rewardCheckoutPath("GB-K7M2QX9P").includes("tier="));
});

test("odd characters in a code are escaped", () => {
  assert.equal(rewardCheckoutPath("A B&C"), "/checkout?coupon=A%20B%26C");
});
