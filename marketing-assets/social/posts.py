"""Shared definitions for the social kit.

One definition per post: copy, brand image, crop box, animation timeline. The
same definition drives the still (`render.py`, the end frame of the animation)
and the short video (`video.py`), so they always match. Each text element is a
`.layer` with a `data-id`; the timeline says when it fades and slides in.
"""
import os
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
# headless_shell treats --window-size as the viewport; "chrome --headless=new" reserves ~85px of toolbar inside it.
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell")
SIZES = {"feed": (1080, 1080), "story": (1080, 1920)}
BG = (13, 17, 23)  # --bg
RISK = "Trading leveraged products such as gold carries a high level of risk. Past performance does not guarantee future results."

CSS = """
@font-face { font-family: "Space Grotesk"; src: url("FONTS/SpaceGrotesk-Bold.woff2") format("woff2"); font-weight: 700; }
@font-face { font-family: "Space Grotesk"; src: url("FONTS/SpaceGrotesk-Medium.woff2") format("woff2"); font-weight: 500; }
:root {
  --bg: #0d1117; --gold: #f59e0b; --gold-light: #fbbf24; --cream: #f4dca2;
  --text: #f3f4f6; --muted: #9ca3af; --line: rgba(245,158,11,.35);
}
* { box-sizing: border-box; margin: 0; }
html, body { width: WIDTHpx; height: HEIGHTpx; overflow: hidden; }
body { background: transparent; color: var(--text); font-family: "Space Grotesk", "Inter", system-ui, sans-serif;
       position: relative; -webkit-font-smoothing: antialiased; }
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
h1 .accent, h1.accent { color: var(--cream); }
.sub { color: #d1d5db; line-height: 1.4; font-weight: 500; }
.url { font-weight: 700; font-size: 26px; letter-spacing: .02em; color: var(--text); }
.risk { font-size: 15px; color: var(--muted); max-width: 560px; text-align: right; line-height: 1.35; }
.story .risk { max-width: 640px; }
.steps { display: flex; flex-direction: column; gap: 14px; }
.step { display: flex; align-items: center; gap: 22px; padding: 16px 24px; border-radius: 18px;
        background: rgba(13,17,23,.74); border: 1px solid rgba(255,255,255,.08); }
.num { width: 48px; height: 48px; border-radius: 50%; background: var(--gold); color: #1a1205; display: grid; place-items: center;
       font-weight: 700; font-size: 22px; flex: none; }
.step .t { flex: 1; font-size: 28px; font-weight: 500; }
.step .eta { font-size: 18px; letter-spacing: .12em; text-transform: uppercase; color: var(--gold-light); font-weight: 700; white-space: nowrap; }
.big { font-weight: 700; letter-spacing: -.03em; line-height: .95; }
.big .accent { color: var(--gold-light); }
.cta { display: inline-block; background: var(--gold); color: #1a1205; font-weight: 700; border-radius: 999px; padding: 20px 36px; font-size: 26px; }
/* pricing rows */
.plan .t b { display: block; font-size: 28px; font-weight: 700; }
.plan .t small { display: block; font-size: 18px; color: var(--muted); margin-top: 4px; font-weight: 500; }
.plan .price { font-size: 36px; font-weight: 700; white-space: nowrap; }
.plan .price small { font-size: 15px; color: var(--muted); letter-spacing: .1em; text-transform: uppercase; margin-left: 8px; font-weight: 700; }
.plan.featured { border-color: var(--gold); background: rgba(245,158,11,.10); }
.plan.featured .price { color: var(--gold-light); }
/* robot cards */
.robot { flex-direction: column; align-items: stretch; gap: 10px; }
.rt { display: flex; align-items: center; justify-content: space-between; gap: 14px; font-size: 30px; font-weight: 700; }
.rd { font-size: 22px; color: #d1d5db; line-height: 1.35; font-weight: 500; }
.rp { font-size: 17px; color: var(--gold-light); letter-spacing: .1em; text-transform: uppercase; font-weight: 700; }
.badge { font-size: 13px; letter-spacing: .14em; text-transform: uppercase; padding: 7px 12px; border-radius: 999px; font-weight: 700; white-space: nowrap; }
.badge.trial { background: rgba(16,185,129,.16); color: #34d399; border: 1px solid rgba(16,185,129,.4); }
.badge.flag { background: var(--gold); color: #1a1205; }
.badge.soon { background: rgba(255,255,255,.07); color: var(--muted); border: 1px solid rgba(255,255,255,.16); }
"""

