#!/usr/bin/env python3
"""Render the still images for every post (feed 1080x1080 and story 1080x1920).

    python3 marketing-assets/social/render.py            # all posts, both sizes
    python3 marketing-assets/social/render.py 03 story   # one post, one size

The still is the end frame of the post's animation (see video.py): the text
layers rendered by headless Chromium over the brand image at its start crop.
"""
import sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from posts import HERE, ROOT, SIZES, POSTS, load, post_html, screenshot, background  # noqa: E402


def render(key, size):
    post = load(key, size)
    w, h = SIZES[size]
    with tempfile.TemporaryDirectory() as td:
        layers = screenshot(post_html(post, size), size, Path(td) / "all.png")
    frame = background(post, size, 0.0)
    frame.paste(layers, (0, 0), layers)
    out = HERE / f"{post['slug']}-{'1x1' if size == 'feed' else '9x16'}.jpg"
    frame.save(out, "JPEG", quality=92, optimize=True)
    print(out.relative_to(ROOT), f"{w}x{h}")


if __name__ == "__main__":
    keys = [sys.argv[1]] if len(sys.argv) > 1 else list(POSTS)
    sizes = [sys.argv[2]] if len(sys.argv) > 2 else list(SIZES)
    for k in keys:
        for s in sizes:
            render(k, s)
