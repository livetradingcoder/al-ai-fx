# Social launch kit — GoldBot / al-ai-fx.xyz

Seven ready-to-post pieces to open the AL-ai-FX social accounts, each as a still and a short video, plus a 25 s launch video that strings the first three together. Each has a
1:1 feed image (`*-1x1.jpg`, 1080×1080) and a 9:16 story/reel cover
(`*-9x16.jpg`, 1080×1920), a short caption for X, a long caption for
Instagram / LinkedIn / Facebook, and a Higgsfield prompt for a motion version.

Every claim below is lifted from the live site (landing, catalog, FAQ, guides, checkout).
None of it promises returns — see the compliance note at the end.

Copy and layout live in `posts.py`. Regenerate the stills after editing it:

```bash
python3 marketing-assets/social/render.py          # all posts, both sizes
python3 marketing-assets/social/render.py 03 story # one post, one size
```

| # | Post | Angle | Files |
|---|------|-------|-------|
| 1 | Launch | Brand intro: what GoldBot is | `01-launch-1x1.jpg`, `01-launch-9x16.jpg` |
| 2 | How it works | Checkout → live chart in 5 steps | `02-how-it-works-1x1.jpg`, `02-how-it-works-9x16.jpg` |
| 3 | Free trial | 3 days, $0, no card | `03-free-trial-1x1.jpg`, `03-free-trial-9x16.jpg` |
| 4 | Free trial, how to claim it | The five-step path from catalog to a running trial | `04-free-trial-steps-1x1.jpg`, `04-free-trial-steps-9x16.jpg` |
| 5 | How to use it | Installing the .ex5 on MetaTrader 5 | `05-install-mt5-1x1.jpg`, `05-install-mt5-9x16.jpg` |
| 6 | Pricing | Every plan with its price and the 14-day rule | `06-pricing-1x1.jpg`, `06-pricing-9x16.jpg` |
| 7 | Robot lineup | PrecisionTrader, Gold MultiRange 4, Sniper Lite | `07-robot-lineup-1x1.jpg`, `07-robot-lineup-9x16.jpg` |

Suggested order, two days apart: 1 launch, 7 lineup, 3 free trial, 2 how it
works, 6 pricing, 4 trial steps, 5 install. Re-use the 9:16 stills as Stories
and the shorts as Reels between posts. Link in bio and in
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

---

## Post 4 — Free trial, how to claim it

**Image:** `04-free-trial-steps-1x1.jpg` (feed) · `04-free-trial-steps-9x16.jpg` (story) · **Video:** `04-free-trial-steps-9x16.mp4` / `-1x1.mp4` (10 s)

### X (short)

```
How to claim the free GoldBot trial (3 days, $0, no card):

1. Pick PrecisionTrader in the catalog
2. Choose Free Trial at checkout
3. Dashboard login lands in your inbox
4. Enter your MT5 account number, compile
5. Attach it to an XAUUSD chart

Start → al-ai-fx.xyz
```

### Instagram / LinkedIn / Facebook (long)

```
The free trial takes about five minutes to set up. Here's the whole path. ⏱️

1️⃣ Open al-ai-fx.xyz and pick PrecisionTrader in the catalog — it's the one with the "Free trial" badge
2️⃣ At checkout choose Free Trial. Email only, no card
3️⃣ Your dashboard login and a temporary password land in your inbox (check spam too)
4️⃣ In the dashboard, enter the MT5 account number the build should be locked to, then Compile & Download — under 15 seconds
5️⃣ Copy the .ex5 into MQL5/Experts, refresh the Navigator, drag it onto an XAUUSD chart and switch Algo Trading on

You get 3 days of PrecisionTrader, our single-range gold breakout EA, on your own account. No card on file, so there's nothing to cancel.

Good to know:
• MetaTrader 5 only, broker time GMT+3
• Trials can be limited per visitor — the checkout shows whether one is open to you
• Liked it? Paid plans start at $9 for 10 days

Start free → al-ai-fx.xyz (link in bio)

Risk warning: trading leveraged products such as gold carries a high level of risk. Past performance does not guarantee future results. Only trade with capital you can afford to lose.

#FreeTrial #GoldTrading #XAUUSD #MT5 #ExpertAdvisor #ForexEA #AlgoTrading #MetaTrader5
```

### Higgsfield prompt (motion version)

