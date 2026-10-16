import test from "node:test";
import assert from "node:assert/strict";

import { classifyTrialUser, csvCell, isSegmentKey, isTestEmail, toCsv } from "./segments";

const NOW = new Date("2026-10-16T12:00:00Z");
const future = new Date("2026-10-18T12:00:00Z");
const past = new Date("2026-10-13T12:00:00Z");

const trial = (over: Partial<{ mt5AccountNumber: string | null; expiresAt: Date | null }> = {}) => ({
  tier: "FREE_TRIAL",
  mt5AccountNumber: null,
  expiresAt: future,
  ...over,
});

test("a running trial with no MT5 is 'not-linked-active'", () => {
  const c = classifyTrialUser({ subscriptions: [trial()], proofStatuses: [], shareStatus: null }, NOW);
  assert.deepEqual(c.segments, ["not-linked-active"]);
  assert.equal(c.linked, false);
  assert.equal(c.expired, false);
});

test("an ended trial with no MT5 is 'not-linked-expired'", () => {
  const c = classifyTrialUser({ subscriptions: [trial({ expiresAt: past })], proofStatuses: [], shareStatus: null }, NOW);
  assert.deepEqual(c.segments, ["not-linked-expired"]);
  assert.equal(c.expired, true);
});

test("an empty or blank MT5 number counts as not linked", () => {
  for (const blank of ["", "   ", null]) {
    const c = classifyTrialUser({ subscriptions: [trial({ mt5AccountNumber: blank })], proofStatuses: [], shareStatus: null }, NOW);
    assert.equal(c.linked, false, String(blank));
  }
});

test("a linked trial with no results is both linked-active and linked-no-proof", () => {
  const c = classifyTrialUser({ subscriptions: [trial({ mt5AccountNumber: "26252623" })], proofStatuses: [], shareStatus: null }, NOW);
  assert.deepEqual(c.segments, ["linked-active", "linked-no-proof"]);
});

test("linked once results exist drops out of linked-no-proof", () => {
  const c = classifyTrialUser(
    { subscriptions: [trial({ mt5AccountNumber: "26252623", expiresAt: past })], proofStatuses: ["PENDING"], shareStatus: null },
    NOW,
  );
  assert.deepEqual(c.segments, ["linked-expired"]);
});

test("approved results without a share (or a rejected one) join proof-approved-no-share", () => {
  const base = { subscriptions: [trial({ mt5AccountNumber: "1" + "0".repeat(7) })], proofStatuses: ["APPROVED"] };
  assert.ok(classifyTrialUser({ ...base, shareStatus: null }, NOW).segments.includes("proof-approved-no-share"));
  assert.ok(classifyTrialUser({ ...base, shareStatus: "REJECTED" }, NOW).segments.includes("proof-approved-no-share"));
  assert.ok(!classifyTrialUser({ ...base, shareStatus: "PENDING" }, NOW).segments.includes("proof-approved-no-share"));
  assert.ok(!classifyTrialUser({ ...base, shareStatus: "APPROVED" }, NOW).segments.includes("proof-approved-no-share"));
});

test("someone who already bought is not a prospect in any list", () => {
  const c = classifyTrialUser(
    { subscriptions: [trial(), { tier: "ONE_MONTH", mt5AccountNumber: "5", expiresAt: future }], proofStatuses: [], shareStatus: null },
    NOW,
  );
  assert.equal(c.prospect, false);
  assert.deepEqual(c.segments, []);
});

test("an internal test tier is never a prospect", () => {
  const c = classifyTrialUser(
    { subscriptions: [trial(), { tier: "SECRET_TEST_TIER", mt5AccountNumber: null, expiresAt: future }], proofStatuses: [], shareStatus: null },
    NOW,
  );
  assert.equal(c.prospect, false);
});

test("no trial at all means no segments", () => {
  const c = classifyTrialUser({ subscriptions: [], proofStatuses: [], shareStatus: null }, NOW);
  assert.deepEqual(c.segments, []);
});

test("test addresses are recognised", () => {
  assert.equal(isTestEmail("klevis.x062+hooktest1@gmail.com"), true);
  assert.equal(isTestEmail("a+test@gmail.com"), true);
  assert.equal(isTestEmail("someone@example.com"), true);
  assert.equal(isTestEmail("lutaayabrian040@gmail.com"), false);
  assert.equal(isTestEmail("contest.winner@gmail.com"), false);
});

test("csv quotes what needs quoting and neuters spreadsheet formulas", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("@cmd"), "'@cmd");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(7), "7");
});

test("toCsv writes a header and CRLF rows in column order", () => {
  assert.equal(toCsv(["a", "b"], [{ b: 2, a: 1 }, { a: "x,y" }]), 'a,b\r\n1,2\r\n"x,y",\r\n');
});

test("segment keys are validated", () => {
  assert.equal(isSegmentKey("not-linked-active"), true);
  assert.equal(isSegmentKey("giveaway-subscribers"), true);
  assert.equal(isSegmentKey("everyone"), false);
  assert.equal(isSegmentKey("../etc/passwd"), false);
});