# Shade gradients (semi-transparent dark over the photo so text stays legible)
H_LEFT = "linear-gradient(90deg, rgba(13,17,23,.97) 0%, rgba(13,17,23,.9) 38%, rgba(13,17,23,.35) 70%, rgba(13,17,23,.15) 100%)"
V_HEAVY = "linear-gradient(180deg, rgba(13,17,23,.9) 0%, rgba(13,17,23,.78) 45%, rgba(13,17,23,.96) 100%)"
V_MID_BAND = "linear-gradient(180deg, rgba(13,17,23,.98) 0%, rgba(13,17,23,.55) 30%, rgba(13,17,23,.15) 55%, rgba(13,17,23,.9) 78%, #0d1117 100%)"
V_TOP_BAND = "linear-gradient(180deg, rgba(13,17,23,.96) 0%, rgba(13,17,23,.45) 9%, rgba(13,17,23,.12) 20%, rgba(13,17,23,.4) 34%, rgba(13,17,23,.94) 44%, #0d1117 50%, #0d1117 100%)"


def header(pill):
    return ('<div class="top layer" data-id="header"><div class="brand"><div class="mono">GB</div>'
            '<div class="word"><b>GOLDBOT</b><small>BY AL-AI-FX</small></div></div>'
            f'<div class="pill">{pill}</div></div>')


def footer():
    return f'<div class="bottom layer" data-id="footer"><div class="url">al-ai-fx.xyz</div><div class="risk">{RISK}</div></div>'


def steps(rows, prefix="s"):
    return "".join(f'<div class="step layer" data-id="{prefix}{i+1}"><div class="num">{i+1}</div><div class="t">{t}</div><div class="eta">{e}</div></div>'
                   for i, (t, e) in enumerate(rows))


def rows_timeline(n, prefix="s", first=1.7, gap=0.5, extra=None):
    tl = {"header": (0.0, 0.4, 0), "footer": (0.0, 0.4, 0), "eyebrow": (0.2, 0.5, 20), "h1": (0.6, 0.6, 28)}
    for i in range(n):
        tl[f"{prefix}{i+1}"] = (first + i * gap, 0.45, 22)
    tl.update(extra or {})
    return tl


def column(story, inner, bottom=False, gap=None):
    gap = gap or ("40px" if story else "28px")
    align = ("margin-top:auto;margin-bottom:36px;" if bottom else "margin-top:auto;margin-bottom:auto;") if story else ""
    return f'<div style="display:flex;flex-direction:column;gap:{gap};{align}">{inner}</div>'


# ---------------------------------------------------------------------------
# Posts. Each returns the size-specific definition.

