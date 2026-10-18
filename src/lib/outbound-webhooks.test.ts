import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  assertSafeUrl,
  buildEventBody,
  isPrivateAddress,
  providerOf,
  signBody,
  signatureHeaders,
} from "./outbound-webhooks";

const SECRET = "test-secret-not-a-real-one-0123456789abcdef";

test("signBody: HMAC-SHA256 hex of the exact body", () => {
  const body = '{"event":"sale.completed"}';
  assert.equal(signBody(SECRET, body), createHmac("sha256", SECRET).update(body).digest("hex"));
  assert.notEqual(signBody(SECRET, body), signBody(SECRET, body + " "), "any byte change changes the signature");
  assert.match(signBody(SECRET, body), /^[0-9a-f]{64}$/);
});

test("signatureHeaders: bare hex by default, sha256= prefix when asked, hub header always prefixed", () => {
  const hex = signBody(SECRET, "x");
  assert.deepEqual(signatureHeaders(SECRET, "x", "hex"), {
    "X-Webhook-Signature": hex,
    "X-Hub-Signature-256": `sha256=${hex}`,
  });
  assert.equal(signatureHeaders(SECRET, "x", "prefixed")["X-Webhook-Signature"], `sha256=${hex}`);
  assert.equal(signatureHeaders(SECRET, "x", "anything-else")["X-Webhook-Signature"], hex, "unknown format falls back to hex");
});

test("isPrivateAddress: loopback, RFC1918, link-local, CGNAT and mapped IPv6 are private", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.63.255.255", "2606:4700:4700::1111"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test("assertSafeUrl: https only, no credentials, no inward addresses", async () => {
  await assert.rejects(assertSafeUrl("http://example.com/hook"), /https/);
  await assert.rejects(assertSafeUrl("not a url"), /valid URL/);
  await assert.rejects(assertSafeUrl("https://user:pw@example.com/"), /credentials/);
  await assert.rejects(assertSafeUrl("https://localhost/hook"), /not reachable/);
  await assert.rejects(assertSafeUrl("https://app.internal/hook"), /not reachable/);
  await assert.rejects(assertSafeUrl("https://127.0.0.1/hook"), /not reachable/);
  await assert.rejects(assertSafeUrl("https://169.254.169.254/latest/meta-data"), /not reachable/);
  await assert.rejects(assertSafeUrl("https://[::1]/hook"), /not reachable/);
  const ok = await assertSafeUrl("https://93.184.216.34/api/webhooks/relay/abc"); // IP literal: no DNS needed
  assert.equal(ok.pathname, "/api/webhooks/relay/abc");
});

test("providerOf: reads the provider from the order ref prefix", () => {
  assert.equal(providerOf("POLAR-co_1"), "Polar");
  assert.equal(providerOf("OXAPAY-abc"), "OxaPay");
  assert.equal(providerOf("WHOP-abc"), "Whop");
  assert.equal(providerOf("COUPON-LAUNCH-abc"), "Coupon");
  assert.equal(providerOf("TEST-123"), "Test");
  assert.equal(providerOf("3f1c-uuid"), "Paygate");
});

const NOW = new Date("2026-10-15T12:00:00.000Z");

test("buildEventBody: a sale reads as a message and carries the structured data", () => {
  const body = buildEventBody(
    {
      type: "sale.completed",
      data: {
        orderId: "ord_1",
        orderRef: "POLAR-co_1",
        provider: "Polar",
        amount: 29,
        currency: "USD",
        tier: "TEN_DAYS",
        robotSlug: "gold-multirange-4",
        robotName: "Gold MultiRange 4",
        email: "buyer@example.com",
        userId: "usr_1",
        refCode: "ABC123",
      },
    },
    "evt_1",
    NOW,
  );
  assert.equal(body.id, "evt_1");
  assert.equal(body.event, "sale.completed");
  assert.equal(body.created_at, "2026-10-15T12:00:00.000Z");
  assert.equal(body.title, "💰 New sale — Gold MultiRange 4 · Ten Days");
  assert.equal(
    body.message,
    ["💰 New sale — Gold MultiRange 4 · Ten Days", "$29.00 via Polar", "buyer@example.com", "Referral: ABC123", "Order POLAR-co_1"].join("\n"),
  );
  assert.equal(body.path, "/dashboard/admin/orders");
  assert.ok(body.url.endsWith("/dashboard/admin/orders"));
  assert.equal((body.data as { orderRef: string }).orderRef, "POLAR-co_1", "data is the event payload itself");
});

