#!/usr/bin/env python3
"""Build the launch video from the three social post scenes.

Each text element of a scene is rendered once by headless Chromium as a
transparent PNG layer (same CSS as render.py), then composited in Python over
a slow Ken Burns pan of the brand imagery: elements fade and slide in on a
timeline, scenes crossfade, and ffmpeg encodes H.264.

    python3 marketing-assets/social/video.py              # story (9:16) + feed (1:1)
    python3 marketing-assets/social/video.py story        # one size
    python3 marketing-assets/social/video.py story A      # one scene only (quick preview)

Needs an ffmpeg with libx264: `pip install imageio-ffmpeg`, or FFMPEG=/path.
"""
import os, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render import CSS, RISK, HERE, ROOT, SIZES, CHROME  # noqa: E402

FPS = 30
XFADE = 0.6          # seconds of crossfade between scenes
BG = (13, 17, 23)    # --bg


def find_ffmpeg():
    env = os.environ.get("FFMPEG")
    if env and Path(env).exists():
        return env
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    found = shutil.which("ffmpeg")
    if found:
        return found
    sys.exit("ffmpeg with libx264 not found: pip install imageio-ffmpeg, or set FFMPEG=/path/to/ffmpeg")


# ---------------------------------------------------------------------------
# Scene definitions. A layer is (id, html, start, dur, slide_px). Positions
# come from the same flex layout as the static posts, so the video matches them.

def layer(id, html, start, dur=0.5, slide=24):
    return {"id": id, "html": html, "start": start, "dur": dur, "slide": slide}


def header(pill):
    return ('<div class="top layer" data-id="header"><div class="brand"><div class="mono">GB</div>'
            '<div class="word"><b>GOLDBOT</b><small>BY AL-AI-FX</small></div></div>'
            f'<div class="pill">{pill}</div></div>')


def footer():
    return f'<div class="bottom layer" data-id="footer"><div class="url">al-ai-fx.xyz</div><div class="risk">{RISK}</div></div>'


def scene_a(size):
    story = size == "story"
    h = "116px" if story else "88px"
    sub = "34px" if story else "28px"
    body = f"""
    <div style="display:flex;flex-direction:column;gap:34px;max-width:{'100%' if story else '720px'};{'margin-top:auto;margin-bottom:auto;' if story else ''}">
      <div class="layer" data-id="eyebrow"><span class="eyebrow">AI-assisted MT5 execution engine</span></div>
      <div><h1 class="layer" data-id="h1a" style="font-size:{h}">Trade gold like a machine.</h1>
           <h1 class="layer accent" data-id="h1b" style="font-size:{h}">Because now you have one.</h1></div>
      <p class="sub layer" data-id="sub" style="font-size:{sub};max-width:{'820px' if story else '640px'}">GoldBot finds the session breakout, places the trade and manages the recovery &mdash; on your MT5 account, minutes after checkout.</p>
      <div class="pills"><span class="pill solid layer" data-id="p1">Free 3-day trial</span><span class="pill layer" data-id="p2">Account-locked build</span><span class="pill layer" data-id="p3">Holiday liquidity guard</span></div>
    </div>"""
    shade = ('linear-gradient(180deg, rgba(13,17,23,.98) 0%, rgba(13,17,23,.55) 30%, rgba(13,17,23,.15) 55%, rgba(13,17,23,.9) 78%, #0d1117 100%)' if story
             else 'linear-gradient(90deg, rgba(13,17,23,.97) 0%, rgba(13,17,23,.9) 38%, rgba(13,17,23,.35) 70%, rgba(13,17,23,.15) 100%)')
    return {
        "name": "A", "duration": 8.5,
        "bg": ROOT / "public/brand/hero-robot-gold.png",
        "box": (0, 274, 1080, 1267) if story else (0, 0, 1080, 1080),
        "focal": ((0.62, 0.5), (0.58, 0.5)), "zoom": (1.0, 1.12),
        "shade": shade, "pill": "XAUUSD &middot; MT5", "body": body,
        "timeline": {"header": (0.0, 0.5, 0), "footer": (0.0, 0.5, 0), "eyebrow": (0.4, 0.5, 20),
                     "h1a": (1.0, 0.6, 28), "h1b": (1.8, 0.6, 28), "sub": (2.8, 0.6, 20),
                     "p1": (3.8, 0.4, 16), "p2": (4.2, 0.4, 16), "p3": (4.6, 0.4, 16)},
    }


