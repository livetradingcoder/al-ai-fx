# Social launch kit — GoldBot / al-ai-fx.xyz

Three ready-to-post pieces to open the AL-ai-FX social accounts. Each has a
1:1 feed image (`*-1x1.jpg`, 1080×1080) and a 9:16 story/reel cover
(`*-9x16.jpg`, 1080×1920), a short caption for X, a long caption for
Instagram / LinkedIn / Facebook, and a Higgsfield prompt for a motion version.

Every claim below is lifted from the live site (landing, catalog, FAQ, guides).
None of it promises returns — see the compliance note at the end.

Regenerate the images after editing `render.py`:

```bash
python3 marketing-assets/social/render.py          # all posts, both sizes
python3 marketing-assets/social/render.py 03 story # one post, one size
```

| # | Post | Angle | Files |
|---|------|-------|-------|
| 1 | Launch | Brand intro: what GoldBot is | `01-launch-1x1.jpg`, `01-launch-9x16.jpg` |
| 2 | How it works | Checkout → live chart in 5 steps | `02-how-it-works-1x1.jpg`, `02-how-it-works-9x16.jpg` |
| 3 | Free trial | 3 days, $0, no card | `03-free-trial-1x1.jpg`, `03-free-trial-9x16.jpg` |

Suggested order: post 1 on day 1, post 2 two days later, post 3 two days
after that, then re-use the 9:16 versions as Stories. Link in bio and in
every caption: **https://al-ai-fx.xyz**

---

## Post 1 — Launch

**Image:** `01-launch-1x1.jpg` (feed) · `01-launch-9x16.jpg` (story)

### X (short)

```
Trade gold like a machine. Because now you have one.

GoldBot finds the XAUUSD session breakout, places the trade and manages the recovery — on your own MT5 account.

Free 3-day trial, no card → al-ai-fx.xyz

Leveraged trading carries a high level of risk.
```

### Instagram / LinkedIn / Facebook (long)

```
Trade gold like a machine. Because now you have one. 🥇🤖

Meet GoldBot by AL-ai-FX — an expert advisor built only for gold (XAUUSD) on MetaTrader 5.

What it does, on your own MT5 account:
• Finds the session breakout
• Places the trade
• Manages the recovery with structured hedging, not brute-force escalation
• Sits out thin sessions — UK, US, DE, FR and IT bank holidays are screened automatically

What makes it different:
• Compiled in the cloud for your MT5 account number. One build per account, no laggy in-bot license ping
• Live in minutes, not days
• Prop-firm compatible MultiRange builds: a fixed stop loss on every trade, no grid, no martingale

Start with the free 3-day trial. No card needed.
🔗 al-ai-fx.xyz (link in bio)

Risk warning: trading leveraged products such as gold carries a high level of risk. Past performance does not guarantee future results. Only trade with capital you can afford to lose.

#GoldTrading #XAUUSD #MT5 #ExpertAdvisor #ForexEA #AlgoTrading #MetaTrader5 #TradingBot #GoldBot
```

### Higgsfield prompt (motion version)

Image-to-video, 5 s, 1:1 or 9:16, using the rendered JPG as the start frame.
Keep the text layer static; animate only the background.

```
Start frame: attached. Slow cinematic push-in on a black-and-gold humanoid robot standing beside stacked fine-gold bars, deep navy studio, a glowing gold candlestick chart rising behind it. Subtle lens flare drifting across the gold "G" emblem, floating gold dust particles, soft rim light. Camera: slow dolly in, no pan. Mood: calm, precise, premium. Keep all on-screen text perfectly still and legible, no new text, no logos, no distortion of letters.
```

Text-to-image alternative (text-free background, add the copy in `render.py`):

```
Premium product-shot of a sleek black-and-gold humanoid trading robot in profile, glowing gold "G" emblem on the helmet, stacked fine-gold bullion bars on a reflective black floor, rising gold candlestick chart as a light trail in the background, deep navy #0d1117 backdrop, amber #f59e0b accent lighting, cinematic rim light, 8k, no text, no letters, no numbers, no watermark.
```

---

## Post 2 — How it works

**Image:** `02-how-it-works-1x1.jpg` (feed) · `02-how-it-works-9x16.jpg` (story)

### X (short)

```
From checkout to a live gold chart in minutes.

1. Choose a plan
2. Dashboard access is created instantly
3. Enter your MT5 account number
4. GoldBot is cloud-compiled for that account in under 15 seconds
5. Drop the .ex5 into MT5 and go live

MT5 only → al-ai-fx.xyz
```

### Instagram / LinkedIn / Facebook (long)

