import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PROP_FIRM } from "@/config/links";
import { EXTRA_EN } from "./faq-content";

test("the prop firm offer is ForRealFunding at 50% off with the GOLDBOT code", () => {
  assert.equal(PROP_FIRM.url, "https://forrealfunding.com/");
  assert.equal(PROP_FIRM.code, "GOLDBOT");
  assert.equal(PROP_FIRM.discount, "50%");
});

test("the prop firm callout carries the code, the checkout link and the partner disclosure", () => {
  const callout = readFileSync(path.join(process.cwd(), "src/components/content/PropFirmCallout.tsx"), "utf8");
  assert.ok(callout.includes("href={PROP_FIRM.checkoutUrl}") && callout.includes("href={PROP_FIRM.url}"));
  assert.equal(callout.split('rel="sponsored noopener noreferrer"').length - 1, 2, "both links are sponsored");
  assert.ok(callout.includes("{PROP_FIRM.code}") && callout.includes("{PROP_FIRM.discount}") && callout.includes("{PROP_FIRM.price}"));
  assert.match(callout, /Partner offer\./);
});

test("the checkout link is the firm's own checkout for the 5k one-step challenge", () => {
  const checkout = new URL(PROP_FIRM.checkoutUrl);
  assert.equal(checkout.protocol, "https:");
  assert.equal(checkout.hostname, new URL(PROP_FIRM.url).hostname, "same site as the firm's home page");
  assert.equal(checkout.pathname, "/checkout");
  assert.equal(checkout.searchParams.get("type"), "oneStep");
  assert.equal(checkout.searchParams.get("size"), "5k");
  assert.equal(PROP_FIRM.price, "$9.99");
});

test("the FAQ answer quotes the same code, discount and price, and links to the checkout", () => {
  const item = EXTRA_EN.find((i) => i.id === "prop-firm-account");
  assert.ok(item);
  assert.ok(item.a.includes(PROP_FIRM.code) && item.a.includes(PROP_FIRM.discount));
  assert.ok(item.a.includes(PROP_FIRM.price), "the price is quoted from the same constant");
  assert.match(item.a, /listed at/, "a third party's price is shown as listed, not promised");
  assert.match(item.a, /can change/);
  assert.equal(item.link?.href, PROP_FIRM.checkoutUrl);
  assert.ok(item.link?.label.includes(PROP_FIRM.price));
});
