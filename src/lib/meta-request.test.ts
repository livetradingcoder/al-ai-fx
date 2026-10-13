import test from "node:test";
import assert from "node:assert/strict";

import { readMetaRequestContext, sanitizeCustomData, sanitizeSourceUrl } from "./meta-request";

const FBP = "fb.1.1760000000000.1234567890";
const FBC = "fb.1.1760000000000.IwAR0AbCdEfGhIjKlMn_oPqRsTuV-wXyZ";
const UA = "Mozilla/5.0 (Macintosh) Chrome/141.0 Safari/537.36";

function request(headers: Record<string, string>, url = "https://www.al-ai-fx.xyz/api/checkout/polar") {
  return new Request(url, { method: "POST", headers });
}

test("a visitor who accepted is recognised, with everything the request carries", () => {
  const ctx = readMetaRequestContext(
    request({
      cookie: `al_consent=granted; _fbp=${FBP}; _fbc=${FBC}`,
      "x-forwarded-for": "8.8.8.8, 10.0.0.2",
      "user-agent": UA,
      referer: "https://www.al-ai-fx.xyz/checkout?tier=1-month&robot=goldbot#pay",
    }),
  );
  assert.equal(ctx.consent, true);
  assert.equal(ctx.ip, "8.8.8.8");
  assert.equal(ctx.userAgent, UA);
  assert.equal(ctx.fbp, FBP);
  assert.equal(ctx.fbc, FBC);
  assert.equal(ctx.sourceUrl, "https://www.al-ai-fx.xyz/checkout?tier=1-month&robot=goldbot");
});

test("no cookie, or a rejection, is no consent", () => {
  assert.equal(readMetaRequestContext(request({})).consent, false);
  assert.equal(readMetaRequestContext(request({ cookie: "al_consent=denied" })).consent, false);
  assert.equal(readMetaRequestContext(request({ cookie: "al_consent=GRANTED" })).consent, false);
});

test("a missing _fbc is rebuilt from the fbclid on the page the visitor was on", () => {
  const ctx = readMetaRequestContext(
    request({
      cookie: "al_consent=granted",
      referer: "https://www.al-ai-fx.xyz/?fbclid=IwAR0AbCdEfGhIjKl",
    }),
    { nowMs: 1760000000999 },
  );
  assert.equal(ctx.fbc, "fb.1.1760000000999.IwAR0AbCdEfGhIjKl");
});

test("a mangled cookie is dropped, not forwarded", () => {
  const ctx = readMetaRequestContext(request({ cookie: "al_consent=granted; _fbp=garbage; _fbc=fb.1.x" }));
  assert.equal(ctx.fbp, undefined);
  assert.equal(ctx.fbc, undefined);
});

test("the source URL must be this site; anything else is refused", () => {
  const req = request({});
  assert.equal(sanitizeSourceUrl(req, "https://www.al-ai-fx.xyz/robots/goldbot"), "https://www.al-ai-fx.xyz/robots/goldbot");
  assert.equal(sanitizeSourceUrl(req, "https://al-ai-fx.xyz/"), "https://al-ai-fx.xyz/");
  assert.equal(sanitizeSourceUrl(req, "https://evil.example/robots/goldbot"), undefined);
  assert.equal(sanitizeSourceUrl(req, "https://al-ai-fx.xyz.evil.example/"), undefined);
  assert.equal(sanitizeSourceUrl(req, "javascript:alert(1)"), undefined);
  assert.equal(sanitizeSourceUrl(req, "not a url"), undefined);
  assert.equal(sanitizeSourceUrl(req, undefined), undefined);
});

test("an explicit source URL wins over the referer", () => {
  const ctx = readMetaRequestContext(
    request({ referer: "https://www.al-ai-fx.xyz/checkout" }),
    { sourceUrl: "https://www.al-ai-fx.xyz/robots/goldbot" },
  );
  assert.equal(ctx.sourceUrl, "https://www.al-ai-fx.xyz/robots/goldbot");
});

test("sanitizeCustomData keeps the properties we send and drops everything else", () => {
  const clean = sanitizeCustomData({
    value: 99.999,
    currency: "usd",
    content_ids: ["goldbot", "", 5, "x".repeat(101)],
    content_type: "product",
    content_name: "GoldBot",
    content_category: "1-month",
    num_items: 1,
    email: "leak@example.com",
    order_id: "forged",
    contents: [{ id: "x" }],
  });
  assert.deepEqual(clean, {
    value: 100,
    currency: "USD",
    content_ids: ["goldbot"],
    content_type: "product",
    content_name: "GoldBot",
    content_category: "1-month",
    num_items: 1,
  });
});

test("sanitizeCustomData rejects nonsense values and non-objects", () => {
  assert.deepEqual(sanitizeCustomData(null), {});
  assert.deepEqual(sanitizeCustomData("value=1"), {});
  assert.deepEqual(
    sanitizeCustomData({ value: -5, currency: "dollars", content_type: "service", num_items: 1.5, content_ids: "goldbot" }),
    {},
  );
  assert.deepEqual(sanitizeCustomData({ value: 1e9 }), {});
});
