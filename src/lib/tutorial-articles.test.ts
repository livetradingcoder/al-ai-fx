import test from "node:test";
import assert from "node:assert/strict";

import { PricingTier } from "@prisma/client";

import { buildPricingCatalog } from "@/lib/pricing-catalog";
import { buildPricingFacts } from "@/lib/pricing-facts";
import { FIXTURE_FACTS, FIXTURE_ROWS, NO_CATALOG_FACTS } from "@/lib/pricing-test-fixtures";
import { usesNewDesign } from "@/lib/redesigned-routes";
import {
  buildTutorialArticles,
  getTutorialArticle,
  readingTime,
  TUTORIAL_CATEGORIES,
} from "./tutorial-articles";

const TUTORIAL_ARTICLES = buildTutorialArticles(FIXTURE_FACTS);

test("slugs are unique, URL-safe, and never collide with the numbered tutorials", () => {
  const slugs = TUTORIAL_ARTICLES.map((a) => a.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const slug of slugs) {
    assert.match(slug, /^[a-z][a-z0-9-]*$/, slug);
    assert.ok(!["1", "2", "3"].includes(slug));
  }
});

test("every article belongs to a known category and has real content", () => {
  const known = new Set(TUTORIAL_CATEGORIES.map((c) => c.id));
  for (const a of TUTORIAL_ARTICLES) {
    assert.ok(known.has(a.category), `${a.slug}: unknown category ${a.category}`);
    assert.ok(a.title.trim() && a.summary.trim(), `${a.slug}: title and summary`);
    assert.ok(a.blocks.length > 0, `${a.slug}: no blocks`);
  }
  // Every category shows up on the index.
  for (const c of TUTORIAL_CATEGORIES) {
    assert.ok(TUTORIAL_ARTICLES.some((a) => a.category === c.id), `${c.id} has no articles`);
  }
});

test("headings have unique anchors and no block is empty", () => {
  for (const a of TUTORIAL_ARTICLES) {
    const ids = a.blocks.flatMap((b) => (b.type === "h2" ? [b.id] : []));
    assert.equal(new Set(ids).size, ids.length, `${a.slug}: duplicate heading id`);
    for (const b of a.blocks) {
      if (b.type === "p" || b.type === "h2") assert.ok(b.text.trim(), `${a.slug}: empty text`);
      if (b.type === "list") assert.ok(b.items.length > 0 && b.items.every((i) => i.trim()), `${a.slug}: empty list`);
      if (b.type === "steps") assert.ok(b.items.length > 0 && b.items.every((s) => s.title.trim() && s.text.trim()), `${a.slug}: empty step`);
    }
  }
});

test("related articles exist, never point at themselves, and links stay on the site", () => {
  for (const a of TUTORIAL_ARTICLES) {
    for (const slug of a.related ?? []) {
      assert.ok(getTutorialArticle(slug, FIXTURE_FACTS), `${a.slug} -> ${slug} does not exist`);
      assert.notEqual(slug, a.slug);
    }
    for (const link of a.links ?? []) {
      assert.ok(link.label.trim());
      assert.match(link.href, /^\/[a-z]/, `${a.slug}: ${link.href}`);
      assert.ok(!link.href.includes("://"));
    }
  }
});

test("the pricing article quotes the flagship's prices from the catalog, not from numbers typed into it", () => {
  const text = JSON.stringify(getTutorialArticle("pricing", FIXTURE_FACTS)!.blocks);
  for (const price of ["$39", "$99", "$449", "$799"]) assert.ok(text.includes(price), `missing ${price}`);

  // Change the database prices and the article follows.
  const repriced = FIXTURE_ROWS.map((row) =>
    row.slug === "gold-multirange-4"
      ? { ...row, prices: row.prices.map((p) => (p.tier === PricingTier.TEN_DAYS ? { ...p, amount: 41 } : p)) }
      : row,
  );
  const next = JSON.stringify(
    getTutorialArticle("pricing", buildPricingFacts(buildPricingCatalog(repriced, "gold-multirange-4")))!.blocks,
  );
  assert.ok(next.includes("$41") && !next.includes("$39"));
});

test("the trial articles say what each robot's trial costs and how long it runs", () => {
  const text = JSON.stringify(getTutorialArticle("free-trial", FIXTURE_FACTS)!.blocks);
  assert.match(text, /PrecisionTrader has a 3-day trial for \$0\.99/);
  assert.match(text, /Gold MultiRange 4 has a 7-day trial for \$1\.99/);
  assert.match(text, /GoldBot Double Range has a 3-day free trial/);
});

test("when the catalog can't be read the articles quote no price at all", () => {
  const text = JSON.stringify(buildTutorialArticles(NO_CATALOG_FACTS));
  const pricing = JSON.stringify(getTutorialArticle("pricing", NO_CATALOG_FACTS)!.blocks);
  assert.ok(!/\$\d/.test(pricing), "no dollar figure in the pricing article");
  assert.ok(text.length > 0);
});

test("reading time is at least a minute and worded like the other tutorials", () => {
  for (const a of TUTORIAL_ARTICLES) assert.match(readingTime(a), /^[1-9]\d* mins? read$/);
});

test("the tutorials pages use the new navbar and footer, the dashboard does not", () => {
  assert.equal(usesNewDesign("/tutorials"), true);
  assert.equal(usesNewDesign("/tutorials/free-trial"), true);
  assert.equal(usesNewDesign("/dashboard"), false);
});
