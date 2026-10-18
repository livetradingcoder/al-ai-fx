import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PROP_FIRM, VPS_REFERRAL_URL } from "@/config/links";
import { CONTENT_PAGES } from "./content-pages";
import { NO_CATALOG_FACTS } from "./pricing-test-fixtures";
import { buildTutorialArticles } from "./tutorial-articles";

// Run from the repo root, like every test here.
const source = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
const count = (text: string, needle: string) => text.split(needle).length - 1;

test("the VPS link is the referral link the owner supplied", () => {
  assert.equal(VPS_REFERRAL_URL, "https://powervps.net/?from=111003");
});

test("the VPS callout is a sponsored external link with the referral disclosure", () => {
  const callout = source("src/components/content/VpsCallout.tsx");
  assert.ok(callout.includes("href={VPS_REFERRAL_URL}"));
  assert.ok(callout.includes('rel="sponsored noopener noreferrer"'));
  assert.ok(callout.includes('target="_blank"'));
  assert.match(callout, /referral link/);
});

test("the guides and the tutorials both end every article with the shared offers", () => {
  const views: { file: string; blocks: string }[] = [
    { file: "src/components/content/ContentArticle.tsx", blocks: "page.blocks.map" },
    { file: "src/components/tutorials/TutorialArticleView.tsx", blocks: "blocks.map(renderBlock)" },
  ];
  for (const { file, blocks } of views) {
    const view = source(file);
    assert.ok(view.includes('import ArticleOffers from'), `${file} does not import ArticleOffers`);
    assert.equal(count(view, "<ArticleOffers />"), 1, `${file} must render <ArticleOffers /> exactly once`);
    assert.ok(
      view.indexOf("<ArticleOffers />") > view.indexOf(blocks),
      `${file} must render the offers after the article's blocks, at its end`,
    );
  }

  const offers = source("src/components/content/ArticleOffers.tsx");
  assert.ok(offers.includes("<VpsCallout />") && offers.includes("<PropFirmCallout />"));
  assert.ok(offers.indexOf("<VpsCallout />") < offers.indexOf("<PropFirmCallout />"), "VPS first, then the prop firm");
});

test("no article hardcodes a partner link; they all come from the shared offers", () => {
  const text = JSON.stringify([CONTENT_PAGES, buildTutorialArticles(NO_CATALOG_FACTS)]);
  assert.ok(!text.includes(new URL(VPS_REFERRAL_URL).hostname), "an article links to the VPS vendor itself");
  assert.ok(!text.includes(new URL(PROP_FIRM.url).hostname), "an article links to the prop firm itself");
});