def post_01(size):
    story = size == "story"
    h = "116px" if story else "88px"
    body = column(story, f"""
      <div class="layer" data-id="eyebrow"><span class="eyebrow">AI-assisted MT5 execution engine</span></div>
      <div><h1 class="layer" data-id="h1a" style="font-size:{h}">Trade gold like a machine.</h1>
           <h1 class="layer accent" data-id="h1b" style="font-size:{h}">Because now you have one.</h1></div>
      <p class="sub layer" data-id="sub" style="font-size:{'34px' if story else '28px'};max-width:{'820px' if story else '640px'}">GoldBot finds the session breakout, places the trade and manages the recovery &mdash; on your MT5 account, minutes after checkout.</p>
      <div class="pills"><span class="pill solid layer" data-id="p1">Free 3-day trial</span><span class="pill layer" data-id="p2">Account-locked build</span><span class="pill layer" data-id="p3">Holiday liquidity guard</span></div>
    """, gap="34px").replace('<div style="display:flex;flex-direction:column;', '<div style="max-width:720px;display:flex;flex-direction:column;' if not story else '<div style="display:flex;flex-direction:column;')
    return {
        "slug": "01-launch", "scene": "A", "duration": 8.5,
        "bg": ROOT / "public/brand/hero-robot-gold.png",
        "box": (0, 274, 1080, 1267) if story else (0, 0, 1080, 1080),
        "focal": ((0.62, 0.5), (0.58, 0.5)) if story else ((0.66, 0.5), (0.60, 0.5)), "zoom": (1.0, 1.12),
        "shade": V_MID_BAND if story else H_LEFT, "pill": "XAUUSD &middot; MT5", "body": body,
        "timeline": {"header": (0.0, 0.5, 0), "footer": (0.0, 0.5, 0), "eyebrow": (0.4, 0.5, 20),
                     "h1a": (1.0, 0.6, 28), "h1b": (1.8, 0.6, 28), "sub": (2.8, 0.6, 20),
                     "p1": (3.8, 0.4, 16), "p2": (4.2, 0.4, 16), "p3": (4.6, 0.4, 16)},
    }


def post_02(size):
    story = size == "story"
    rows = [("Choose a plan", "1 min"), ("Dashboard access created", "Instant"),
            ("Bind your MT5 account number", "30 sec"), ("Cloud-compile, locked to that account", "&lt; 15 sec"),
            ("Drop it into MT5 and go live", "2 min")]
    body = column(story, f"""
      <div class="layer" data-id="eyebrow"><span class="eyebrow">How it works</span></div>
      <h1 class="layer" data-id="h1" style="font-size:{'96px' if story else '66px'}">From checkout to a live gold chart <span class="accent" style="white-space:nowrap">in minutes.</span></h1>
      <div class="steps" style="{'gap:22px' if story else ''}">{steps(rows)}</div>
      <p class="sub layer" data-id="note" style="font-size:{'28px' if story else '22px'};color:var(--muted)">One build per MT5 account. No laggy in-bot license ping. MetaTrader 5 only.</p>
    """, gap="44px" if story else "30px")
    return {
        "slug": "02-how-it-works", "scene": "B", "duration": 9.0,
        "bg": ROOT / "public/brand/gold-circuit-16x9.jpg",
        "box": (0, 0, 1080, 1920) if story else (0, 0, 1080, 1080),
        "focal": ((0.5, 0.5), (0.56, 0.46)), "zoom": (1.0, 1.10),
        "shade": V_HEAVY, "pill": "Private build", "body": body,
        "timeline": rows_timeline(5, first=1.7, gap=0.55, extra={"note": (5.0, 0.6, 16)}),
    }


