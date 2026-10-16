// Builds the campaign emails as standalone HTML files.
//
//   node marketing-assets/email-campaigns/build.mjs
//
// Output goes to ./html/ (one file per email) plus ./html/index.html, a page you
// can open in a browser to preview every email. Import the .html files into
// Sequenzy.
//
// MERGE TAGS: Sequenzy's public docs do not publish its merge-tag syntax (they
// show Handlebars-style {{ }} only). Everything personal is defined once in
// TAGS below. If Sequenzy wants a different spelling (say {{subscriber.firstName}}),
// change it here and run the script again: every email updates.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "html");

const SITE = "https://www.al-ai-fx.xyz";

const TAGS = {
  firstName: "{{first_name}}",
  setupLink: "{{setup_link}}", // signs them in, opens guided setup (CSV column setup_link)
  tutorialLink: "{{tutorial_link}}", // signs them in, opens the "link your MT5" video (CSV column tutorial_link)
  portalLink: "{{portal_link}}", // their private results link (CSV column portal_link)
  couponCode: "{{coupon_code}}", // only for the backup "code delivered" email
  unsubscribe: "{{unsubscribe_url}}", // Sequenzy's own unsubscribe link
  address: "{{company_address}}", // your business postal address: required in marketing email
};

const C = {
  page: "#0c0907",
  card: "#17110d",
  border: "#2c2218",
  gold: "#f4dca2",
  goldDeep: "#d8b36a",
  title: "#fff7e3",
  text: "#e5dccb",
  muted: "#9e9079",
  onGold: "#1a130c",
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// **bold** and [text](url) only. Everything else is escaped. {{tags}} pass through.
function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.title};">$1</strong>`)
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      `<a href="$2" style="color:${C.gold};text-decoration:underline;">$1</a>`,
    );
}

const FOOTERS = {
  trial: (reason) =>
    `${reason} <a href="${TAGS.unsubscribe}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a>.`,
  list: `You asked for updates when you entered the giveaway. <a href="${TAGS.unsubscribe}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a> at any time.`,
};

const RISK =
  "Trading carries a risk of loss. Results differ from one account to the next, and past results are no guide to future ones. Nothing here is financial advice.";

