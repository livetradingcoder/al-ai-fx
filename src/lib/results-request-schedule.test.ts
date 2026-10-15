import test from "node:test";
import assert from "node:assert/strict";

import { DAY_MS, HOUR_MS } from "./mt5-reminder-schedule";
import {
  MIN_DAYS_WITH_ROBOT,
  RESULTS_MAX_FAILURES,
  RESULTS_MAX_PER_RUN,
  daysWithRobot,
  planResultsRequests,
  type ResultsCandidate,
} from "./results-request-schedule";

const NOW = new Date("2026-10-16T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
const daysAhead = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

let counter = 0;
function candidate(overrides: Partial<ResultsCandidate> = {}): ResultsCandidate {
  counter += 1;
  return {
    subscriptionId: `sub_${counter}`,
    userId: `user_${counter}`,
    email: `person${counter}@example.com`,
    tier: "ONE_MONTH",
    robotName: "Gold MultiRange 4",
    firstBuildAt: daysAgo(4),
    expiresAt: daysAhead(20),
    failures: 0,
    ...overrides,
  };
}

test("days with the robot are whole days since the first build", () => {
  assert.equal(daysWithRobot(daysAgo(0), NOW), 0);
  assert.equal(daysWithRobot(new Date(NOW.getTime() - 71 * HOUR_MS), NOW), 2);
  assert.equal(daysWithRobot(new Date(NOW.getTime() - 72 * HOUR_MS), NOW), 3);
  assert.equal(daysWithRobot(daysAgo(40), NOW), 40);
});

test("nobody is asked before their build is three days old", () => {
  assert.equal(MIN_DAYS_WITH_ROBOT, 3);
  assert.deepEqual(planResultsRequests([candidate({ firstBuildAt: new Date(NOW.getTime() - 71 * HOUR_MS) })], NOW), []);
  assert.equal(planResultsRequests([candidate({ firstBuildAt: new Date(NOW.getTime() - 72 * HOUR_MS) })], NOW).length, 1);
  assert.deepEqual(planResultsRequests([candidate({ firstBuildAt: daysAhead(1) })], NOW), [], "a clock-skewed future build waits");
});

test("a plan says how many days the person has had the robot", () => {
  const [plan] = planResultsRequests([candidate({ firstBuildAt: daysAgo(9) })], NOW);
  assert.equal(plan.daysWithRobot, 9);
});

test("an expired licence is not asked; a lifetime one is", () => {
  assert.deepEqual(planResultsRequests([candidate({ expiresAt: daysAgo(1) })], NOW), []);
  assert.deepEqual(planResultsRequests([candidate({ expiresAt: NOW })], NOW), []);
  assert.equal(planResultsRequests([candidate({ tier: "LIFETIME", expiresAt: null, firstBuildAt: daysAgo(200) })], NOW).length, 1);
});

test("a person whose request keeps bouncing is dropped, and the internal tier is never asked", () => {
  assert.equal(planResultsRequests([candidate({ failures: RESULTS_MAX_FAILURES - 1 })], NOW).length, 1);
  assert.deepEqual(planResultsRequests([candidate({ failures: RESULTS_MAX_FAILURES })], NOW), []);
  assert.deepEqual(planResultsRequests([candidate({ tier: "SECRET_TEST_TIER", expiresAt: null })], NOW), []);
});

test("one request per person, for the licence they have had longest", () => {
  const newer = candidate({ userId: "u_two", subscriptionId: "newer", firstBuildAt: daysAgo(5) });
  const older = candidate({ userId: "u_two", subscriptionId: "older", firstBuildAt: daysAgo(30) });
  for (const order of [[newer, older], [older, newer]]) {
    const plans = planResultsRequests(order, NOW);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].candidate.subscriptionId, "older");
  }
});

test("a person's other licence does not count if it is too new or expired", () => {
  const ready = candidate({ userId: "u_one", subscriptionId: "ready", firstBuildAt: daysAgo(6) });
  const tooNew = candidate({ userId: "u_one", subscriptionId: "new", firstBuildAt: daysAgo(1) });
  const plans = planResultsRequests([tooNew, ready], NOW);
  assert.deepEqual(plans.map((p) => p.candidate.subscriptionId), ["ready"]);
});

test("the people who have waited longest go first, and a big backlog is capped per run", () => {
  const oldest = candidate({ subscriptionId: "oldest", firstBuildAt: daysAgo(60), tier: "LIFETIME", expiresAt: null });
  const middle = candidate({ subscriptionId: "middle", firstBuildAt: daysAgo(10) });
  const newest = candidate({ subscriptionId: "newest", firstBuildAt: daysAgo(3) });
  assert.deepEqual(
    planResultsRequests([newest, oldest, middle], NOW, 2).map((p) => p.candidate.subscriptionId),
    ["oldest", "middle"],
  );

  const backlog = Array.from({ length: RESULTS_MAX_PER_RUN + 40 }, () => candidate());
  assert.equal(planResultsRequests(backlog, NOW).length, RESULTS_MAX_PER_RUN);
  assert.deepEqual(planResultsRequests(backlog, NOW, 0), []);
});