def post_03(size):
    story = size == "story"
    body = column(story, f"""
      <div class="layer" data-id="eyebrow"><span class="eyebrow">Free trial</span></div>
      <div class="big" style="font-size:{'200px' if story else '150px'}"><div class="layer" data-id="b1">3 days.</div><div class="layer accent" data-id="b2">$0.</div><div class="layer" data-id="b3">No card.</div></div>
      <p class="sub layer" data-id="sub" style="font-size:{'34px' if story else '28px'};max-width:{'860px' if story else '620px'}">Run PrecisionTrader, our single-range gold breakout EA, on your own MT5 account. The trial activates instantly from checkout.</p>
      <div class="pills"><span class="cta layer" data-id="cta">Start free at al-ai-fx.xyz</span></div>
      <p class="sub layer" data-id="plans" style="font-size:{'24px' if story else '20px'};color:var(--muted)">Paid plans from $9 for 10 days &middot; Gold MultiRange 4 from $99 a month</p>
    """, bottom=True, gap="34px" if story else "28px").replace('<div style="display:flex;flex-direction:column;', '<div style="max-width:700px;display:flex;flex-direction:column;' if not story else '<div style="display:flex;flex-direction:column;')
    return {
        "slug": "03-free-trial", "scene": "C", "duration": 9.0,
        "bg": ROOT / "public/brand/hourglass-chart-16x9.jpg",
        "box": (0, 230, 1080, 1152) if story else (0, 0, 1080, 1080),
        "focal": ((0.5, 0.5), (0.5, 0.47)) if story else ((0.78, 0.5), (0.74, 0.5)), "zoom": (1.0, 1.10),
        "shade": ("linear-gradient(180deg, rgba(13,17,23,.97) 0%, rgba(13,17,23,.35) 28%, rgba(13,17,23,.2) 50%, rgba(13,17,23,.92) 66%, #0d1117 100%)" if story
                  else "linear-gradient(90deg, rgba(13,17,23,.98) 0%, rgba(13,17,23,.92) 42%, rgba(13,17,23,.45) 68%, rgba(13,17,23,.2) 100%)"),
        "pill": "XAUUSD &middot; MT5", "body": body,
        "timeline": {"header": (0.0, 0.4, 0), "footer": (0.0, 0.4, 0), "eyebrow": (0.2, 0.5, 20),
                     "b1": (0.6, 0.5, 30), "b2": (1.1, 0.5, 30), "b3": (1.6, 0.5, 30),
                     "sub": (2.6, 0.6, 20), "cta": (3.4, 0.5, 18), "plans": (4.2, 0.5, 14)},
    }


def post_04(size):
    story = size == "story"
    rows = [("Pick PrecisionTrader in the catalog", "Free trial"), ("Choose Free Trial at checkout", "No card"),
            ("Dashboard login lands in your inbox", "Instant"), ("Enter your MT5 account number, compile", "&lt; 15 sec"),
            ("Attach it to an XAUUSD chart", "3 days")]
    body = column(story, f"""
      <div class="layer" data-id="eyebrow"><span class="eyebrow">Free trial &middot; how to claim it</span></div>
      <h1 class="layer" data-id="h1" style="font-size:{'92px' if story else '64px'}">3 days of PrecisionTrader. <span class="accent" style="white-space:nowrap">Here's how.</span></h1>
      <div class="steps" style="{'gap:18px' if story else ''}">{steps(rows)}</div>
      <p class="sub layer" data-id="note" style="font-size:{'26px' if story else '21px'};color:var(--muted)">$0, no card, cancels itself after 3 days. Trials can be limited per visitor &mdash; checkout shows if one is open to you.</p>
    """, bottom=True, gap="34px" if story else "26px")
    return {
        "slug": "04-free-trial-steps", "scene": "D", "duration": 10.0,
        "bg": ROOT / "public/robots/precision-trader.jpg",
        "box": (0, 140, 1080, 700) if story else (0, 0, 1080, 1080),
        "focal": ((0.55, 0.42), (0.6, 0.4)), "zoom": (1.0, 1.10),
        "shade": V_TOP_BAND if story else V_HEAVY, "pill": "PrecisionTrader", "body": body,
        "timeline": rows_timeline(5, first=1.7, gap=0.5, extra={"note": (4.6, 0.6, 16)}),
    }


def post_05(size):
    story = size == "story"
    rows = [("Dashboard: Compile &amp; Download the .ex5", "&lt; 15 sec"), ("File &rarr; Open Data Folder &rarr; MQL5 / Experts", "Paste"),
            ("Navigator: right-click Expert Advisors, Refresh", "Ctrl+N"), ("Drag it onto an XAUUSD chart", "Gold"),
            ("Tick Allow Algo Trading, switch Algo Trading on", "Live")]
    body = column(story, f"""
      <div class="layer" data-id="eyebrow"><span class="eyebrow">How to use it</span></div>
      <h1 class="layer" data-id="h1" style="font-size:{'92px' if story else '64px'}">Install GoldBot on MT5 <span class="accent" style="white-space:nowrap">in 5 steps.</span></h1>
      <div class="steps" style="{'gap:18px' if story else ''}">{steps(rows)}</div>
      <p class="sub layer" data-id="note" style="font-size:{'26px' if story else '21px'};color:var(--muted)">Log in to the MT5 account the build is locked to, broker time GMT+3. Keep MT5 running 24/5 &mdash; a VPS is the recommended setup.</p>
    """, bottom=True, gap="34px" if story else "26px")
    return {
        "slug": "05-install-mt5", "scene": "E", "duration": 10.0,
        "bg": ROOT / "public/brand/trading-desk-16x9.jpg",
        "box": (0, 140, 1080, 700) if story else (0, 0, 1080, 1080),
        "focal": ((0.45, 0.42), (0.5, 0.4)), "zoom": (1.0, 1.10),
        "shade": V_TOP_BAND if story else V_HEAVY, "pill": "MetaTrader 5", "body": body,
        "timeline": rows_timeline(5, first=1.7, gap=0.5, extra={"note": (4.6, 0.6, 16)}),
    }


