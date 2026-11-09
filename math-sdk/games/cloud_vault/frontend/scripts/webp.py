"""WebP for the heavy PNGs: the release downloaded ~27 MB on the first load, ~19 MB of it PNG art that WebP (q90, exact
alpha) carries in about a fifth, measured on Stake's slow share host (1.0.45: 6.5-17 s to the start screen).

  public   writes <name>.webp next to each PNG the code loads by name (CODE below) when the PNG is newer; the code
           names the .webp, the PNG stays as the art tools' source (scripts/release.mjs drops it from the package).
  dist     after the build: every Spine atlas page and the burst spritesheet in dist/ become WebP in place, their
           .atlas/.json rewritten to the new page names. Premultiplied pages are un-premultiplied and marked pma:false
           (lossy colour may not exceed its alpha), so the Spine exports and tools keep writing plain PNG.

Run: /usr/bin/python3 scripts/webp.py public|dist   (release.mjs runs both)
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MIN = 40 * 1024  # smaller PNGs stay: the saving is not worth a second file
CODE = [
    "art/frame_v25.png", "art/ui/logo.png", "art/ui/win_lotus_v3.png", "art/ui/key.png", "character/char_painterly.png",
    *[f"symbols/{s}.png" for s in ("H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "S")],
    *[f"art/bloom/lotus_{s}.png" for s in ("closed", "ready", "open")],
    "fx/fragments.png",  # preloaded by name; the package points its spritesheet json at the WebP (dist)
]


def save_webp(src, dst, unpremultiply=False):
    im = Image.open(src).convert("RGBA")
    if unpremultiply:
        a = np.asarray(im).astype(np.float32)
        al = a[..., 3:4] / 255
        a[..., :3] = np.where(al > 0, np.clip(a[..., :3] / np.maximum(al, 1e-6), 0, 255), 0)
        im = Image.fromarray((a + 0.5).astype(np.uint8), "RGBA")
    im.save(dst, "WEBP", quality=90, alpha_quality=100, method=6, exact=True)
    return os.path.getsize(src), os.path.getsize(dst)


def public():
    base = os.path.join(ROOT, "public")
    for rel in CODE:
        png = os.path.join(base, rel)
        webp = png[:-4] + ".webp"
        if os.path.exists(webp) and os.path.getmtime(webp) >= os.path.getmtime(png):
            continue
        a, b = save_webp(png, webp)
        print(f"public {rel}: {a // 1024} KB -> {b // 1024} KB")


def dist():
    base = os.path.join(ROOT, "dist")
    saved = 0
    for d, _, files in os.walk(os.path.join(base, "spine")):
        for f in files:
            if not f.endswith(".atlas"):
                continue
            path = os.path.join(d, f)
            lines = open(path).read().split("\n")
            page = None
            for i, line in enumerate(lines):
                if re.fullmatch(r"\S+\.png", line.strip()) and os.path.exists(os.path.join(d, line.strip())):
                    png = os.path.join(d, line.strip())
                    page = None
                    if os.path.getsize(png) < MIN:
                        continue
                    pma = any(l.strip() == "pma:true" for l in lines[i + 1:i + 6] if not l.strip().endswith(".png"))
                    a, b = save_webp(png, png[:-4] + ".webp", unpremultiply=pma)
                    saved += a - b
                    os.remove(png)
                    lines[i] = line.strip()[:-4] + ".webp"
                    page = i
                elif page is not None and line.strip() == "pma:true":
                    lines[i] = "pma:false"
                elif not line.strip():
                    page = None
            open(path, "w").write("\n".join(lines))
    sheet = os.path.join(base, "fx/fragments.json")
    data = json.load(open(sheet))
    png = os.path.join(base, "fx", data["meta"]["image"])
    if png.endswith(".png"):
        a, b = save_webp(png, png[:-4] + ".webp")
        saved += a - b
        os.remove(png)
        data["meta"]["image"] = data["meta"]["image"][:-4] + ".webp"
        json.dump(data, open(sheet, "w"), separators=(",", ":"))
    print(f"dist: atlas pages and the burst sheet as WebP, {saved / 1e6:.1f} MB saved")


if __name__ == "__main__":
    {"public": public, "dist": dist}[sys.argv[1]]()
