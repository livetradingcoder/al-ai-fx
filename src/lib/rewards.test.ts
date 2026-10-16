import test from "node:test";
import assert from "node:assert/strict";

import { generateRewardCode, rewardExpiry, SHARE_REWARD_DAYS } from "./rewards";

test("reward codes have a fixed shape and avoid look-alike characters", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateRewardCode();
    assert.match(code, /^GB-[A-HJKMNP-Z2-9]{8}$/);
  }
});

test("reward codes are not repeated across a reasonable sample", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) seen.add(generateRewardCode());
  assert.equal(seen.size, 2000);
});

test("a deterministic random source gives a deterministic code", () => {
  assert.equal(generateRewardCode(() => 0), "GB-AAAAAAAA");
});

test("the code expires after the reward window", () => {
  const from = new Date("2026-10-18T00:00:00Z");
  assert.equal(rewardExpiry(from).getTime() - from.getTime(), SHARE_REWARD_DAYS * 86_400_000);
});