def post_06(size):
    story = size == "story"
    plans = [("Free trial", "PrecisionTrader &middot; 3 days", "$0", "no card", False),
             ("10 Days", "Fast validation window", "$29", "10 days", False),
             ("Monthly", "Best place to start", "$99", "month", False),
             ("6 Months", "About $75 a month", "$449", "6 months", False),
             ("1 Year", "About $83 a month &middot; Most popular", "$999", "year", True)]
    rows = "".join(f'<div class="step plan layer{" featured" if f else ""}" data-id="pl{i+1}"><div class="t"><b>{n}</b><small>{s}</small></div>'
                   f'<div class="price">{p}<small>/ {per}</small></div></div>' for i, (n, s, p, per, f) in enumerate(plans))
    body = column(story, f"""
      <div class="layer" data-id="eyebrow"><span class="eyebrow">Pricing</span></div>
      <h1 class="layer" data-id="h1" style="font-size:{'92px' if story else '64px'}">Simple plans. <span class="accent" style="white-space:nowrap">Serious execution.</span></h1>
      <div class="steps" style="{'gap:16px' if story else 'gap:12px'}">{rows}</div>
      <p class="sub layer" data-id="note" style="font-size:{'26px' if story else '21px'};color:var(--muted)">Prices for Gold MultiRange 4, the flagship. Every plan is a build compiled for your MT5 account. Stop loss in the first 14 days? The robot price is refunded.</p>
    """, bottom=True, gap="30px" if story else "22px")
    return {
        "slug": "06-pricing", "scene": "F", "duration": 10.0,
        "bg": ROOT / "public/brand/vault-door-16x9.jpg",
        "box": (0, 120, 1080, 640) if story else (0, 0, 1080, 1080),
        "focal": ((0.5, 0.5), (0.5, 0.46)), "zoom": (1.0, 1.10),
        "shade": V_TOP_BAND if story else V_HEAVY, "pill": "Gold MultiRange 4", "body": body,
        "timeline": rows_timeline(5, prefix="pl", first=1.7, gap=0.5, extra={"note": (4.6, 0.6, 16)}),
    }


