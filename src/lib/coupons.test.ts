import test from "node:test";
import assert from "node:assert/strict";

import { emailBlockedByRestriction } from "./coupons";

test("an unrestricted code works for any email, or none", () => {
  assert.equal(emailBlockedByRestriction(null, "a@b.co"), false);
  assert.equal(emailBlockedByRestriction(null, undefined), false);
});

test("a restricted code works only for its own email, ignoring case and spaces", () => {
  assert.equal(emailBlockedByRestriction("a@b.co", "a@b.co"), false);
  assert.equal(emailBlockedByRestriction("A@B.co", "  a@b.CO "), false);
  assert.equal(emailBlockedByRestriction("a@b.co", "x@y.co"), true);
});

test("a restricted code with no email to compare fails closed", () => {
  assert.equal(emailBlockedByRestriction("a@b.co", undefined), true);
  assert.equal(emailBlockedByRestriction("a@b.co", null), true);
  assert.equal(emailBlockedByRestriction("a@b.co", "  "), true);
});
