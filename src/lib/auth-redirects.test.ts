import test from "node:test";
import assert from "node:assert/strict";

import { buildLoginRedirectPath } from "./auth-redirects";

test("buildLoginRedirectPath keeps default locale unprefixed", () => {
  assert.equal(
    buildLoginRedirectPath("en", "/tutorials"),
    "/login?callbackUrl=%2Ftutorials",
  );
});

test("buildLoginRedirectPath prefixes non-default locales", () => {
  assert.equal(
    buildLoginRedirectPath("de", "/de/tutorials/2"),
    "/de/login?callbackUrl=%2Fde%2Ftutorials%2F2",
  );
});
