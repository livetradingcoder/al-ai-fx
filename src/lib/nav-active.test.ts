import test from "node:test";
import assert from "node:assert/strict";

import { isOnPath } from "./nav-active";

test("a nav link is active on its own page and on pages below it", () => {
  assert.equal(isOnPath("/tutorials", ["/tutorials"]), true);
  assert.equal(isOnPath("/tutorials/free-trial", ["/tutorials"]), true);
  assert.equal(isOnPath("/faq", ["/faq"]), true);
});

test("it is not fooled by a longer path that merely starts the same way", () => {
  assert.equal(isOnPath("/tutorials-archive", ["/tutorials"]), false);
  assert.equal(isOnPath("/faq-old", ["/faq"]), false);
});

test("other pages and the home page match nothing", () => {
  assert.equal(isOnPath("/", ["/faq", "/tutorials"]), false);
  assert.equal(isOnPath("/catalog", ["/tutorials"]), false);
  assert.equal(isOnPath("/anything", []), false);
});
