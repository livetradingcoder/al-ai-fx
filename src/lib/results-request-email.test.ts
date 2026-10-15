import test from "node:test";
import assert from "node:assert/strict";

import { renderResultsRequestEmail } from "./mail";
import { buildResultsRequestContent } from "./results-request-email";

const REPLY = "support@al-ai-fx.xyz";

function content(daysWithRobot = 4, robotName = "Gold MultiRange 4") {
  return buildResultsRequestContent({ robotName, daysWithRobot, replyAddress: REPLY });
}

test("the request names the robot and says how long the build has been ready", () => {
  const c = content(4);
  assert.equal(c.subject, "How is Gold MultiRange 4 working out for you?");
  assert.ok(c.title.includes("Gold MultiRange 4") && c.intro.includes("Gold MultiRange 4"));
  assert.ok(c.intro.includes("ready for 4 days"));
  assert.ok(content(31).intro.includes("ready for a while"), "a long-standing customer is not told '31 days'");
  assert.ok(content(1).intro.includes("ready for a day"), "never '1 days'");
  assert.ok(content(0).intro.includes("ready for a day"), "never '0 days'");
});

test("the button is a reply to the support address", () => {
  const c = content();
  assert.equal(c.buttonUrl, `mailto:${REPLY}?subject=My%20GoldBot%20results`);
  assert.equal(c.buttonLabel, "Reply with my results");
});

test("it asks for results rather than profits, and for both the good and the bad", () => {
  const words = JSON.stringify(content());
  assert.ok(/results/i.test(words));
  assert.ok(!/profit/i.test(words), "does not ask for profits");
  assert.ok(/bad days/i.test(words), "invites the bad days as well");
});

test("replying is not permission to publish, and a share needs a second yes", () => {
  const lines = content().detailLines.join(" ");
  assert.match(lines, /does not give us permission to publish/);
  assert.match(lines, /confirm with you before/);
});

test("it promises nothing: no returns, no price, no offer in exchange", () => {
  const c = content();
  const words = [c.subject, c.eyebrow, c.title, c.intro, ...c.detailLines].join(" ");
  assert.ok(!/profit|roi\b|earn|guarantee|win|%|\$|discount|offer|free|bonus|reward|prize|gift|sale/i.test(words), words);
  assert.match(words, /past results are no guide to future ones/);
});

test("the robot's name cannot inject markup", () => {
  const c = content(4, `Gold<script>alert(1)</script> & "Co"`);
  assert.ok(!/[<>&"']/.test(c.subject + c.title + c.intro));
  assert.ok(content(4, "<>").intro.includes("Your GoldBot build"));
});

test("the rendered email carries the opt-out, the one-click header and no paste-this-URL line", () => {
  const optOutUrl = "https://www.al-ai-fx.xyz/api/reminders/unsubscribe?token=xyz";
  const mail = renderResultsRequestEmail({ email: "person@example.com", robotName: "Gold MultiRange 4", daysWithRobot: 5, optOutUrl });

  assert.ok(mail.html.includes('href="mailto:'));
  assert.ok(mail.html.includes(`href="${optOutUrl}"`));
  assert.ok(mail.html.includes("Stop emails like this"));
  assert.ok(!mail.html.includes("copy and paste this URL"), "a mailto: button needs no paste-this-URL line");
  assert.ok(mail.text.includes(`Stop emails like this: ${optOutUrl}`));
  assert.ok(!/<[a-z/]/i.test(mail.text), "the text part has no markup");
  assert.deepEqual(mail.headers, {
    "List-Unsubscribe": `<${optOutUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  });
});

test("the setup reminders keep their paste-this-URL line", async () => {
  const { renderMt5ReminderEmail } = await import("./mail");
  const mail = renderMt5ReminderEmail({
    email: "person@example.com", kind: "trial", stage: 1, robotName: "PrecisionTrader", expiresAt: null,
    magicLinkUrl: "https://www.al-ai-fx.xyz/magic-login?token=abc", optOutUrl: "https://www.al-ai-fx.xyz/api/reminders/unsubscribe?token=xyz",
  });
  assert.ok(mail.html.includes("copy and paste this URL"));
});
