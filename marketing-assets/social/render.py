#!/usr/bin/env python3
"""Render the social post visuals in this folder.

Each post is an HTML template (inline below) rendered by headless Chromium at
1080x1080 (feed) and 1080x1920 (story/reel cover), then saved as JPEG.

    python3 marketing-assets/social/render.py            # all posts, both sizes
    python3 marketing-assets/social/render.py 03 story   # one post, one size

Backgrounds come from ../../public/brand and ../imagery (already in the repo).
Fonts: Space Grotesk (the site's display font) from ./fonts if present, else Inter.
"""
import os, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
# headless_shell treats --window-size as the viewport; "chrome --headless=new" reserves ~85px of toolbar inside it.
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell")
SIZES = {"feed": (1080, 1080), "story": (1080, 1920)}

RISK = "Trading leveraged products such as gold carries a high level of risk. Past performance does not guarantee future results."

CSS = """
@font-face { font-family: "Space Grotesk"; src: url("FONTS/SpaceGrotesk-Bold.woff2") format("woff2"), url("FONTS/SpaceGrotesk-Bold.ttf"); font-weight: 700; }
@font-face { font-family: "Space Grotesk"; src: url("FONTS/SpaceGrotesk-Medium.woff2") format("woff2"), url("FONTS/SpaceGrotesk-Medium.ttf"); font-weight: 500; }
:root {
  --bg: #0d1117; --gold: #f59e0b; --gold-light: #fbbf24; --cream: #f4dca2;
  --text: #f3f4f6; --muted: #9ca3af; --line: rgba(245,158,11,.35);
}
* { box-sizing: border-box; margin: 0; }
html, body { width: WIDTHpx; height: HEIGHTpx; overflow: hidden; }
body {
  background: var(--bg); color: var(--text);
  font-family: "Space Grotesk", "Inter", system-ui, sans-serif;
  position: relative; -webkit-font-smoothing: antialiased;
}
.bg { position: absolute; inset: 0; background-size: cover; background-repeat: no-repeat; }
.shade { position: absolute; inset: 0; }
.frame { position: absolute; inset: 0; padding: 72px; display: flex; flex-direction: column; justify-content: space-between; }
.top, .bottom { display: flex; align-items: center; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 16px; }
.mono { width: 56px; height: 56px; border-radius: 50%; border: 2px solid var(--gold); display: grid; place-items: center;
        font-weight: 700; font-size: 20px; letter-spacing: .04em; color: var(--cream); background: rgba(13,17,23,.6); }
.word { line-height: 1.05; }
.word b { display: block; font-size: 24px; letter-spacing: .12em; color: var(--text); }
.word small { display: block; font-size: 13px; letter-spacing: .22em; color: var(--muted); margin-top: 4px; }
.pill { font-size: 16px; letter-spacing: .18em; text-transform: uppercase; color: var(--cream);
        border: 1px solid var(--line); border-radius: 999px; padding: 12px 22px; background: rgba(13,17,23,.55); }
.pill.solid { background: var(--gold); color: #1a1205; border-color: var(--gold); font-weight: 700; }
.pills { display: flex; gap: 14px; flex-wrap: wrap; }
.eyebrow { display: inline-flex; align-items: center; gap: 12px; font-size: 16px; letter-spacing: .22em; text-transform: uppercase;
           color: var(--gold-light); border: 1px solid var(--line); border-radius: 999px; padding: 12px 22px; background: rgba(13,17,23,.55); }
.eyebrow::before { content: ""; width: 10px; height: 10px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 14px var(--gold); }
h1 { font-weight: 700; line-height: 1.02; letter-spacing: -.02em; }
h1 .accent { color: var(--cream); }
.sub { color: #d1d5db; line-height: 1.4; font-weight: 500; }
.url { font-weight: 700; font-size: 26px; letter-spacing: .02em; color: var(--text); }
.risk { font-size: 15px; color: var(--muted); max-width: 560px; text-align: right; line-height: 1.35; }
.story .risk { max-width: 640px; }
.steps { display: flex; flex-direction: column; gap: 14px; }
.step { display: flex; align-items: center; gap: 22px; padding: 16px 24px; border-radius: 18px;
        background: rgba(13,17,23,.72); border: 1px solid rgba(255,255,255,.08); }
.num { width: 48px; height: 48px; border-radius: 50%; background: var(--gold); color: #1a1205; display: grid; place-items: center;
       font-weight: 700; font-size: 22px; flex: none; }
.step .t { flex: 1; font-size: 28px; font-weight: 500; }
.step .eta { font-size: 18px; letter-spacing: .12em; text-transform: uppercase; color: var(--gold-light); font-weight: 700; }
.big { font-weight: 700; letter-spacing: -.03em; line-height: .95; }
.big .accent { color: var(--gold-light); }
.cta { display: inline-block; background: var(--gold); color: #1a1205; font-weight: 700; border-radius: 999px; padding: 20px 36px; font-size: 26px; }
"""