def post_07(size):
    story = size == "story"
    robots = [("PrecisionTrader", "trial", "Free trial", "One session range a day, hedged, with a fixed lot you control.", "$9 / 10 days &middot; $39 / month"),
              ("Gold MultiRange 4", "flag", "Flagship", "Four independent gold session ranges a day, each with its own breakout and hedge. Prop-firm compatible.", "$29 / 10 days &middot; $99 / month"),
              ("Sniper Lite EA", "soon", "Coming soon", "Multi-indicator confluence swing EA: RSI pullback core, 8 confluence filters, 3-stage partial profits.", "Priced at launch")]
    rows = "".join(f'<div class="step robot layer" data-id="r{i+1}"><div class="rt"><span>{n}</span><span class="badge {c}">{b}</span></div>'
                   f'<div class="rd">{d}</div><div class="rp">{p}</div></div>' for i, (n, c, b, d, p) in enumerate(robots))
    body = column(story, f"""
      <div class="layer" data-id="eyebrow"><span class="eyebrow">The lineup</span></div>
      <h1 class="layer" data-id="h1" style="font-size:{'96px' if story else '66px'}">Pick your robot.</h1>
      <p class="sub layer" data-id="sub" style="font-size:{'30px' if story else '24px'}">Same account-locked build. Different trading styles.</p>
      <div class="steps" style="{'gap:18px' if story else 'gap:12px'}">{rows}</div>
      <p class="sub layer" data-id="note" style="font-size:{'26px' if story else '21px'};color:var(--muted)">MT5 only &middot; XAUUSD &middot; one build per account number &middot; compare them side by side in the catalog.</p>
    """, bottom=True, gap="30px" if story else "22px")
    return {
        "slug": "07-robot-lineup", "scene": "G", "duration": 10.0,
        "bg": ROOT / "public/robots/gold-multirange-4.jpg",
        "box": (0, 120, 1080, 640) if story else (0, 0, 1080, 1080),
        "focal": ((0.5, 0.45), (0.52, 0.4)), "zoom": (1.0, 1.10),
        "shade": V_TOP_BAND if story else V_HEAVY, "pill": "3 robots", "body": body,
        "timeline": rows_timeline(3, prefix="r", first=2.2, gap=0.6, extra={"sub": (1.4, 0.5, 18), "note": (4.4, 0.6, 16)}),
    }


POSTS = {"01": post_01, "02": post_02, "03": post_03, "04": post_04, "05": post_05, "06": post_06, "07": post_07}
SCENE_OF = {"A": "01", "B": "02", "C": "03", "D": "04", "E": "05", "F": "06", "G": "07"}


# ---------------------------------------------------------------------------
# Rendering helpers

def post_html(post, size, only=None):
    """Full page: shade + chrome + body. `only` hides every layer but one (for video layers)."""
    w, h = SIZES[size]
    select = f'.layer{{visibility:hidden}} .layer[data-id="{only}"]{{visibility:visible}}' if only else ""
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}{select}</style></head>
<body class="{'story' if size == 'story' else ''}">
  <div class="shade layer" data-id="shade" style="background:{post['shade']}"></div>
  <div class="frame">{header(post['pill'])}{post['body']}{footer()}</div>
</body></html>"""
    return html.replace("WIDTH", str(w)).replace("HEIGHT", str(h)).replace("FONTS", (HERE / "fonts").as_uri())


def screenshot(html, size, out_png):
    import subprocess
    w, h = SIZES[size]
    src = Path(out_png).with_suffix(".html")
    src.write_text(html, encoding="utf-8")
    subprocess.run([CHROME, "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                    "--default-background-color=00000000", "--force-device-scale-factor=1",
                    f"--window-size={w},{h}", f"--screenshot={out_png}", "--virtual-time-budget=4000", src.as_uri()],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return Image.open(out_png).convert("RGBA")


def cover_crop(src, box_w, box_h, zoom, fx, fy):
    """Crop a box_w:box_h region out of src (cover-fit, scaled by zoom, centred near the focal point)."""
    sw, sh = src.size
    scale = max(box_w / sw, box_h / sh) * zoom
    cw, ch = box_w / scale, box_h / scale
    cx, cy = fx * sw, fy * sh
    x0 = min(max(cx - cw / 2, 0), sw - cw)
    y0 = min(max(cy - ch / 2, 0), sh - ch)
    return src.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((box_w, box_h), Image.BILINEAR)


def background(post, size, p=0.0):
    """Canvas with the brand image in its box at progress p (0 = start of the move, 1 = end)."""
    w, h = SIZES[size]
    frame = Image.new("RGB", (w, h), BG)
    bx, by, bw, bh = post["box"]
    (fx0, fy0), (fx1, fy1) = post["focal"]
    z0, z1 = post["zoom"]
    frame.paste(cover_crop(post["_bg"], bw, bh, z0 + (z1 - z0) * p, fx0 + (fx1 - fx0) * p, fy0 + (fy1 - fy0) * p), (bx, by))
    return frame


def load(key, size):
    post = POSTS[key](size)
    post["_bg"] = Image.open(post["bg"]).convert("RGB")
    return post
