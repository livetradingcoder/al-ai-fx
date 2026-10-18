import test from "node:test";
import assert from "node:assert/strict";

import { renderMt5ReminderEmail } from "./mail";
import { buildMt5ReminderContent, formatUtc } from "./mt5-reminder-email";
import { REMINDER_HOURS, type ReminderKind } from "./mt5-reminder-schedule";

const SITE = "https://www.al-ai-fx.xyz";
const EXPIRES = new Date("2026-10-19T14:05:00Z");

const KINDS: ReminderKind[] = ["trial", "paid"];
const stagesOf = (kind: ReminderKind) => REMINDER_HOURS[kind].map((_, i) => i + 1);

function content(kind: ReminderKind, stage: number, expiresAt: Date | null = EXPIRES, robotName = "PrecisionTrader") {
  return buildMt5ReminderContent({ kind, stage, robotName, expiresAt, siteUrl: SITE });
}

test("dates read the same for everyone, in UTC", () => {
  assert.equal(formatUtc(EXPIRES), "Mon, 19 Oct 2026, 14:05 UTC");
});

test("every reminder has a subject, a title and steps, and names the robot", () => {
  for (const kind of KINDS) {
    for (const stage of stagesOf(kind)) {
      const c = content(kind, stage);
      assert.ok(c.subject.includes("PrecisionTrader") || c.subject.length > 10, `${kind} #${stage} subject`);
      assert.ok(c.title && c.intro && c.buttonLabel);
      assert.ok(c.intro.includes("PrecisionTrader"), `${kind} #${stage} intro names the robot`);
      assert.ok(c.detailLines.some((line) => line.startsWith("2. Enter your MT5 account number")));
      assert.ok(c.detailLines.some((line) => line.includes(`${SITE}/guides/install-ea-on-mt5`)));
      assert.ok(!/undefined|NaN|null/.test(JSON.stringify(c)), `${kind} #${stage} has no stray placeholders`);
    }
  }
});

test("each stage reads differently, and a stage past the last repeats the last", () => {
  for (const kind of KINDS) {
    const subjects = stagesOf(kind).map((stage) => content(kind, stage).subject);
    assert.equal(new Set(subjects).size, subjects.length, `${kind} subjects are distinct`);
  }
  assert.deepEqual(content("trial", 3), content("trial", 2));
  assert.deepEqual(content("paid", 9), content("paid", 3));
});

test("a trial says when it ends; a lifetime licence says it does not", () => {
  assert.ok(content("trial", 1).detailLines.includes("Your trial runs until Mon, 19 Oct 2026, 14:05 UTC."));
  assert.ok(content("trial", 2).intro.includes("ends on Mon, 19 Oct 2026, 14:05 UTC"));
  assert.ok(content("paid", 1).detailLines.includes("Your access runs until Mon, 19 Oct 2026, 14:05 UTC."));
  assert.ok(content("paid", 1, null).detailLines.includes("Your access does not expire."));
});

test("the robot's name cannot inject markup", () => {
  const c = content("paid", 1, EXPIRES, `Gold<script>alert(1)</script> & "Co"`);
  assert.ok(!/[<>&"']/.test(c.subject + c.title + c.intro), "markup characters are gone");
  assert.ok(c.intro.includes("Goldscriptalert(1)/script Co"));
  assert.ok(content("paid", 1, EXPIRES, "<>").intro.includes("Your GoldBot licence"), "an empty name falls back");
});

test("the copy makes no claim about returns, profit or price", () => {
  for (const kind of KINDS) {
    for (const stage of stagesOf(kind)) {
      const c = content(kind, stage);
      const words = [c.subject, c.eyebrow, c.title, c.intro, ...c.detailLines].join(" ");
      assert.ok(!/profit|roi\b|return|guarantee|earn|win|%|\$|discount|offer|sale/i.test(words), `${kind} #${stage}: ${words}`);
    }
  }
});

test("the rendered email carries the sign-in link, the opt-out, and the one-click header", () => {
  const magicLinkUrl = `${SITE}/magic-login?token=abc&callbackUrl=%2Fdashboard%2Fonboarding`;
  const optOutUrl = `${SITE}/api/reminders/unsubscribe?token=xyz`;
  const mail = renderMt5ReminderEmail({
    email: "person@example.com",
    kind: "trial",
    stage: 1,
    robotName: "PrecisionTrader",
    expiresAt: EXPIRES,
    magicLinkUrl,
    optOutUrl,
  });

  assert.equal(mail.subject, "Your PrecisionTrader trial is waiting for an MT5 account");
  assert.ok(mail.html.includes(`href="${magicLinkUrl}"`));
  assert.ok(mail.html.includes(`href="${optOutUrl}"`));
  assert.ok(mail.html.includes("Stop these reminders"));
  assert.ok(mail.html.includes(`href="${SITE}/forgot-password"`), "a way to get a fresh link once the button expires");
  assert.ok(mail.text.includes(magicLinkUrl));
  assert.ok(mail.text.includes(`Stop these reminders: ${optOutUrl}`));
  assert.ok(!/<[a-z/]/i.test(mail.text), "the text part has no markup");
  assert.deepEqual(mail.headers, {
    "List-Unsubscribe": `<${optOutUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  });
});
