import test from "node:test";
import assert from "node:assert/strict";

import { PROP_FIRM } from "@/config/links";
import { CONTENT_PAGES } from "./content-pages";
import { EXTRA_EN } from "./faq-content";
import { TUTORIAL_ARTICLES } from "./tutorial-articles";

test("the prop firm offer is ForRealFunding at 50% off with the GOLDBOT code", () => {
  assert.equal(PROP_FIRM.url, "https://forrealfunding.com/");
  assert.equal(PROP_FIRM.code, "GOLDBOT");
  assert.equal(PROP_FIRM.discount, "50%");
});

test("the prop firm guide and help article both carry the partner offer", () => {
  const guide = CONTENT_PAGES.find((p) => p.slug === "prop-firm-gold-ea");
  const article = TUTORIAL_ARTICLES.find((a) => a.slug === "prop-firm");
  assert.ok(guide?.blocks.some((b) => b.type === "propfirm"), "guide has no propfirm block");
  assert.ok(article?.blocks.some((b) => b.type === "propfirm"), "article has no propfirm block");
});

test("the FAQ answer quotes the same code and discount, and links to the firm", () => {
  const item = EXTRA_EN.find((i) => i.id === "prop-firm-account");
  assert.ok(item);
  assert.ok(item.a.includes(PROP_FIRM.code) && item.a.includes(PROP_FIRM.discount));
  assert.equal(item.link?.href, PROP_FIRM.url);
});
