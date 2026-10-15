import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import { createUnsubscribeToken, verifyUnsubscribeToken } from "./marketing-unsubscribe";
import {
  buildReminderOptOutUrl,
  createReminderOptOutToken,
  verifyReminderOptOutToken,
} from "./reminder-optout";

process.env.NEXTAUTH_SECRET = "test-secret-for-reminder-optout";
process.env.NEXTAUTH_URL = "https://www.al-ai-fx.xyz";

test("an opt-out token round-trips the user id", () => {
  const token = createReminderOptOutToken("user_123");
  assert.equal(verifyReminderOptOutToken(token), "user_123");
});

test("the URL carries a token that verifies", () => {
  const url = new URL(buildReminderOptOutUrl("user_456"));
  assert.equal(url.origin + url.pathname, "https://www.al-ai-fx.xyz/api/reminders/unsubscribe");
  assert.equal(verifyReminderOptOutToken(url.searchParams.get("token") ?? ""), "user_456");
});

test("a newsletter unsubscribe token is not a reminder opt-out, and the reverse", () => {
  assert.equal(verifyReminderOptOutToken(createUnsubscribeToken("someone@example.com")), null);
  assert.equal(verifyUnsubscribeToken(createReminderOptOutToken("user_123")), null);
});

test("a tampered, foreign-signed, expired or garbage token is refused", () => {
  const good = createReminderOptOutToken("user_123");
  assert.equal(verifyReminderOptOutToken(`${good}x`), null);
  assert.equal(verifyReminderOptOutToken(jwt.sign({ userId: "user_123", purpose: "mt5-reminder-optout" }, "another-secret")), null);
  assert.equal(
    verifyReminderOptOutToken(
      jwt.sign({ userId: "user_123", purpose: "mt5-reminder-optout" }, process.env.NEXTAUTH_SECRET!, { expiresIn: -10 }),
    ),
    null,
  );
  assert.equal(verifyReminderOptOutToken("not-a-token"), null);
  assert.equal(verifyReminderOptOutToken(""), null);
});

test("without a secret nothing is issued and nothing verifies", () => {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = createReminderOptOutToken("user_123");
  delete process.env.NEXTAUTH_SECRET;
  try {
    assert.throws(() => createReminderOptOutToken("user_123"), /NEXTAUTH_SECRET/);
    assert.equal(verifyReminderOptOutToken(token), null);
  } finally {
    process.env.NEXTAUTH_SECRET = secret;
  }
});
