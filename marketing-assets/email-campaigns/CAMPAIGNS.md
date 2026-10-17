# Trial-user email campaigns (send with Sequenzy)

The app does **not** send these. You download a list (CSV) from the admin, import it into
Sequenzy, and send the matching template. Templates are in `html/` (open `html/index.html`
to preview them all). Rebuild them with `node marketing-assets/email-campaigns/build.mjs`.

## Before the first send (all required)

1. **Add your postal address** in Sequenzy when you set up each marketing email (the templates leave it out on purpose).
2. **Check the merge-tag spelling.** Sequenzy's public docs do not show its merge-tag
   syntax. The templates use `{{first_name}}`, `{{setup_link}}`, `{{tutorial_link}}`,
   `{{portal_link}}`, `{{coupon_code}}`, `{{unsubscribe_url}}`.
   If Sequenzy spells them differently, edit the `TAGS` block at the top of `build.mjs`
   and run it again: every email updates. Send yourself one test first.
3. **Map the CSV columns to Sequenzy custom attributes** when you import:
   `first_name`, `setup_link`, `tutorial_link`, `portal_link`, `country`, `days_left`,
   `mt5_linked`, `promo_eligible`.
4. **The setup video** is an unlisted YouTube video embedded on the tutorial page
   `/tutorials/link-mt5-account`. Email 01's button opens that page after a one-click sign-in.
5. **Send from your own domain** with SPF, DKIM and DMARC set up in Sequenzy, and run the
   first send through mail-tester.com (same as you did for news.forrealfunding.com).

## Where the lists come from

Admin → **Users** → "Email lists" card. Each list is a CSV; the counts there use exactly
the same rules as the download. Never in a list: staff, blocked or deleted accounts, people
who clicked unsubscribe in our app emails, people who already bought, internal test tiers,
test addresses. The links inside each CSV are private to that person: do not share the files.

Giveaway entries: Admin → **Giveaways** → "Entries CSV" (everyone, for the draw) or
"Download opted-in list" (only people who ticked the email box, and not unsubscribed).
**Only email people on the opted-in list.** Entering the giveaway is separate from agreeing
to marketing email.

## Who gets what, and when

| # | Template | List (CSV) | Filter in Sequenzy | When |
|---|---|---|---|---|
| 01 | not-linked-whats-blocking | `not-linked-active` | none | ~24 h after signup |
| 02 | not-linked-trial-ending | `not-linked-active` | `days_left` is 1 or less | ~12 h before trial ends |
| 03 | not-linked-expired | `not-linked-expired` | none | 2 to 3 days after it ended |
| 04a | linked-send-results-reward | `linked-no-proof` | `promo_eligible` = yes | ~36 h after linking |
| 04b | linked-send-results-feedback | `linked-no-proof` | `promo_eligible` = no | ~36 h after linking |
| 05 | results-approved-share | `proof-approved-no-share` | `promo_eligible` = yes | after you approve their screenshot |
| 06 | reward-code-delivered | (by hand) | n/a | backup only: the app emails the code itself when you approve a post |
| 07 | trial-ended-keep-going | `linked-expired` | none | the day after the trial ended |
| 08 | giveaway-welcome | `giveaway-subscribers` | none | day 0 |
| 09 | giveaway-nurture-1-how-it-works | `giveaway-subscribers` | none | day 2 |
| 10 | giveaway-nurture-2-results | `giveaway-subscribers` | none | day 5 |
| 11 | giveaway-nurture-3-trial-reminder | `giveaway-subscribers` | none | day 9 |
| 12 | giveaway-winner | (by hand) | the winner only | right after the draw |
| 13 | giveaway-not-selected | `giveaway-subscribers` | everyone except the winner | the day after the draw |

Trials last only 3 days, so lists change daily. Download a fresh CSV each time you send
rather than reusing an old one, and send 01/02/04 within a day of the segment appearing.
People move between lists as they act (link, send results, share), which is why a fresh
export is the safe way to avoid emailing someone about a step they already did.

## Rules that keep this compliant (do not skip)

- **`promo_eligible = no` people never get 04a, 05, or any discount/giveaway message.**
  They are in a country where promotions are not offered. 04b has no reward. Admin →
  Users shows the country. The country gate is currently **off** (nothing is blocked), so
  `promo_eligible` is "yes" for everyone except people browsing the Arabic, Hindi, Bengali or
  Urdu site. To block countries again set `PROMO_BLOCKED_COUNTRIES` (for example `PK,IN`) in Coolify.