def scene_b(size):
    story = size == "story"
    steps = [("Choose a plan", "1 min"), ("Dashboard access created", "Instant"),
             ("Bind your MT5 account number", "30 sec"), ("Cloud-compile, locked to that account", "&lt; 15 sec"),
             ("Drop it into MT5 and go live", "2 min")]
    rows = "".join(f'<div class="step layer" data-id="s{i+1}"><div class="num">{i+1}</div><div class="t">{t}</div><div class="eta">{e}</div></div>'
                   for i, (t, e) in enumerate(steps))
    h = "96px" if story else "66px"
    body = f"""
    <div style="display:flex;flex-direction:column;gap:{'44px' if story else '30px'};{'margin-top:auto;margin-bottom:auto;' if story else ''}">
      <div class="layer" data-id="eyebrow"><span class="eyebrow">How it works</span></div>
      <h1 class="layer" data-id="h1" style="font-size:{h}">From checkout to a live gold chart <span class="accent" style="white-space:nowrap">in minutes.</span></h1>
      <div class="steps" style="{'gap:22px' if story else ''}">{rows}</div>
      <p class="sub layer" data-id="note" style="font-size:{'28px' if story else '22px'};color:var(--muted)">One build per MT5 account. No laggy in-bot license ping. MetaTrader 5 only.</p>
    </div>"""
    tl = {"header": (0.0, 0.4, 0), "footer": (0.0, 0.4, 0), "eyebrow": (0.2, 0.5, 20), "h1": (0.6, 0.6, 28), "note": (5.0, 0.6, 16)}
    for i in range(5):
        tl[f"s{i+1}"] = (1.7 + i * 0.55, 0.45, 22)
    return {
        "name": "B", "duration": 9.0,
        "bg": ROOT / "public/brand/gold-circuit-16x9.jpg",
        "box": (0, 0, 1080, 1920) if story else (0, 0, 1080, 1080),
        "focal": ((0.5, 0.5), (0.56, 0.46)), "zoom": (1.0, 1.10),
        "shade": 'linear-gradient(180deg, rgba(13,17,23,.92) 0%, rgba(13,17,23,.78) 50%, rgba(13,17,23,.95) 100%)',
        "pill": "Private build", "body": body, "timeline": tl,
    }


def scene_c(size):
    story = size == "story"
    big = "200px" if story else "150px"
    body = f"""
    <div style="display:flex;flex-direction:column;gap:{'34px' if story else '28px'};max-width:{'100%' if story else '700px'};{'margin-top:auto;margin-bottom:36px;' if story else ''}">
      <div class="layer" data-id="eyebrow"><span class="eyebrow">Free trial</span></div>
      <div class="big" style="font-size:{big}"><div class="layer" data-id="b1">3 days.</div><div class="layer accent" data-id="b2">$0.</div><div class="layer" data-id="b3">No card.</div></div>
      <p class="sub layer" data-id="sub" style="font-size:{'34px' if story else '28px'};max-width:{'860px' if story else '620px'}">Run PrecisionTrader, our single-range gold breakout EA, on your own MT5 account. The trial activates instantly from checkout.</p>
      <div class="pills"><span class="cta layer" data-id="cta">Start free at al-ai-fx.xyz</span></div>
      <p class="sub layer" data-id="plans" style="font-size:{'24px' if story else '20px'};color:var(--muted)">Paid plans from $9 for 10 days &middot; Gold MultiRange 4 from $99 a month</p>
    </div>"""
    shade = ('linear-gradient(180deg, rgba(13,17,23,.97) 0%, rgba(13,17,23,.35) 28%, rgba(13,17,23,.2) 50%, rgba(13,17,23,.92) 66%, #0d1117 100%)' if story
             else 'linear-gradient(90deg, rgba(13,17,23,.98) 0%, rgba(13,17,23,.92) 42%, rgba(13,17,23,.45) 68%, rgba(13,17,23,.2) 100%)')
    return {
        "name": "C", "duration": 9.0,
        "bg": ROOT / "public/brand/hourglass-chart-16x9.jpg",
        "box": (0, 230, 1080, 1152) if story else (0, 0, 1080, 1080),
        "focal": ((0.5, 0.5), (0.5, 0.47)) if story else ((0.78, 0.5), (0.74, 0.5)), "zoom": (1.0, 1.10),
        "shade": shade, "pill": "XAUUSD &middot; MT5", "body": body,
        "timeline": {"header": (0.0, 0.4, 0), "footer": (0.0, 0.4, 0), "eyebrow": (0.2, 0.5, 20),
                     "b1": (0.6, 0.5, 30), "b2": (1.1, 0.5, 30), "b3": (1.6, 0.5, 30),
                     "sub": (2.6, 0.6, 20), "cta": (3.4, 0.5, 18), "plans": (4.2, 0.5, 14)},
    }


SCENES = {"A": scene_a, "B": scene_b, "C": scene_c}


# ---------------------------------------------------------------------------
# Layer rendering

def scene_html(scene, size, only=None):
    w, h = SIZES[size]
    cls = "story" if size == "story" else ""
    select = f'.layer{{visibility:hidden}} .layer[data-id="{only}"]{{visibility:visible}}' if only else ""
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}
body{{background:transparent !important}} h1.accent{{color:var(--cream)}} .big .accent{{color:var(--gold-light)}} {select}</style></head>
<body class="{cls}">
  <div class="shade layer" data-id="shade" style="background:{scene['shade']}"></div>
  <div class="frame">{header(scene['pill'])}{scene['body']}{footer()}</div>
