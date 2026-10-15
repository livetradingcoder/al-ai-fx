import test from "node:test";
import assert from "node:assert/strict";

import {
  DAY_MS,
  HOUR_MS,
  MAX_AGE_DAYS,
  MAX_FAILURES,
  MAX_PER_RUN,
  MAX_STAGES,
  MIN_GAP_HOURS,
  REMINDER_HOURS,
  dueStage,
  maskEmail,
  planReminders,
  reminderKind,
  type ReminderCandidate,
} from "./mt5-reminder-schedule";

const NOW = new Date("2026-10-16T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * HOUR_MS);
const hoursAhead = (hours: number) => new Date(NOW.getTime() + hours * HOUR_MS);
const none = { lastReminderAtByUser: new Map<string, Date>() };

let counter = 0;
function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  counter += 1;
  return {
    subscriptionId: `sub_${counter}`,
    userId: `user_${counter}`,
    email: `person${counter}@example.com`,
    tier: "FREE_TRIAL",
    robotName: "PrecisionTrader",
    createdAt: hoursAgo(13),
    expiresAt: hoursAhead(59),
    sent: 0,
    failures: 0,
    lastSentAt: null,
    ...overrides,
  };
}

test("a trial is a trial, anything paid is paid, the internal tier is nobody", () => {
  assert.equal(reminderKind("FREE_TRIAL"), "trial");
  assert.equal(reminderKind("ONE_MONTH"), "paid");
  assert.equal(reminderKind("LIFETIME_SOURCE"), "paid");
  assert.equal(reminderKind("SECRET_TEST_TIER"), null);
});

test("reminders come due at their hour and not before", () => {
  assert.equal(dueStage("trial", hoursAgo(11.9), NOW), 0);
  assert.equal(dueStage("trial", hoursAgo(12), NOW), 1);
  assert.equal(dueStage("trial", hoursAgo(47.9), NOW), 1);
  assert.equal(dueStage("trial", hoursAgo(48), NOW), 2);
  assert.equal(dueStage("trial", hoursAgo(500), NOW), 2, "a trial never gets a third");
  assert.equal(dueStage("paid", hoursAgo(23.9), NOW), 0);
  assert.equal(dueStage("paid", hoursAgo(24), NOW), 1);
  assert.equal(dueStage("paid", hoursAgo(72), NOW), 2);
  assert.equal(dueStage("paid", hoursAgo(168), NOW), 3);
  assert.equal(dueStage("paid", hoursAgo(5000), NOW), 3);
  assert.equal(dueStage("paid", hoursAhead(1), NOW), 0, "a clock-skewed future licence waits");
});

test("the schedule is increasing, and the trial's last reminder lands before it ends", () => {
  for (const hours of Object.values(REMINDER_HOURS)) {
    assert.deepEqual([...hours], [...hours].sort((a, b) => a - b));
    for (let i = 1; i < hours.length; i += 1) {
      assert.ok(hours[i] - hours[i - 1] >= MIN_GAP_HOURS, "gap between reminders honours the minimum");
    }
  }
  assert.ok(REMINDER_HOURS.trial[REMINDER_HOURS.trial.length - 1] < 72, "the trial lasts 72 hours");
  assert.equal(MAX_STAGES, 3);
});

test("a licence that is not yet due gets nothing", () => {
  assert.deepEqual(planReminders([candidate({ createdAt: hoursAgo(11) })], none, NOW), []);
});

test("a due licence gets the reminder numbered after the last one sent", () => {
  const plans = planReminders([candidate({ createdAt: hoursAgo(13) })], none, NOW);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].stage, 1);
  assert.equal(plans[0].kind, "trial");
});

test("a reminder that already went out is not sent again", () => {
  assert.deepEqual(planReminders([candidate({ createdAt: hoursAgo(13), sent: 1 })], none, NOW), []);
  assert.deepEqual(planReminders([candidate({ createdAt: hoursAgo(60), sent: 2 })], none, NOW), []);
  assert.deepEqual(
    planReminders([candidate({ tier: "ONE_MONTH", createdAt: hoursAgo(200), expiresAt: null, sent: 3 })], none, NOW),
    [],
  );
});

test("a licence that missed earlier reminders jumps to the latest due one, not a burst", () => {
  const plans = planReminders([candidate({ createdAt: hoursAgo(60), sent: 0 })], none, NOW);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].stage, 2);
});