- **Never add earnings figures or promises** to a template. Every template that talks about
  results carries the risk line. Keep it.
- **Social posts must disclose the reward.** The caption in the results portal includes
  "Disclosure: I get a 25% discount for sharing this. #ad". When you review a shared post
  (Admin → Results & shares), reject any that leave it out.
- **Publishing a screenshot** needs all three: the person ticked the consent box, you approved
  it, and you pressed Publish. Check that no account number is visible first.
- Giveaway rules are shown on `/giveaway`. Edit them in Admin → Giveaways before going live
  (who can enter, how the winner is picked, closing date, where it is not offered).

## Sequenzy setup checklist

1. Import the CSV (map the columns above). Mark it as customers who agreed to receive email
   about their trial, or as giveaway opt-ins for the giveaway list.
2. Create the email, paste the template's HTML, set the subject and preview text from
   `html/index.html` (the subject line is the `<title>` of each file).
3. Send a test to yourself and click every button: `setup_link` and `tutorial_link` sign the
   person in; `portal_link` opens their private results page.
4. Schedule or send. Check opens/replies after a day. Replies to 01 and 03 tell you why
   people do not link: read them, they are the best product feedback you will get.

---

# Prop firm campaign: get prop firm traders to try and buy the robot

Seven emails (`html/20-` to `html/26-`) aimed at people who trade with a prop firm, such as
ForRealFunding's customers. The pitch is the one the site already documents at
`/prop-firm-gold-ea`: a **fixed stop loss on every trade, a hedge capped at 5× the first lot,
no grid and no martingale**. It never promises that a challenge will be passed (the site says
no EA can), and every email tells the reader to check their own firm's EA policy.

## The list comes from the firm, not from this app

These people are not in the GoldBot database, so there is no CSV button for them. Export them
from the firm's own list and give Sequenzy these columns:

| Column | Used for |
|---|---|
| `email` | sending |
| `first_name` | `{{first_name}}` (falls back to "there" if you set a default in Sequenzy) |
| `firm_name` | `{{firm_name}}` and the "why you are getting this" line, e.g. ForRealFunding |
| `status` | which variant: `active`, `breached`, `funded` |

## Who gets what

| # | Email | Who | When |
|---|---|---|---|
| 20 | prop-1-built-for-the-rules | everyone on the list | Day 0 |
| 21 | prop-2-see-it-first | everyone | Day 2 |
| 22 | prop-3-set-it-up-the-prop-firm-way | everyone | Day 4 |
| 23 | prop-4-what-we-wont-promise | everyone | Day 6 |
| 24 | prop-5-offer | everyone who has not bought | Day 9 |
| 25 | prop-variant-failed-challenge | `status = breached`, **instead of 20** | 3 to 7 days after the breach, then 21 to 24 |
| 26 | prop-variant-passed-funded | `status = funded`, **instead of 20** | a few days after they pass, then 22 to 24 |

Stop the sequence for anyone who buys. Email 23 links to the results wall: send it only after at
least three results are published on `/results`, otherwise delete that line first.

## Set up the offer (email 24)

1. Admin → **Coupons** → create a code for this audience (for example `PROP20`: Percent, 20,
   any robot, any plan, an expiry about a week out, one use per email).
2. In Sequenzy set the merge values for that send: `coupon_code` = the code, `coupon_discount`
   = `20%`, `coupon_end_date` = the date you set. The button opens checkout with the code filled in.
3. Optional: Admin → **Promo bar** → add the same code so it also shows in the site's top bar and
   the leaving pop-up.

## Before you send (read this)

- **Only email people who agreed to marketing email from the firm,** and honour every
  unsubscribe. Every email says why the person is receiving it (they have an account with the
  firm, a GoldBot partner) and carries an unsubscribe link.
- **Send from a verified sending domain,** warmed up and mail-tester checked, not from the main
  domain customers rely on for account email. A big first send to a cold list can hurt delivery.
- **Do not add claims.** No "pass your challenge", no profit figures, no "safe". The templates say
  "defined risk" because that is what the site documents.
- **Check the firm's own EA rules before you promote this to its customers.** Prop firms differ on
  expert advisors, hedging and news trading, and the emails tell readers to read their firm's
  policy: make sure that policy actually allows what you are selling.
- The free trial in email 21 is **PrecisionTrader**, not MultiRange. The emails say so on purpose.
