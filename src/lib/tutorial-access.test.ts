import test from "node:test";
import assert from "node:assert/strict";

import { LEGACY_ACCESS, LEGACY_IDS } from "@/app/[locale]/tutorials/legacy";
import { FIXTURE_FACTS } from "@/lib/pricing-test-fixtures";
import { tutorialGate, tutorialLoginPath } from "./tutorial-access";
import { buildTutorialArticles, publicTutorialArticles } from "./tutorial-articles";

const ARTICLES = buildTutorialArticles(FIXTURE_FACTS);
const slugsWith = (access: "public" | "members") => ARTICLES.filter((a) => a.access === access).map((a) => a.slug);

// The decision itself. Changing a level is deliberate: change it here too.
const PUBLIC_SLUGS = [
  "free-trial",
  "what-is-goldbot",
  "before-you-buy",
  "which-robot",
  "pricing",
  "payments-and-renewals",
  "account-locked-build",
  "prop-firm",
  "refund-policy",
  "lifetime-and-source-code",
  "terms-of-use",
  "risk-disclaimer",
];
const MEMBERS_SLUGS = ["link-mt5-account", "ea-not-showing-up"];

test("every help article has an access level", () => {
  for (const a of ARTICLES) {
    assert.ok(a.access === "public" || a.access === "members", `${a.slug}: access is ${String(a.access)}`);
  }
});

test("the public and members-only articles are the ones decided on", () => {
  assert.deepEqual(slugsWith("public").sort(), [...PUBLIC_SLUGS].sort());
  assert.deepEqual(slugsWith("members").sort(), [...MEMBERS_SLUGS].sort());
  assert.equal(PUBLIC_SLUGS.length + MEMBERS_SLUGS.length, ARTICLES.length);
});

test("the numbered setup tutorials are members-only", () => {
  assert.equal(LEGACY_ACCESS, "members");
  for (const id of LEGACY_IDS) assert.equal(tutorialGate(LEGACY_ACCESS, false), "login", id);
});

test("a signed-out visitor reads public articles and is sent to log in for members-only ones", () => {
  for (const a of ARTICLES) {
    assert.equal(tutorialGate(a.access, false), a.access === "public" ? "show" : "login", a.slug);
  }
});

test("a signed-in member reads everything", () => {
  for (const a of ARTICLES) assert.equal(tutorialGate(a.access, true), "show", a.slug);
  assert.equal(tutorialGate(LEGACY_ACCESS, true), "show");
});

test("an unknown tutorial is a 404 whether or not the visitor is signed in", () => {
  assert.equal(tutorialGate(undefined, false), "not-found");
  assert.equal(tutorialGate(undefined, true), "not-found");
});

test("only public articles are offered to search engines", () => {
  const listed = publicTutorialArticles(ARTICLES).map((a) => a.slug);
  assert.deepEqual(listed.sort(), [...PUBLIC_SLUGS].sort());
  for (const slug of MEMBERS_SLUGS) assert.ok(!listed.includes(slug), `${slug} must not be listed`);
});

test("the login path for a members-only tutorial comes back to it, in the visitor's language", () => {
  assert.equal(tutorialLoginPath("en", "link-mt5-account"), "/login?callbackUrl=%2Ftutorials%2Flink-mt5-account");
  assert.equal(tutorialLoginPath("de", "2"), "/de/login?callbackUrl=%2Fde%2Ftutorials%2F2");
});
