import test from "node:test";
import assert from "node:assert/strict";

import { cleanDisplayName } from "./proof-portal";

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