def shell(brand_pill, body, cls="", bottom_right=None):
    bottom_right = bottom_right if bottom_right is not None else f'<div class="risk">{RISK}</div>'
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head>
<body class="{cls}">
  BACKGROUND
  <div class="frame">
    <div class="top">
      <div class="brand"><div class="mono">GB</div><div class="word"><b>GOLDBOT</b><small>BY AL-AI-FX</small></div></div>
      <div class="pill">{brand_pill}</div>
    </div>
    {body}
    <div class="bottom"><div class="url">al-ai-fx.xyz</div>{bottom_right}</div>
  </div>
</body></html>"""

# ---------------------------------------------------------------------------
# Post 01 — launch / brand intro
def post_01(size):
    story = size == "story"
    bg = ('<div class="bg" style="background-image:url(ROOT/public/brand/hero-robot-gold.png);'
          + ('background-size: auto 66%;background-position: 62% 42%;' if story else 'background-position: 68% center;')
          + '"></div>'
          '<div class="shade" style="background:'
          + ('linear-gradient(180deg, rgba(13,17,23,.98) 0%, rgba(13,17,23,.55) 30%, rgba(13,17,23,.15) 55%, rgba(13,17,23,.9) 78%, #0d1117 100%)' if story else 'linear-gradient(90deg, rgba(13,17,23,.97) 0%, rgba(13,17,23,.9) 38%, rgba(13,17,23,.35) 70%, rgba(13,17,23,.15) 100%)')
          + '"></div>')
    h = "116px" if story else "88px"
    sub = "34px" if story else "28px"
    body = f"""
    <div style="display:flex;flex-direction:column;gap:34px;max-width:{'100%' if story else '720px'};{'margin-top:auto;margin-bottom:auto;' if story else ''}">
      <div><span class="eyebrow">AI-assisted MT5 execution engine</span></div>
      <h1 style="font-size:{h}">Trade gold like a machine.<br><span class="accent">Because now you have one.</span></h1>
      <p class="sub" style="font-size:{sub};max-width:{'820px' if story else '640px'}">GoldBot finds the session breakout, places the trade and manages the recovery &mdash; on your MT5 account, minutes after checkout.</p>
      <div class="pills"><span class="pill solid">Free 3-day trial</span><span class="pill">Account-locked build</span><span class="pill">Holiday liquidity guard</span></div>
    </div>"""
    return shell("XAUUSD &middot; MT5", body, "story" if story else "").replace("BACKGROUND", bg)

# Post 02 — how it works
def post_02(size):
    story = size == "story"
    bg = ('<div class="bg" style="background-image:url(ROOT/public/brand/gold-circuit-16x9.jpg);background-position:center;"></div>'
          '<div class="shade" style="background:linear-gradient(180deg, rgba(13,17,23,.92) 0%, rgba(13,17,23,.78) 50%, rgba(13,17,23,.95) 100%)"></div>')
    steps = [("Choose a plan", "1 min"), ("Dashboard access created", "Instant"),
             ("Bind your MT5 account number", "30 sec"), ("Cloud-compile, locked to that account", "&lt; 15 sec"),
             ("Drop it into MT5 and go live", "2 min")]
    rows = "".join(f'<div class="step"><div class="num">{i+1}</div><div class="t">{t}</div><div class="eta">{e}</div></div>' for i, (t, e) in enumerate(steps))
    h = "96px" if story else "66px"
    body = f"""
    <div style="display:flex;flex-direction:column;gap:{'44px' if story else '30px'};{'margin-top:auto;margin-bottom:auto;' if story else ''}">
      <div><span class="eyebrow">How it works</span></div>
      <h1 style="font-size:{h}">From checkout to a live gold chart <span class="accent" style="white-space:nowrap">in minutes.</span></h1>
      <div class="steps" style="{'gap:22px' if story else ''}">{rows}</div>
      <p class="sub" style="font-size:{'28px' if story else '22px'};color:var(--muted)">One build per MT5 account. No laggy in-bot license ping. MetaTrader 5 only.</p>
    </div>"""
    return shell("Private build", body, "story" if story else "").replace("BACKGROUND", bg)

# Post 03 — free trial
def post_03(size):
    story = size == "story"
    bg = ('<div class="bg" style="background-image:url(ROOT/public/brand/hourglass-chart-16x9.jpg);'
          + ('background-size:auto 60%;background-position:center 30%;' if story else 'background-position: 78% center;')
          + '"></div>'
          '<div class="shade" style="background:'
          + ('linear-gradient(180deg, rgba(13,17,23,.97) 0%, rgba(13,17,23,.35) 28%, rgba(13,17,23,.2) 50%, rgba(13,17,23,.92) 66%, #0d1117 100%)' if story else 'linear-gradient(90deg, rgba(13,17,23,.98) 0%, rgba(13,17,23,.92) 42%, rgba(13,17,23,.45) 68%, rgba(13,17,23,.2) 100%)')
          + '"></div>')
    big = "200px" if story else "150px"
    body = f"""
    <div style="display:flex;flex-direction:column;gap:{'34px' if story else '28px'};max-width:{'100%' if story else '700px'};{'margin-top:auto;margin-bottom:36px;' if story else ''}">
      <div><span class="eyebrow">Free trial</span></div>
      <div class="big" style="font-size:{big}">3 days.<br><span class="accent">$0.</span><br>No card.</div>
      <p class="sub" style="font-size:{'34px' if story else '28px'};max-width:{'860px' if story else '620px'}">Run PrecisionTrader, our single-range gold breakout EA, on your own MT5 account. The trial activates instantly from checkout.</p>
      <div class="pills"><span class="cta">Start free at al-ai-fx.xyz</span></div>
      <p class="sub" style="font-size:{'24px' if story else '20px'};color:var(--muted)">Paid plans from $9 for 10 days &middot; Gold MultiRange 4 from $99 a month</p>
    </div>"""
    return shell("XAUUSD &middot; MT5", body, "story" if story else "").replace("BACKGROUND", bg)

POSTS = {"01": ("01-launch", post_01), "02": ("02-how-it-works", post_02), "03": ("03-free-trial", post_03)}

def render(key, size):
    name, fn = POSTS[key]
    w, h = SIZES[size]
    html = fn(size).replace("WIDTH", str(w)).replace("HEIGHT", str(h)).replace("ROOT", ROOT.as_uri()).replace("FONTS", (HERE / "fonts").as_uri())
    out = HERE / f"{name}-{'1x1' if size == 'feed' else '9x16'}.jpg"
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "post.html"; png = Path(td) / "post.png"
        src.write_text(html, encoding="utf-8")
        subprocess.run([CHROME, "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                        "--force-device-scale-factor=1", f"--window-size={w},{h}", f"--screenshot={png}",
                        "--virtual-time-budget=4000", src.as_uri()],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        from PIL import Image
        Image.open(png).convert("RGB").save(out, "JPEG", quality=92, optimize=True)
    print(out.relative_to(ROOT), f"{w}x{h}")

if __name__ == "__main__":
    keys = [sys.argv[1]] if len(sys.argv) > 1 else list(POSTS)
    sizes = [sys.argv[2]] if len(sys.argv) > 2 else list(SIZES)
    for k in keys:
        for s in sizes:
            render(k, s)
