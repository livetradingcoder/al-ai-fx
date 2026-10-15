import test from "node:test";
import assert from "node:assert/strict";

import jwt from "jsonwebtoken";

import {
  buildDashboardMagicLink,
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

function lifetimeSeconds(link: string) {
  const token = new URL(link).searchParams.get("token") ?? "";
  const payload = jwt.decode(token) as { exp: number; iat: number };
  return payload.exp - payload.iat;
}

test("buildDashboardMagicLink keeps the 30 minute life and no landing page by default", () => {
  process.env.NEXTAUTH_SECRET = "dashboard-link-secret";
  const link = buildDashboardMagicLink({ email: "a@example.com", userId: "user_1" });
  const url = new URL(link);

  assert.equal(url.pathname, "/magic-login");
  assert.equal(url.searchParams.has("callbackUrl"), false);
  assert.equal(lifetimeSeconds(link), 30 * 60);
  assert.equal(verifyMagicLinkToken(url.searchParams.get("token") ?? "", "dashboard-link-secret").userId, "user_1");
});

test("buildDashboardMagicLink can ask for a longer life and a landing page", () => {
  process.env.NEXTAUTH_SECRET = "dashboard-link-secret";
  const link = buildDashboardMagicLink(
    { email: "a@example.com", userId: "user_1" },
    { expiresIn: "3d", callbackUrl: "/dashboard/onboarding" },
  );

  assert.equal(new URL(link).searchParams.get("callbackUrl"), "/dashboard/onboarding");
  assert.equal(lifetimeSeconds(link), 3 * 24 * 60 * 60);
});
