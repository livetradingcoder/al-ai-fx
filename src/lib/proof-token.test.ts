import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import { createReminderOptOutToken } from "./reminder-optout";
import { buildProofPortalUrl, createProofToken, verifyProofToken } from "./proof-token";

process.env.NEXTAUTH_SECRET = "test-secret-for-proof-token";
process.env.NEXTAUTH_URL = "https://www.al-ai-fx.xyz";

test("a proof token round-trips the user and licence", () => {
  const token = createProofToken({ userId: "u1", subscriptionId: "s1" });
  assert.deepEqual(verifyProofToken(token), { userId: "u1", subscriptionId: "s1" });
});

test("a token with another purpose does not verify here", () => {
  assert.equal(verifyProofToken(createReminderOptOutToken("u1")), null);
  const forged = jwt.sign({ userId: "u1", subscriptionId: "s1", purpose: "login" }, process.env.NEXTAUTH_SECRET!);
  assert.equal(verifyProofToken(forged), null);
});

test("a token signed with another secret, an expired token and junk are all refused", () => {
  const other = jwt.sign({ userId: "u1", subscriptionId: "s1", purpose: "results-portal" }, "other-secret");
  assert.equal(verifyProofToken(other), null);
  const expired = jwt.sign(
    { userId: "u1", subscriptionId: "s1", purpose: "results-portal" },
    process.env.NEXTAUTH_SECRET!,
    { expiresIn: -10 },
  );
  assert.equal(verifyProofToken(expired), null);
  assert.equal(verifyProofToken("not-a-token"), null);
  assert.equal(verifyProofToken(""), null);
});

test("a token missing the licence does not verify", () => {
  const partial = jwt.sign({ userId: "u1", purpose: "results-portal" }, process.env.NEXTAUTH_SECRET!);
  assert.equal(verifyProofToken(partial), null);
});

test("the portal url carries a verifiable token", () => {
  const url = new URL(buildProofPortalUrl({ userId: "u1", subscriptionId: "s1" }));
  assert.equal(url.origin + url.pathname, "https://www.al-ai-fx.xyz/results/submit");
  assert.deepEqual(verifyProofToken(url.searchParams.get("token")!), { userId: "u1", subscriptionId: "s1" });
});

test("without a secret nothing is issued and nothing verifies", () => {
  const saved = process.env.NEXTAUTH_SECRET;
  const token = createProofToken({ userId: "u1", subscriptionId: "s1" });
  delete process.env.NEXTAUTH_SECRET;
  assert.throws(() => createProofToken({ userId: "u1", subscriptionId: "s1" }));
  assert.equal(verifyProofToken(token), null);
  process.env.NEXTAUTH_SECRET = saved;
});