```
Start frame: attached. The black-and-gold robot head tilts a few degrees and its eye-beam scans slowly across the glowing amber chart tile on the pedestal, gold particles drift upward, soft push-in. Keep every text layer and the numbered cards perfectly still and sharp. No new text, no logos. 5 seconds, loopable.
```

---

## Post 5 — How to use it: install on MT5

**Image:** `05-install-mt5-1x1.jpg` (feed) · `05-install-mt5-9x16.jpg` (story) · **Video:** `05-install-mt5-9x16.mp4` / `-1x1.mp4` (10 s)

### X (short)

```
Install GoldBot on MT5 in 5 steps:

1. Dashboard: Compile & Download the .ex5
2. File → Open Data Folder → MQL5/Experts, paste it
3. Navigator: refresh Expert Advisors
4. Drag it onto an XAUUSD chart
5. Switch Algo Trading on

Full guide → al-ai-fx.xyz
```

### Instagram / LinkedIn / Facebook (long)

```
"Where do I put the file?" — the most common question after checkout. Here's the two-minute install. 🛠️

1️⃣ In your GoldBot dashboard click Compile & Download. The .ex5 is built for your MT5 account number in under 15 seconds
2️⃣ In MetaTrader 5: File → Open Data Folder, then MQL5 → Experts. Paste the .ex5 directly into Experts, not a sub-folder
3️⃣ In the Navigator (Ctrl+N if hidden) right-click Expert Advisors and choose Refresh — the robot won't appear until you do
4️⃣ Open an XAUUSD chart and drag the EA onto it
5️⃣ In the EA's Common tab tick Allow Algo Trading, click OK, and make sure the Algo Trading button in the toolbar is on

If it won't run: you're logged in to a different MT5 account from the one the build is locked to, or your broker's server time isn't GMT+3.

Keep it running: an EA only trades while MetaTrader is open and connected. A VPS keeps it live 24/5. On your own PC, start it by 07:00 CET each trading day and leave it running until it has traded.

Step-by-step guide under Tutorials on al-ai-fx.xyz (link in bio)

Risk warning: trading leveraged products such as gold carries a high level of risk. Past performance does not guarantee future results. Only trade with capital you can afford to lose.

#MT5 #MetaTrader5 #ExpertAdvisor #HowTo #GoldTrading #XAUUSD #ForexEA #AlgoTrading
```

### Higgsfield prompt (motion version)

```
Start frame: attached. The candlesticks on the curved monitor flicker and extend to the right as if trading live, the desk lamp glow breathes gently, steam rises from the coffee cup, very slow dolly in. Keep every text layer and the numbered cards perfectly still and sharp. No new text, no logos. 5 seconds.
```

---

## Post 6 — Pricing

**Image:** `06-pricing-1x1.jpg` (feed) · `06-pricing-9x16.jpg` (story) · **Video:** `06-pricing-9x16.mp4` / `-1x1.mp4` (10 s)

### X (short)

```
Simple plans. Serious execution.

Free trial — $0, 3 days, no card
10 days — $29
Monthly — $99
6 months — $449 (about $75/mo)
1 year — $999 (about $83/mo)

Every plan is a build compiled for your MT5 account. Stop loss in the first 14 days? Refunded.

al-ai-fx.xyz
```

### Instagram / LinkedIn / Facebook (long)

```
Simple plans. Serious execution. 💛

Every plan delivers a GoldBot build compiled for your own MT5 account. Prices shown are for Gold MultiRange 4, our four-range flagship.

• Free trial — $0 for 3 days of PrecisionTrader, no card
• 10 Days — $29. A fast validation window with the basic feature set
• Monthly — $99. All strategy features, unlimited downloads. Best place to start
• 6 Months — $449, about $75 a month. Adds priority Liquidity Guard
• 1 Year — $999, about $83 a month. Our most popular plan

Pay by card or crypto. Plans renew unless cancelled.

The 14-day rule: if the EA hits a stop loss within the first 14 calendar days after purchase, the robot price is refunded in full. Send your purchase email, order details and MT5 proof of the stop loss within that window.

Lifetime access and source-code licensing are arranged directly rather than through checkout — see Licensing on the site.

Pricing → al-ai-fx.xyz (link in bio)

Risk warning: trading leveraged products such as gold carries a high level of risk. Past performance does not guarantee future results. Only trade with capital you can afford to lose.

#GoldTrading #XAUUSD #MT5 #ExpertAdvisor #ForexEA #AlgoTrading #TradingBot #Pricing
```

