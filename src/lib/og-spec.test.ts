import test from "node:test";
import assert from "node:assert/strict";

import { CATALOG_FILTER_IDS } from "./catalog-filter";
import { OG_CATALOG_COPY, OG_PAGE_COPY } from "./og-copy";
import { OG_PAGE_KEYS, OG_VERSION, ogImagePath, parseOgSpec, type OgSpec } from "./og-spec";
import { clampText } from "./text-clamp";

test("every kind of card has a predictable address, versioned and ending in .jpg", () => {
  assert.equal(OG_VERSION, "v1");
  assert.equal(ogImagePath({ type: "robot", slug: "gold-multirange-4" }), "/api/og/v1/robot/gold-multirange-4.jpg");
  assert.equal(ogImagePath({ type: "catalog", filter: "multirange" }), "/api/og/v1/catalog/multirange.jpg");
  assert.equal(ogImagePath({ type: "guide", slug: "install-ea-on-mt5" }), "/api/og/v1/guide/install-ea-on-mt5.jpg");
  assert.equal(ogImagePath({ type: "page", key: "faq" }), "/api/og/v1/page/faq.jpg");
});

test("an address parses back to the card it names", () => {
  const specs: OgSpec[] = [
    { type: "robot", slug: "gold-multirange-4" },
    { type: "guide", slug: "gold-ea-mt5" },
    ...CATALOG_FILTER_IDS.map((filter): OgSpec => ({ type: "catalog", filter })),
    ...OG_PAGE_KEYS.map((key): OgSpec => ({ type: "page", key })),
  ];
  for (const spec of specs) {
    const [, , , , type, file] = ogImagePath(spec).split("/"); // "", api, og, v1, type, file
    assert.deepEqual(parseOgSpec(type, file), spec, ogImagePath(spec));
  }
});

test("anything that is not one of our pages is refused", () => {
  const refused: [string, string][] = [
    ["robot", "../../etc/passwd"],
    ["robot", "..%2f..%2fetc"],
    ["robot", "gold multirange"],
    ["robot", "-leading-dash"],
    ["robot", "x".repeat(81)],
    ["robot", ""],
    ["robot", ".jpg"],
    ["robot", "gold-multirange-4.png"],
    ["guide", "<script>"],
    ["catalog", "everything"],
    ["catalog", "multirange.gif"],
    ["page", "login"],
    ["page", "dashboard"],
    ["page", "home"],
    ["text", "anything-you-like"],
    ["", "faq"],
  ];
  for (const [type, name] of refused) assert.equal(parseOgSpec(type, name), null, `${type}/${name}`);
});

test("a name is accepted in any case and with or without the .jpg", () => {
  assert.deepEqual(parseOgSpec("robot", "Gold-MultiRange-4.jpg"), { type: "robot", slug: "gold-multirange-4" });
  assert.deepEqual(parseOgSpec("catalog", "FREE-TRIAL"), { type: "catalog", filter: "free-trial" });
});

test("every page key and every catalog tab has copy that fits a card", () => {
  for (const key of OG_PAGE_KEYS) {
    const copy = OG_PAGE_COPY[key];
    assert.ok(copy, `copy for ${key}`);
    assert.ok(copy.eyebrow.length > 0 && copy.eyebrow.length <= 20, `${key} eyebrow`);
    assert.ok(copy.title.length > 0 && copy.title.length <= 60, `${key} title is ${copy.title.length} characters`);
    assert.ok(copy.subtitle.length > 0 && copy.subtitle.length <= 140, `${key} subtitle is ${copy.subtitle.length} characters`);
  }
  for (const id of CATALOG_FILTER_IDS) {
    const copy = OG_CATALOG_COPY[id];
    assert.ok(copy && copy.title.length <= 40 && copy.subtitle.length <= 120, `catalog ${id}`);
  }
});

test("the card copy promises no result, figure or percentage", () => {
  const all = [...Object.values(OG_PAGE_COPY), ...Object.values(OG_CATALOG_COPY)]
    .map((c) => JSON.stringify(c))
    .join(" ");
  assert.ok(!/profit|\broi\b|return on|%|\$/i.test(all), all);
});

test("clamping cuts at a word and says so", () => {
  assert.equal(clampText("  short   text ", 40), "short text");
  const cut = clampText("Seven independent session ranges a day for traders who want the widest coverage", 40);
  assert.ok(cut.endsWith("…") && cut.length <= 40, cut);
  assert.ok(!/\s…$/.test(cut));
  assert.equal(clampText("Seven independent session ranges a day for traders", 30), "Seven independent session…");
  assert.equal(clampText("supercalifragilisticexpialidocious-and-more", 20).length, 20, "no space to cut at: a hard cut");
});
