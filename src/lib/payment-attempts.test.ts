import test from "node:test";
import assert from "node:assert/strict";

import { ABANDONED_AFTER_MS, displayStatus } from "./payment-attempts";

const now = new Date("2026-10-27T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

test("an open checkout is in progress, then abandoned after half an hour", () => {
  assert.equal(displayStatus("STARTED", ago(60_000), now), "IN PROGRESS");
  assert.equal(displayStatus("STARTED", ago(ABANDONED_AFTER_MS), now), "IN PROGRESS");
  assert.equal(displayStatus("STARTED", ago(ABANDONED_AFTER_MS + 1), now), "ABANDONED");
});

test("an attempt that has an outcome keeps it however old it is", () => {
  for (const status of ["PAID", "FAILED", "CANCELED", "ERROR"]) {
    assert.equal(displayStatus(status, ago(10 * ABANDONED_AFTER_MS), now), status);
  }
});