```
No waiting for a license email. No shared files. No "contact admin for activation". ⚡

Here's how GoldBot goes from checkout to a live gold chart:

1️⃣ Choose a plan (about 1 minute)
2️⃣ Your dashboard account is created instantly against your purchase email
3️⃣ Enter the MT5 account number that should own the build (30 seconds)
4️⃣ GoldBot is compiled in the cloud, locked to that exact account (under 15 seconds)
5️⃣ Copy the .ex5 into MQL5/Experts, attach it to an XAUUSD chart, set your risk profile, go live (about 2 minutes)

Why the account-locked build matters:
• One executable per MT5 account, so licensing stays clean
• No web-request license ping slowing the EA down inside the terminal
• Passed a prop-firm challenge? Move the registered account from your dashboard — up to twice a month

Requirements: MetaTrader 5 with broker time set to GMT+3. MT4 is not supported.

Full install guide under Tutorials on al-ai-fx.xyz (link in bio)

Risk warning: trading leveraged products such as gold carries a high level of risk. Past performance does not guarantee future results. Only trade with capital you can afford to lose.

#MT5 #MetaTrader5 #ExpertAdvisor #GoldTrading #XAUUSD #AlgoTrading #ForexEA #PropFirm #TradingAutomation
```

### Higgsfield prompt (motion version)

```
Start frame: attached. Macro shot of a dark circuit board where glowing amber signal lines pulse and travel along the traces like data flowing, bokeh gold highlights breathing softly, very slow camera drift to the right. Keep the five numbered step cards and all text perfectly still and sharp. No new text, no logos. Loopable, 5 seconds, calm and technical.
```

Text-to-image alternative:

```
Extreme macro of a dark PCB motherboard, glowing amber circuit traces forming a rising line chart, shallow depth of field, gold bokeh lights, deep navy #0d1117 background, amber #f59e0b glow, glass-and-gold aesthetic, 8k, no text, no letters, no numbers, no watermark.
```

---

## Post 3 — Free trial

**Image:** `03-free-trial-1x1.jpg` (feed) · `03-free-trial-9x16.jpg` (story)

### X (short)

```
3 days. $0. No card.

Run PrecisionTrader, our single-range gold breakout EA, on your own MT5 account. The trial activates the moment you check out.

Start free → al-ai-fx.xyz

Trading leveraged products carries a high level of risk.
```

### Instagram / LinkedIn / Facebook (long)

```
Try it before you pay for it. ⏳

The GoldBot free trial gives you 3 days of PrecisionTrader — our single-range gold (XAUUSD) breakout EA with a hedged approach and a fixed lot you control — on your own MetaTrader 5 account.

• $0, no card
• Activates instantly at checkout
• Same cloud-compiled, account-locked build as the paid plans
• Your dashboard, your MT5 account number, your settings

When you're ready for more:
• PrecisionTrader from $9 for 10 days
• Gold MultiRange 4 — four independent session ranges a day, prop-firm compatible — from $29 for 10 days or $99 a month

And on paid plans: if the EA hits a stop loss within your first 14 days, the robot price is refunded in full.

Start free → al-ai-fx.xyz (link in bio)

Risk warning: trading leveraged products such as gold carries a high level of risk. Past performance does not guarantee future results. Only trade with capital you can afford to lose.

#GoldTrading #XAUUSD #MT5 #FreeTrial #ExpertAdvisor #ForexEA #AlgoTrading #MetaTrader5 #PropFirm
```

### Higgsfield prompt (motion version)

```
Start frame: attached. A glass hourglass with gold sand, the sand visibly streaming down and the lower chamber slowly filling, warm bokeh lights pulsing gently behind it on a dark reflective surface, subtle slow push-in. Keep the headline "3 days. $0. No card." and the button perfectly still and sharp. No new text, no logos. 5 seconds, elegant, calm.
```

Text-to-image alternative:

```
Elegant glass hourglass with brass pillars filled with fine glowing gold sand, mid-flow, on a dark reflective surface, warm amber bokeh lights in the background, deep charcoal-navy backdrop, product photography, soft studio light, 8k, no text, no letters, no numbers, no watermark.
```

---

## Platform notes

- **X:** 1:1 image + short caption. Pin post 1.
- **Instagram:** 1:1 to the feed with the long caption; 9:16 to Stories with a link sticker to al-ai-fx.xyz. The 9:16 files keep the headline inside the safe zone (away from the top 250 px and bottom 250 px the app covers with UI).
- **LinkedIn / Facebook:** 1:1 + long caption; drop the hashtags to 3–4 on LinkedIn.
- **TikTok / Reels:** use the 9:16 file as a cover and the Higgsfield motion render as the clip.
- Prices in the captions and on the post 3 image come from the live catalog on the day this kit was made (PrecisionTrader $9 / 10 days, $39 / month; Gold MultiRange 4 $29 / 10 days, $99 / month). Robot prices are set in the admin, so re-check the catalog before posting and re-render if they moved.
- The free trial can be limited per visitor (the checkout shows whether one is open), so if someone replies that they don't see it, point them to the 10-day plan.

## Compliance note

Forex/EA promotion is restricted on Meta, Google and TikTok paid ads. These
posts are written for **organic** use: no profit, return, win-rate or income
claims, a risk line in every caption and on every image, and product facts
only. Keep it that way when editing — unsubstantiated return claims are the
fastest way to lose an ad account, and the "verified member screenshots" on the
site should stay on the site rather than being reposted as performance proof.