### Higgsfield prompt (motion version)

```
Start frame: attached. The inner ring of the gold vault door rotates slowly and its glow intensifies, scattered gold coins glint as the light sweeps across them, subtle push-in. Keep every text layer and the plan rows perfectly still and sharp. No new text, no logos. 5 seconds, loopable.
```

---

## Post 7 — The robot lineup

**Image:** `07-robot-lineup-1x1.jpg` (feed) · `07-robot-lineup-9x16.jpg` (story) · **Video:** `07-robot-lineup-9x16.mp4` / `-1x1.mp4` (10 s)

### X (short)

```
Pick your robot.

PrecisionTrader — one gold session range a day, hedged, fixed lot. Free 3-day trial, from $9.

Gold MultiRange 4 — four ranges a day, each with its own breakout and hedge. Prop-firm compatible. From $29.

Sniper Lite EA — coming soon.

al-ai-fx.xyz
```

### Instagram / LinkedIn / Facebook (long)

```
Same account-locked build. Different trading styles. 🤖

🎯 PrecisionTrader — Free trial
Single-range breakout EA for gold: one session range a day, hedged, with a fixed lot you control. The simplest way to see how GoldBot behaves on your account.
$9 for 10 days · $39 a month

👑 Gold MultiRange 4 — Flagship
Four independent gold session ranges a day, each with its own breakout and hedge — the GoldBot engine, expanded. Fixed stop loss on every trade, hedge capped at 5× the first lot, no grid, no martingale. Prop-firm compatible.
$29 for 10 days · $99 a month

🔭 Sniper Lite EA — Coming soon
A different animal: a multi-indicator confluence swing EA with an RSI pullback core, 8 confluence filters and 3-stage partial profit scaling. Priced at launch.

Not sure which fits your account? MultiRange robots trade several gold session ranges a day; Breakout robots trade one. Compare them side by side in the catalog, or start with the free trial.

All robots: MetaTrader 5 only, XAUUSD, one build per MT5 account number.

Catalog → al-ai-fx.xyz (link in bio)

Risk warning: trading leveraged products such as gold carries a high level of risk. Past performance does not guarantee future results. Only trade with capital you can afford to lose.

#GoldTrading #XAUUSD #MT5 #ExpertAdvisor #ForexEA #AlgoTrading #PropFirm #TradingBot
```

### Higgsfield prompt (motion version)

```
Start frame: attached. The black-and-gold robot head hovers with a gentle bob, the four amber chart tiles pulse brighter one after another from left to right, gold particles drift, slow push-in. Keep every text layer and the three robot cards perfectly still and sharp. No new text, no logos. 5 seconds, loopable.
```

## Videos

Every post also exists as a short video, built by `video.py` from the same
definition as its still (`posts.py`), so the still is the video's end frame
and works as its cover. All 30 fps, H.264, silent.

| File | Length | What happens |
|------|--------|--------------|
| `launch-video-9x16.mp4`, `launch-video-1x1.mp4` | 25 s | Posts 1 → 2 → 3 as one sequence with crossfades: headline lands line by line, the five steps appear, then "3 days. $0. No card." holds on the CTA |
| `04-free-trial-steps-*.mp4` | 10 s | Trial steps appear one after another over the PrecisionTrader artwork |
| `05-install-mt5-*.mp4` | 10 s | Install steps over the trading-desk image |
| `06-pricing-*.mp4` | 10 s | Plan rows stack up, the 1 Year row lands highlighted |
| `07-robot-lineup-*.mp4` | 10 s | The three robot cards reveal in turn |

Notes:

- **Add audio in the app.** The files are silent on purpose: trending audio
  picked inside Instagram or TikTok reaches further than a baked-in track, and
  there is no licence question.
- **Other cuts.** Scene letters are A launch, B how it works, C free trial,
  D trial steps, E install, F pricing, G lineup. `python3
  marketing-assets/social/video.py story A` renders only the 8 s launch scene;
  `story DE` renders trial steps followed by install as one clip.
- **Cover frame.** Use the matching still as the cover so the grid stays
  consistent.
- **Rebuild** after editing copy in `posts.py` (needs an ffmpeg with libx264:
  `pip install imageio-ffmpeg`, or set `FFMPEG=/path/to/ffmpeg`). Stills
  take seconds; the full video set takes a few minutes.
- Same compliance rules as the stills: no performance claims, risk line on
  every frame.

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