</body></html>"""
    return html.replace("WIDTH", str(w)).replace("HEIGHT", str(h)).replace("FONTS", (HERE / "fonts").as_uri())


def render_layers(scene, size, workdir):
    """Screenshot each layer on a transparent canvas; return {id: (cropped RGBA, (x, y))}."""
    w, h = SIZES[size]
    ids = ["shade"] + list(scene["timeline"])
    out = {}
    for lid in ids:
        src = workdir / f"{scene['name']}-{size}-{lid}.html"
        png = workdir / f"{scene['name']}-{size}-{lid}.png"
        src.write_text(scene_html(scene, size, only=lid), encoding="utf-8")
        subprocess.run([CHROME, "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                        "--default-background-color=00000000", "--force-device-scale-factor=1",
                        f"--window-size={w},{h}", f"--screenshot={png}", "--virtual-time-budget=4000", src.as_uri()],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        im = Image.open(png).convert("RGBA")
        bbox = im.getbbox()
        if bbox is None:
            raise RuntimeError(f"layer {lid} rendered empty in scene {scene['name']}")
        out[lid] = (im.crop(bbox), (bbox[0], bbox[1]))
    return out


# ---------------------------------------------------------------------------
# Compositing

def ease_out(x):
    return 1 - (1 - x) ** 3


def cover_crop(src, box_w, box_h, zoom, fx, fy):
    """Crop a box_w:box_h region out of src (cover-fit, scaled by zoom, centred near the focal point)."""
    sw, sh = src.size
    scale = max(box_w / sw, box_h / sh) * zoom
    cw, ch = box_w / scale, box_h / scale
    cx, cy = fx * sw, fy * sh
    x0 = min(max(cx - cw / 2, 0), sw - cw)
    y0 = min(max(cy - ch / 2, 0), sh - ch)
    return src.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((box_w, box_h), Image.BILINEAR)


def compose(scene, layers, size, t):
    """One finished frame of a scene at local time t (seconds)."""
    w, h = SIZES[size]
    p = min(t / scene["duration"], 1.0)
    frame = Image.new("RGB", (w, h), BG)
    bx, by, bw, bh = scene["box"]
    (fx0, fy0), (fx1, fy1) = scene["focal"]
    z0, z1 = scene["zoom"]
    frame.paste(cover_crop(scene["_bg"], bw, bh, z0 + (z1 - z0) * p, fx0 + (fx1 - fx0) * p, fy0 + (fy1 - fy0) * p), (bx, by))
    shade, pos = layers["shade"]
    frame.paste(shade, pos, shade)
    for lid, (start, dur, slide) in scene["timeline"].items():
        q = (t - start) / dur
        if q <= 0:
            continue
        e = ease_out(min(q, 1.0))
        im, (x, y) = layers[lid]
        if e >= 1.0:
            frame.paste(im, (x, y), im)
        else:
            a = im.getchannel("A").point(lambda v, m=e: int(v * m))
            frame.paste(im, (x, y + int(slide * (1 - e))), a)
    return frame


def build(size, scene_keys, ffmpeg):
    w, h = SIZES[size]
    scenes = [SCENES[k](size) for k in scene_keys]
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        for sc in scenes:
            sc["_bg"] = Image.open(sc["bg"]).convert("RGB")
            sc["_layers"] = render_layers(sc, size, td)
        # Global timeline: each scene starts XFADE before the previous one ends.
        starts = [0.0]
        for sc in scenes[:-1]:
            starts.append(starts[-1] + sc["duration"] - XFADE)
        total = starts[-1] + scenes[-1]["duration"]
        n_frames = int(round(total * FPS))
        suffix = "" if scene_keys == list(SCENES) else "-" + "".join(scene_keys)
        out = HERE / f"launch-video-{'9x16' if size == 'story' else '1x1'}{suffix}.mp4"
        cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(FPS), "-i", "-",
               "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for f in range(n_frames):
            t = f / FPS
            # find the active scene (last one whose start <= t) and whether we're inside a crossfade into it
            i = max(k for k, s in enumerate(starts) if s <= t)
            frame = compose(scenes[i], scenes[i]["_layers"], size, t - starts[i])
            if i > 0 and t - starts[i] < XFADE:
                prev = compose(scenes[i - 1], scenes[i - 1]["_layers"], size, t - starts[i - 1])
                frame = Image.blend(prev, frame, (t - starts[i]) / XFADE)
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        if proc.wait() != 0:
            sys.exit("ffmpeg failed")
        print(out.relative_to(ROOT), f"{w}x{h}", f"{total:.1f}s", f"{out.stat().st_size // 1024} KB")
        return out


if __name__ == "__main__":
    ffmpeg = find_ffmpeg()
    sizes = [sys.argv[1]] if len(sys.argv) > 1 else ["story", "feed"]
    keys = list(sys.argv[2]) if len(sys.argv) > 2 else list(SCENES)
    for s in sizes:
        build(s, keys, ffmpeg)