test("a paid licence works through its three reminders", () => {
  const paid = { tier: "SIX_MONTHS", expiresAt: hoursAhead(24 * 170) };
  assert.equal(planReminders([candidate({ ...paid, createdAt: hoursAgo(25) })], none, NOW)[0].stage, 1);
  assert.equal(planReminders([candidate({ ...paid, createdAt: hoursAgo(73), sent: 1 })], none, NOW)[0].stage, 2);
  assert.equal(planReminders([candidate({ ...paid, createdAt: hoursAgo(169), sent: 2 })], none, NOW)[0].stage, 3);
});

test("an expired or lifetime licence is judged on its expiry, not skipped by accident", () => {
  assert.deepEqual(planReminders([candidate({ expiresAt: hoursAgo(1) })], none, NOW), []);
  assert.deepEqual(planReminders([candidate({ expiresAt: NOW })], none, NOW), []);
  assert.equal(
    planReminders([candidate({ tier: "LIFETIME", expiresAt: null, createdAt: hoursAgo(30) })], none, NOW).length,
    1,
  );
});

test("a licence older than the cut-off is left alone", () => {
  const old = candidate({ tier: "LIFETIME", expiresAt: null, createdAt: new Date(NOW.getTime() - (MAX_AGE_DAYS + 1) * DAY_MS) });
  assert.deepEqual(planReminders([old], none, NOW), []);
  const recent = candidate({ tier: "LIFETIME", expiresAt: null, createdAt: new Date(NOW.getTime() - (MAX_AGE_DAYS - 1) * DAY_MS) });
  assert.equal(planReminders([recent], none, NOW).length, 1);
});

test("a licence whose reminders keep bouncing is dropped", () => {
  assert.equal(planReminders([candidate({ failures: MAX_FAILURES - 1 })], none, NOW).length, 1);
  assert.deepEqual(planReminders([candidate({ failures: MAX_FAILURES })], none, NOW), []);
});

test("the internal test tier never gets a reminder", () => {
  assert.deepEqual(planReminders([candidate({ tier: "SECRET_TEST_TIER", expiresAt: null })], none, NOW), []);
});

test("nobody is reminded twice inside the minimum gap", () => {
  const c = candidate({ userId: "u_recent" });
  const justNow = { lastReminderAtByUser: new Map([["u_recent", hoursAgo(MIN_GAP_HOURS - 1)]]) };
  const longAgo = { lastReminderAtByUser: new Map([["u_recent", hoursAgo(MIN_GAP_HOURS + 1)]]) };
  assert.deepEqual(planReminders([c], justNow, NOW), []);
  assert.equal(planReminders([c], longAgo, NOW).length, 1);
});

test("one email per person per run, for the licence that matters most", () => {
  const trial = candidate({ userId: "u_both", subscriptionId: "trial_sub" });
  const paid = candidate({
    userId: "u_both",
    subscriptionId: "paid_sub",
    tier: "ONE_MONTH",
    createdAt: hoursAgo(30),
    expiresAt: hoursAhead(24 * 29),
  });
  for (const order of [[trial, paid], [paid, trial]]) {
    const plans = planReminders(order, none, NOW);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].candidate.subscriptionId, "paid_sub");
  }

  const older = candidate({ userId: "u_two", subscriptionId: "older", createdAt: hoursAgo(40) });
  const newer = candidate({ userId: "u_two", subscriptionId: "newer", createdAt: hoursAgo(14) });
  const plans = planReminders([older, newer], none, NOW);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].candidate.subscriptionId, "newer", "among equals, the newer licence");
});

test("the cap keeps the licences that expire soonest", () => {
  const soon = candidate({ subscriptionId: "soon", expiresAt: hoursAhead(5) });
  const later = candidate({ subscriptionId: "later", expiresAt: hoursAhead(50) });
  const forever = candidate({ subscriptionId: "forever", tier: "LIFETIME", expiresAt: null, createdAt: hoursAgo(30) });
  const plans = planReminders([forever, later, soon], none, NOW, 2);
  assert.deepEqual(plans.map((p) => p.candidate.subscriptionId), ["soon", "later"]);
});

test("a big backlog is capped per run", () => {
  const backlog = Array.from({ length: MAX_PER_RUN + 40 }, () => candidate());
  assert.equal(planReminders(backlog, none, NOW).length, MAX_PER_RUN);
  assert.deepEqual(planReminders(backlog, none, NOW, 0), []);
});

test("masked emails hide the name but keep the domain", () => {
  assert.equal(maskEmail("klevis@gmail.com"), "k***@gmail.com");
  assert.equal(maskEmail("not-an-email"), "***");
  assert.equal(maskEmail("@example.com"), "***");
});