function render(mail) {
  const paras = mail.paragraphs
    .map((p) => {
      if (typeof p === "string") {
        return `<p style="margin:0 0 16px 0;color:${C.text};font-size:16px;line-height:1.7;">${inline(p)}</p>`;
      }
      if (p.list) {
        const items = p.list
          .map((i) => `<li style="margin:0 0 8px 0;">${inline(i)}</li>`)
          .join("");
        return `<ul style="margin:0 0 16px 0;padding-left:20px;color:${C.text};font-size:16px;line-height:1.6;">${items}</ul>`;
      }
      if (p.steps) {
        const items = p.steps
          .map((i) => `<li style="margin:0 0 10px 0;">${inline(i)}</li>`)
          .join("");
        return `<ol style="margin:0 0 16px 0;padding-left:22px;color:${C.text};font-size:16px;line-height:1.6;">${items}</ol>`;
      }
      return "";
    })
    .join("\n              ");

  const cta = mail.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px 0;">
                <tr><td bgcolor="${C.gold}" style="border-radius:999px;">
                  <a href="${mail.cta.url}" style="display:inline-block;padding:14px 26px;color:${C.onGold};font-weight:700;font-size:16px;text-decoration:none;border-radius:999px;">${esc(mail.cta.label)}</a>
                </td></tr>
              </table>`
    : "";

  const secondary = mail.secondary
    ? `<p style="margin:14px 0 0 0;color:${C.muted};font-size:14px;line-height:1.6;">${inline(mail.secondary)}</p>`
    : "";

  const risk = mail.risk
    ? `<p style="margin:22px 0 0 0;color:${C.muted};font-size:12px;line-height:1.6;">${esc(RISK)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<title>${esc(mail.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page};">${esc(mail.preview)}&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
  <tr>
    <td align="center" style="padding:28px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">
        <tr>
          <td style="padding:0 6px 16px 6px;" align="left">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="padding-right:10px;"><img src="${SITE}/icon-192.png" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px;"></td>
              <td style="font-family:Arial,Helvetica,sans-serif;color:${C.title};font-size:16px;font-weight:700;">GoldBot <span style="color:${C.goldDeep};font-weight:400;">by AL-ai-FX</span></td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-radius:20px;padding:32px 28px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 12px 0;color:${C.goldDeep};font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">${esc(mail.eyebrow)}</p>
            <h1 style="margin:0 0 18px 0;color:${C.title};font-size:28px;line-height:1.25;font-family:Arial,Helvetica,sans-serif;">${inline(mail.title)}</h1>
            ${paras}
            ${cta}
            ${secondary}
            ${risk}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 8px 0 8px;font-family:Arial,Helvetica,sans-serif;color:${C.muted};font-size:12px;line-height:1.6;" align="left">
            <p style="margin:0 0 8px 0;">${mail.footer}</p>
            <p style="margin:0;">AL-ai-FX &middot; ${TAGS.address}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;
}

const TRIAL_WHY = "You are getting this because you started a free GoldBot trial.";

const MAILS = [
  {
    file: "01-not-linked-whats-blocking",
    segment: "not-linked-active",
    timing: "Day 1 of the trial (about 24 hours after signup)",
    subject: "Quick question about your GoldBot trial",
    preview: "You signed up but GoldBot has not started yet. What got in the way?",
    eyebrow: "Your free trial",
    title: `${TAGS.firstName}, what is stopping you?`,
    paragraphs: [
      "You started a GoldBot trial, but your MT5 account is not linked yet, so the robot cannot start. Your trial clock is already running, so we would rather help than wait.",
      "These are the three things people get stuck on:",
      {
        list: [
          "**I do not have an MT5 account.** Any broker that offers MetaTrader 5 works. A demo account is fine for the trial.",
          "**I cannot find my account number.** In MT5, open the Navigator panel and expand Accounts. The number in front of your broker's name is it.",
          "**It says the account was already used.** A free trial only links to an account that has never had a GoldBot licence. Use a different account, or reply and tell us.",
        ],
      },
      "The video below shows the whole thing in about a minute. If something else is in the way, just **reply to this email** and tell us what you see. A real person reads every reply.",
    ],
    cta: { label: "Watch the 1-minute setup video", url: TAGS.tutorialLink },
    secondary: `Prefer to go straight to it? [Open the setup page](${TAGS.setupLink}).`,
    footer: FOOTERS.trial(TRIAL_WHY),
  },
  {
    file: "02-not-linked-trial-ending",
    segment: "not-linked-active (days_left is 1 or less)",
    timing: "About 12 hours before the trial ends",
    subject: "Your GoldBot trial ends soon, and it has not started",
    preview: "Linking your MT5 account takes about a minute.",
    eyebrow: "Trial ending",
    title: `${TAGS.firstName}, your trial ends soon`,
    paragraphs: [
      "Your free trial ends within a day and GoldBot has not run yet. Linking your MT5 account takes about a minute, and your build is ready in under 15 seconds after that.",
      {
        steps: [
          "Open the setup page with the button below.",
          "Enter your MT5 account number and choose **Save & Lock**.",
          "Download your build and copy it into MT5.",
        ],
      },
      "Stuck? Reply to this email with where you got to and we will help you finish.",
    ],
    cta: { label: "Finish setting up", url: TAGS.setupLink },
    secondary: `Not sure where to find your account number? [Watch the short video](${TAGS.tutorialLink}).`,
    footer: FOOTERS.trial(TRIAL_WHY),
  },
  {
    file: "03-not-linked-expired",
    segment: "not-linked-expired",
    timing: "2 to 3 days after the trial ended",
    subject: "Your GoldBot trial ended before you got started",
    preview: "Tell us what got in the way. We read every reply.",
    eyebrow: "Trial ended",
    title: `${TAGS.firstName}, your trial ended before it began`,
    paragraphs: [
      "Your 3-day trial ended without GoldBot being linked to an MT5 account. That happens, and we would like to know why: was setup confusing, did you not have an account ready, or was the timing just bad?",
      "**Reply with one line** and we will read it. If something on our side was unclear, it helps us fix it for the next person.",
      "If you would still like to run GoldBot, the plans start with a short 10-day option, so you do not need to commit to months to try it.",
    ],
    cta: { label: "See the plans", url: `${SITE}/catalog` },
    secondary: "You can also just reply to this email. No sales call, no pressure.",
    risk: true,
    footer: FOOTERS.trial(TRIAL_WHY),
  },
  {
    file: "04a-linked-send-results-reward",
    segment: "linked-no-proof where promo_eligible = yes",
    timing: "Day 2 of the trial (about 36 hours after linking)",
    subject: "How is GoldBot going? Send your results, get a reward",
    preview: "Two minutes: a screenshot, and a discount if you share it.",
    eyebrow: "Your results",
    title: `${TAGS.firstName}, how is it going?`,
    paragraphs: [
      "GoldBot is linked to your MT5 account, so we would like to hear how your trial is going. Good days and bad days are both useful to us.",
      "Send a screenshot of your results (the History tab or your equity curve) through your private link. It takes about two minutes, and **nothing is shown publicly unless you tick the box and we approve it.**",
      {
        list: [
          "Send your screenshot and you get an extra chance in our giveaway.",
          "Share it on social media, tell us where, and you get a **one-time discount code** once we have checked your post. Your post must say you got a discount for sharing.",
        ],
      },
      "Hide your account number before you upload.",
    ],
    cta: { label: "Send my results", url: TAGS.portalLink },
    secondary: "The link is private to you and works for 45 days.",
    risk: true,
    footer: FOOTERS.trial(TRIAL_WHY),
  },
  {
    file: "04b-linked-send-results-feedback",
    segment: "linked-no-proof where promo_eligible = no",
    timing: "Day 2 of the trial (about 36 hours after linking)",
    subject: "How is GoldBot going?",
    preview: "Two minutes: a screenshot and a line about how it went.",
    eyebrow: "Your results",
    title: `${TAGS.firstName}, how is your trial going?`,
    paragraphs: [
      "GoldBot is linked to your MT5 account, so we would like to hear how your trial is going. Good days, bad days and questions are all welcome.",
      "You can send a screenshot of your results (the History tab or your equity curve) through your private link. It takes about two minutes. Nothing is shown publicly.",
      "Hide your account number before you upload. If something is not working as you expected, reply to this email and tell us. We will help.",
    ],
    cta: { label: "Send my results", url: TAGS.portalLink },
    secondary: "The link is private to you and works for 45 days.",
    risk: true,
    footer: FOOTERS.trial(TRIAL_WHY),
  },
  {
    file: "05-results-approved-share",
    segment: "proof-approved-no-share where promo_eligible = yes",
    timing: "Right after you approve a screenshot (or the next morning)",
    subject: "Your results are approved. Share them, get 25% off",
    preview: "Post it, send us the link, and get a one-time code.",
    eyebrow: "Reward",
    title: `${TAGS.firstName}, thanks for sending your results`,
    paragraphs: [
      "Your screenshot has been approved and you have an extra chance in the giveaway.",
      "One more step if you want it: **share your results on social media and send us the link to your post.** After we check it, you get a one-time 25% discount code for your first plan.",
      {
        steps: [
          "Open your private results page with the button below.",
          "Copy the suggested caption. It includes the line that says you get a discount for sharing, which your post needs.",
          "Post it on X, Instagram, Facebook, TikTok, YouTube, LinkedIn or Threads.",
          "Paste the link to your post and send it. We email your code once it is approved.",
        ],
      },
    ],
    cta: { label: "Share and get my code", url: TAGS.portalLink },
    risk: true,
    footer: FOOTERS.trial(TRIAL_WHY),
  },
  {
    file: "06-reward-code-delivered",
    segment: "Backup only: the app emails this code automatically when you approve a post",
    timing: "Only if the automatic email did not go out",
    subject: "Your 25% discount code",
    preview: "Thanks for sharing. Your one-time code is inside.",
    eyebrow: "Your reward",
    title: `${TAGS.firstName}, your discount code is ready`,
    paragraphs: [
      "We checked your post and it is approved. Thank you for sharing.",
      `Your one-time code is **${TAGS.couponCode}**. It takes 25% off your first plan, works on this email address only, and expires 30 days after we approved your post.`,
      "The button opens checkout. Enter this email address, then press Apply next to the code.",
    ],
    cta: { label: "Use my code", url: `${SITE}/checkout?robot=goldbot&tier=1-month&coupon=${TAGS.couponCode}` },
    footer: FOOTERS.trial(TRIAL_WHY),
  },
  {
    file: "07-trial-ended-keep-going",
    segment: "linked-expired",
    timing: "The day after the trial ended",
    subject: "Your GoldBot trial has ended",
    preview: "Keep GoldBot running with a plan, or tell us how it went.",
    eyebrow: "Trial ended",
    title: `${TAGS.firstName}, your trial has ended`,
    paragraphs: [
      "Your 3-day trial is over, so GoldBot has stopped on your account. If you want it to keep running, you can pick a plan: the shortest one is 10 days, so you do not have to commit to months.",
      "If it was not what you expected, **reply and tell us why.** We take it seriously, and it helps us improve.",
      "Whatever you decide, thanks for trying it.",
    ],
    cta: { label: "See the plans", url: `${SITE}/catalog` },
    secondary: `Have results to share? [Send them here](${TAGS.portalLink}).`,
    risk: true,
    footer: FOOTERS.trial(TRIAL_WHY),
  },
  {
    file: "08-giveaway-welcome",
    segment: "giveaway-subscribers",
    timing: "Day 0 (the app already sends a plain entry confirmation)",
    subject: "You're in the giveaway. Here is what GoldBot is",
    preview: "A short intro while you wait for the draw.",
    eyebrow: "Giveaway",
    title: "You are entered. Good luck!",
    paragraphs: [
      "Thanks for entering. We will email the winner after the draw closes, and no purchase is needed to enter or to win.",
      "While you wait, here is who we are: GoldBot is a family of trading robots (Expert Advisors) for gold on MetaTrader 5. Each one is built for your own MT5 account, and you can try it free for 3 days with no card.",
      "Over the next few days we will send a few short emails about how it works. You can unsubscribe at any time.",
    ],
    cta: { label: "See how GoldBot works", url: `${SITE}/features` },
    risk: true,
    footer: FOOTERS.list,
  },
  {
    file: "09-giveaway-nurture-1-how-it-works",
    segment: "giveaway-subscribers",
    timing: "Day 2",
    subject: "How GoldBot actually works (in plain English)",
    preview: "No jargon: what it does, what it needs, what it cannot do.",
    eyebrow: "How it works",
    title: "A robot for gold, explained simply",
    paragraphs: [
      "GoldBot is an Expert Advisor: a program that runs inside MetaTrader 5 and places trades by rules, on your own broker account, with your own money. It does not take your money and it does not manage your account.",
      {
        list: [
          "**Built for gold (XAUUSD) on MT5.** Not MT4, not the phone app.",
          "**Made for your account.** Your build is locked to the MT5 account number you give us.",
          "**Ready in under 15 seconds** after you enter that number.",
          "**It can lose.** No robot wins every trade, and we will never tell you otherwise.",
        ],
      },
      "The free trial lasts 3 days and needs no card, so you can see it running before deciding anything.",
    ],
    cta: { label: "Start the free trial", url: `${SITE}/catalog` },
    risk: true,
    footer: FOOTERS.list,
  },
  {
    file: "10-giveaway-nurture-2-results",
    segment: "giveaway-subscribers",
    timing: "Day 5",
    subject: "What real traders send us (and how we check it)",
    preview: "Screenshots from real MT5 accounts, reviewed before they appear.",
    eyebrow: "Real accounts",
    title: "Results from real accounts, checked first",
    paragraphs: [
      "People who try GoldBot can send us a screenshot of their own MT5 results. We review each one before it appears on our results page, and account numbers are hidden.",
      "We show good and not-so-good days, because results differ from one account to the next. Please read them that way: as examples of what people sent, not as a promise.",
      "If you want to see GoldBot running on your own account instead, the free trial is 3 days and needs no card.",
    ],
    cta: { label: "See shared results", url: `${SITE}/results` },
    secondary: `Or [start the free trial](${SITE}/catalog).`,
    risk: true,
    footer: FOOTERS.list,
  },
  {
    file: "11-giveaway-nurture-3-trial-reminder",
    segment: "giveaway-subscribers",
    timing: "Day 9",
    subject: "Your free GoldBot trial is still waiting",
    preview: "3 days, no card. Setup takes about a minute.",
    eyebrow: "Free trial",
    title: "Still curious? Try it free",
    paragraphs: [
      "You entered our giveaway, so you know we are here. If you would like to see GoldBot running on your own MT5 account, the free trial is 3 days and needs no card.",
      {
        steps: [
          "Start the trial and enter your email.",
          "Link your MT5 account. A short video shows how.",
          "Download your build and attach it to a gold chart.",
        ],
      },
      "Trial users who send us their results also get extra chances in our giveaways.",
    ],
    cta: { label: "Start the free trial", url: `${SITE}/catalog` },
    risk: true,
    footer: FOOTERS.list,
  },
  {
    file: "12-giveaway-winner",
    segment: "Send by hand to the winner only",
    timing: "Right after the draw",
    subject: "You won the giveaway!",
    preview: "Reply to claim your prize.",
    eyebrow: "Winner",
    title: `${TAGS.firstName}, you won!`,
    paragraphs: [
      "Congratulations. Your entry was drawn at random as the winner of our giveaway.",
      "To claim your prize, **reply to this email within 7 days** and we will set it up with you. If we do not hear back in that time, we may draw another winner.",
      "Thank you for entering.",
    ],
    footer: FOOTERS.trial("You are getting this because you entered our giveaway."),
  },
  {
    file: "13-giveaway-not-selected",
    segment: "giveaway-subscribers (everyone except the winner)",
    timing: "A day after the draw",
    subject: "The giveaway draw is done",
    preview: "Thanks for entering. Here is a way to try GoldBot anyway.",
    eyebrow: "Giveaway",
    title: "The draw is done",
    paragraphs: [
      "Thanks for entering. The winner has been drawn and contacted, and this time it was not you.",
      "If you would still like to try GoldBot, the 3-day free trial needs no card. Trial users who send us their results get extra chances in the next giveaway.",
    ],
    cta: { label: "Start the free trial", url: `${SITE}/catalog` },
    risk: true,
    footer: FOOTERS.list,
  },
];

mkdirSync(OUT, { recursive: true });

for (const mail of MAILS) {
  writeFileSync(join(OUT, `${mail.file}.html`), render(mail));
}

const rows = MAILS.map(
  (m) => `<tr>
  <td><a href="${m.file}.html">${m.file}</a></td>
  <td>${esc(m.segment)}</td>
  <td>${esc(m.timing)}</td>
  <td>${esc(m.subject)}</td>
</tr>`,
).join("\n");

writeFileSync(
  join(OUT, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Campaign emails</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:32px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}th{background:#f5f5f5}a{color:#06c}</style>
<h1>Campaign emails</h1>
<p>Open each to preview. Merge tags such as ${esc(TAGS.firstName)} are replaced by Sequenzy when it sends.</p>
<table><tr><th>File</th><th>Who gets it</th><th>When</th><th>Subject</th></tr>
${rows}
</table>`,
);

console.log(`Wrote ${MAILS.length} emails to ${OUT}`);
