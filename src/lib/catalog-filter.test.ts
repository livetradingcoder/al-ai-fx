import test from "node:test";
import assert from "node:assert/strict";

import { parseCatalogFilter, withCatalogFilter } from "./catalog-filter";

const everything = () => true;

test("a known filter in the URL selects that tab", () => {
  assert.equal(parseCatalogFilter("free-trial", everything), "free-trial");
  assert.equal(parseCatalogFilter("multirange", everything), "multirange");
  assert.equal(parseCatalogFilter("breakout", everything), "breakout");
});

test("hand-typed values are forgiven", () => {
  assert.equal(parseCatalogFilter("  Free-Trial ", everything), "free-trial");
});

test("missing, unknown or 'all' means the whole catalog", () => {
  assert.equal(parseCatalogFilter(null, everything), "all");
  assert.equal(parseCatalogFilter(undefined, everything), "all");
  assert.equal(parseCatalogFilter("", everything), "all");
  assert.equal(parseCatalogFilter("all", everything), "all");
  assert.equal(parseCatalogFilter("bitcoin", everything), "all");
});

test("a tab with no robots is not shown, so its URL shows everything", () => {
  assert.equal(parseCatalogFilter("breakout", (id) => id !== "breakout"), "all");
  assert.equal(parseCatalogFilter("free-trial", (id) => id !== "breakout"), "free-trial");
});

test("setting a filter writes ?filter= and keeps the other params", () => {
  assert.equal(withCatalogFilter("", "free-trial"), "?filter=free-trial");
  assert.equal(withCatalogFilter("?utm_source=facebook&fbclid=abc", "multirange"), "?utm_source=facebook&fbclid=abc&filter=multirange");
  assert.equal(withCatalogFilter("?filter=breakout&utm_source=fb", "free-trial"), "?filter=free-trial&utm_source=fb");
});

test("'all' removes the param, leaving a plain URL when nothing else is set", () => {
  assert.equal(withCatalogFilter("?filter=breakout", "all"), "");
  assert.equal(withCatalogFilter("?utm_source=fb&filter=breakout", "all"), "?utm_source=fb");
  assert.equal(withCatalogFilter("", "all"), "");
});
