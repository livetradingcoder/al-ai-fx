#!/usr/bin/env python3
"""Build the short videos: one per post, plus the 25 s launch sequence (A+B+C).

Each text element is rendered once by headless Chromium as a transparent PNG
layer (posts.py), then composited in Python over a slow Ken Burns move on the
brand image: elements fade and slide in on the post's timeline, scenes
crossfade, and ffmpeg encodes H.264.

    python3 marketing-assets/social/video.py                 # everything, both sizes
    python3 marketing-assets/social/video.py story           # one size
    python3 marketing-assets/social/video.py story ABC       # the launch sequence only
    python3 marketing-assets/social/video.py feed D          # one post's short

Scene letters: A launch, B how it works, C free trial, D free-trial steps,
E install on MT5, F pricing, G robot lineup. Needs an ffmpeg with libx264:
`pip install imageio-ffmpeg`, or FFMPEG=/path/to/ffmpeg.
"""
import os, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from posts import HERE, ROOT, SIZES, SCENE_OF, load, post_html, screenshot, background  # noqa: E402

FPS = 30
XFADE = 0.6  # seconds of crossfade between scenes
DEFAULT_BUILDS = ["ABC", "D", "E", "F", "G"]


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


def render_layers(post, size, workdir):
    """Screenshot each layer on a transparent canvas; return {id: (cropped RGBA, (x, y))}."""
    out = {}
    for lid in ["shade"] + list(post["timeline"]):
        im = screenshot(post_html(post, size, only=lid), size, workdir / f"{post['slug']}-{size}-{lid}.png")
        bbox = im.getbbox()
        if bbox is None:
            raise RuntimeError(f"layer {lid} rendered empty in {post['slug']}")
        out[lid] = (im.crop(bbox), (bbox[0], bbox[1]))
    return out


def ease_out(x):
    return 1 - (1 - x) ** 3


def compose(post, layers, size, t):
    """One finished frame of a scene at local time t (seconds)."""
    frame = background(post, size, min(t / post["duration"], 1.0))
    shade, pos = layers["shade"]
    frame.paste(shade, pos, shade)
    for lid, (start, dur, slide) in post["timeline"].items():
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


def output_name(letters, size):
    tag = "9x16" if size == "story" else "1x1"
    if letters == "ABC":
        return HERE / f"launch-video-{tag}.mp4"
    if len(letters) == 1:
        return HERE / f"{load(SCENE_OF[letters], size)['slug']}-{tag}.mp4"
    return HERE / f"video-{letters}-{tag}.mp4"


def build(size, letters, ffmpeg):
    w, h = SIZES[size]
    posts = [load(SCENE_OF[c], size) for c in letters]
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        for p in posts:
            p["_layers"] = render_layers(p, size, td)
        # Global timeline: each scene starts XFADE before the previous one ends.
        starts = [0.0]
        for p in posts[:-1]:
            starts.append(starts[-1] + p["duration"] - XFADE)
        total = starts[-1] + posts[-1]["duration"]
        out = output_name(letters, size)
        cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(FPS), "-i", "-",
               "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for f in range(int(round(total * FPS))):
            t = f / FPS
            i = max(k for k, s in enumerate(starts) if s <= t)
            frame = compose(posts[i], posts[i]["_layers"], size, t - starts[i])
            if i > 0 and t - starts[i] < XFADE:
                prev = compose(posts[i - 1], posts[i - 1]["_layers"], size, t - starts[i - 1])
                frame = Image.blend(prev, frame, (t - starts[i]) / XFADE)
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        if proc.wait() != 0:
            sys.exit("ffmpeg failed")
        print(out.relative_to(ROOT), f"{w}x{h}", f"{total:.1f}s", f"{out.stat().st_size // 1024} KB", flush=True)


if __name__ == "__main__":
    ffmpeg = find_ffmpeg()
    sizes = list(SIZES) if len(sys.argv) < 2 or sys.argv[1] == "all" else [sys.argv[1]]
    builds = [sys.argv[2].upper()] if len(sys.argv) > 2 else DEFAULT_BUILDS
    for s in sizes:
        for b in builds:
            build(s, b, ffmpeg)
