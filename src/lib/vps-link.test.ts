import test from "node:test";
import assert from "node:assert/strict";

import { VPS_REFERRAL_URL } from "@/config/links";
import { CONTENT_PAGES } from "./content-pages";
import { TUTORIAL_ARTICLES } from "./tutorial-articles";

type AnyBlock = { type: string; text?: string; items?: (string | { title: string; text: string })[] };

function mentionsVps(blocks: AnyBlock[]): boolean {
  return blocks.some((b) => {
    if (b.type === "vps") return false;
    const strings = [b.text ?? "", ...(b.items ?? []).map((i) => (typeof i === "string" ? i : `${i.title} ${i.text}`))];
    return strings.some((s) => /\bVPS\b/.test(s));
  });
}

test("the VPS link is the referral link the owner supplied", () => {
  assert.equal(VPS_REFERRAL_URL, "https://powervps.net/?from=111003");
});

test("every public guide that advises a VPS also says where to get one", () => {
  // The check below would pass vacuously if the detection broke.
  assert.ok(CONTENT_PAGES.some((p) => mentionsVps(p.blocks as AnyBlock[])), "no public guide mentions a VPS?");
  for (const page of CONTENT_PAGES) {
    if (mentionsVps(page.blocks as AnyBlock[])) {
      assert.ok(page.blocks.some((b) => b.type === "vps"), `${page.slug} mentions a VPS but has no { type: "vps" } block`);
    }
  }
});

test("every help article that advises a VPS also says where to get one", () => {
  assert.ok(TUTORIAL_ARTICLES.some((a) => mentionsVps(a.blocks as AnyBlock[])), "no help article mentions a VPS?");
  for (const article of TUTORIAL_ARTICLES) {
    if (mentionsVps(article.blocks as AnyBlock[])) {
      assert.ok(article.blocks.some((b) => b.type === "vps"), `${article.slug} mentions a VPS but has no { type: "vps" } block`);
    }
  }
});
