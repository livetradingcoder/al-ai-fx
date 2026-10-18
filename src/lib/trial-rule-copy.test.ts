import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { buildExtraFaq } from "./faq-content";
import { FIXTURE_FACTS } from "./pricing-test-fixtures";
import { SESSION_RETENTION_DAYS, USER_IP_RETENTION_DAYS } from "./retention";
import { getTutorialArticle } from "./tutorial-articles";

// The free-trial rule is described in four places people read and enforced in
// code. These keep the words from drifting away from what the code does.

const page = (name: string) =>
  readFileSync(path.join(process.cwd(), `src/app/[locale]/${name}/page.tsx`), "utf8").replace(/\s+/g, " ");
const trialAbuseSource = readFileSync(path.join(process.cwd(), "src/lib/trial-abuse.ts"), "utf8");

test("the privacy policy describes what we record and why", () => {
  const policy = page("privacy-policy");
  assert.match(policy, /MT5 account number you link to a licence/);
  assert.match(policy, /IP address you use when you sign in, start a free trial or link an MT5 account/);
  assert.match(policy, /which country that IP address is in, using a database that runs on our own servers/);
  assert.match(policy, /A free trial can only be used once per MT5 account/);
  assert.match(policy, /legitimate interest/);
  assert.match(policy, /GeoLite2 data created by MaxMind/);
});

test("the privacy policy's retention period is the one the code enforces", () => {
  assert.equal(USER_IP_RETENTION_DAYS, 365);
  assert.equal(SESSION_RETENTION_DAYS, 365);
  assert.match(page("privacy-policy"), /deleted one year after we last saw them/);
});

test("the policy does not promise to delete the MT5 history, which is what makes the rule hold", () => {
  const policy = page("privacy-policy");
  assert.match(policy, /MT5 account numbers linked to licences are kept for as long as we need them to apply the free-trial rule/);
  assert.ok(!/MT5 account numbers? .{0,60}(deleted|removed) (one|a) year/.test(policy));
});

test("the refund policy says a licence withdrawn for abuse is not refunded, and that rights by law are untouched", () => {
  const refund = page("refund-policy");
  assert.match(refund, /Free trials cost nothing, so there is nothing to refund/);
  assert.match(refund, /one per MT5 account/);
  assert.match(refund, /is not eligible for a refund/);
  assert.match(refund, /does not affect any rights you have by law/);
});

test("the terms ask for one trial per person and per account", () => {
  const terms = page("terms-conditions");
  assert.match(terms, /one per person and one per MT5 account/);
  assert.match(terms, /Creating several accounts to get repeated free trials is not allowed/);
});

test("the FAQ and the help article tell people what the error means", () => {
  const faq = buildExtraFaq(FIXTURE_FACTS).find((item) => item.id === "trial");
  assert.ok(faq && /never been used with a GoldBot licence, free or paid/.test(faq.a));
  const article = getTutorialArticle("free-trial", FIXTURE_FACTS);
  assert.ok(article);
  const text = JSON.stringify(article.blocks);
  assert.match(text, /This MT5 account has already been used with a GoldBot licence/);
  assert.match(text, /support@al-ai-fx\.xyz/);
});

test("the error people see is the one the help article quotes", () => {
  const match = trialAbuseSource.match(/"(This MT5 account has already been used with a GoldBot licence[^"]*)"/);
  assert.ok(match, "the message constant starts with the quoted sentence");
  assert.match(trialAbuseSource, /support@al-ai-fx\.xyz/);
});
