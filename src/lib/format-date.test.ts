import test from "node:test";
import assert from "node:assert/strict";

import { formatDate, formatDateTime } from "./format-date";

test("dates print the same everywhere: day month year in UTC", () => {
  assert.equal(formatDate("2026-10-16T23:30:00Z"), "16 Oct 2026");
  assert.equal(formatDate(new Date("2026-01-05T00:00:00Z")), "5 Jan 2026");
});

test("date and time carry the time zone", () => {
  assert.equal(formatDateTime("2026-10-16T08:05:00Z"), "16 Oct 2026, 08:05 UTC");
});