test("buildEventBody: a $0 order is a free order, other currencies are spelled out", () => {
  const sale = (amount: number, currency: string) =>
    buildEventBody({
      type: "sale.completed",
      data: { orderId: null, orderRef: "COUPON-X-1", provider: "Coupon", amount, currency, tier: "ONE_MONTH", robotSlug: "r", robotName: "R", email: "a@b.co", userId: "u", refCode: null },
    }).message;
  assert.match(sale(0, "USD"), /^🎁 Free order — R · One Month\nNo charge \(Coupon\)\na@b\.co\nOrder COUPON-X-1$/);
  assert.match(sale(29.5, "EUR"), /29\.50 EUR via Coupon/);
});

test("buildEventBody: signup, trial and test messages", () => {
  assert.equal(
    buildEventBody({ type: "user.signup", data: { userId: "u", email: "a@b.co", name: null, source: "trial" } }).message,
    "🆕 New signup\na@b.co\nStarted with a free trial",
  );
  assert.equal(
    buildEventBody({ type: "user.signup", data: { userId: "u", email: "a@b.co", name: null, source: "purchase" } }).message,
    "🆕 New signup\na@b.co\nCreated at checkout",
  );
  assert.equal(
    buildEventBody({ type: "trial.started", data: { userId: "u", email: "a@b.co", robotSlug: "r", robotName: "R" } }).message,
    "🧪 Free trial — R\na@b.co",
  );
  const both = buildEventBody({
    type: "trial.started",
    data: { userId: "u", email: "a@b.co", robotSlug: "r", robotName: "R", newAccount: true },
  });
  assert.equal(both.message, "🆕 New signup · 🧪 free trial — R\na@b.co", "a trial that made the account is one message");
  assert.equal(both.path, "/dashboard/admin/licences");
  const sale = {
    orderId: "o", orderRef: "POLAR-1", provider: "Polar", amount: 99, currency: "USD", tier: "ONE_MONTH",
    robotSlug: "r", robotName: "R", email: "a@b.co", userId: "u", refCode: null,
  };
  assert.ok(!buildEventBody({ type: "sale.completed", data: sale }).title.includes("New customer"));
  assert.equal(
    buildEventBody({ type: "sale.completed", data: { ...sale, newCustomer: true } }).title,
    "🆕 New customer · 💰 New sale — R · One Month",
    "a new customer's first order is one message",
  );
  const test_ = buildEventBody({ type: "webhook.test", data: { webhookName: "WhatsApp" } });
  assert.equal(test_.message, '✅ Test event\nWebhook "WhatsApp" is connected to AL-AI-FX.');
  assert.equal(test_.event, "webhook.test");
});

test("buildEventBody: a trial the robot charges for says so, and its sale is labelled as a trial", () => {
  const started = (extra: object) =>
    buildEventBody({
      type: "trial.started",
      data: { userId: "u", email: "a@b.co", robotSlug: "r", robotName: "R", ...extra },
    }).message;

  assert.equal(started({ paid: true, days: 7 }), "🧪 7-day trial — R\na@b.co");
  assert.equal(started({ paid: true, days: 3, newAccount: true }), "🆕 New signup · 🧪 3-day trial — R\na@b.co");
  assert.equal(started({ paid: true }), "🧪 Trial — R\na@b.co", "a paid trial of unknown length still isn't called free");
  assert.equal(started({ paid: false, days: 3 }), "🧪 Free trial — R\na@b.co");

  const sale = buildEventBody({
    type: "sale.completed",
    data: {
      orderId: "o", orderRef: "POLAR-1", provider: "Polar", amount: 0.99, currency: "USD", tier: "FREE_TRIAL",
      robotSlug: "r", robotName: "R", email: "a@b.co", userId: "u", refCode: null, trialDays: 3,
    },
  });
  assert.equal(sale.title, "💰 New sale — R · 3-Day Trial");
  assert.match(sale.message, /\$0\.99 via Polar/);
});
