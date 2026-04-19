import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMagicLinkUrl,
  createMagicLinkToken,
  verifyMagicLinkToken,
} from "./magic-links";

test("createMagicLinkToken round-trips the payload", () => {
  const token = createMagicLinkToken(
    {
      email: "test@example.com",
      purpose: "login",
      userId: "user_123",
    },
    "secret",
    "15m",
  );

  const payload = verifyMagicLinkToken(token, "secret");

  assert.equal(payload.email, "test@example.com");
  assert.equal(payload.purpose, "login");
  assert.equal(payload.userId, "user_123");
});

test("buildMagicLinkUrl keeps the default locale unprefixed", () => {
  const url = buildMagicLinkUrl({
    baseUrl: "https://www.al-ai-fx.xyz",
    locale: "en",
    token: "abc",
  });

  assert.equal(url, "https://www.al-ai-fx.xyz/magic-login?token=abc");
});

test("buildMagicLinkUrl prefixes non-default locales and preserves callback", () => {
  const url = buildMagicLinkUrl({
    baseUrl: "https://www.al-ai-fx.xyz",
    callbackUrl: "/dashboard/licenses",
    locale: "de",
    token: "abc",
  });

  assert.equal(
    url,
    "https://www.al-ai-fx.xyz/de/magic-login?token=abc&callbackUrl=%2Fdashboard%2Flicenses",
  );
});
