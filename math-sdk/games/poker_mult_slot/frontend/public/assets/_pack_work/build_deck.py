#!/usr/bin/env python3
"""Build Neon Orbis deck with ornate baroque suits from photo."""
from __future__ import annotations

from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageOps

ROOT = Path("/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/frontend/public/assets")
WORK = ROOT / "_pack_work"
NEON = WORK / "neon" / "Neon Orbis Playing Cards" / "Cards"
SUIT_SHEET = Path(
    "/Users/andriinorenko/.cursor/projects/Users-andriinorenko-slot-math-sdk/assets/"
    "3769d6e2-99c7-4f5a-9d1c-b40da7a08abe-b0dee6ee-41f2-4978-8b64-63b79258a110.webp"
)
OUT = ROOT / "cards"
SUIT_OUT = WORK / "suits"

W, H = 290, 400  # Neon Orbis native


def extract_suit_sprites() -> dict[str, Image.Image]:
    """Crop 2x2 ornate suits and punch cream background to alpha."""
    SUIT_OUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SUIT_SHEET).convert("RGBA")
    w, h = sheet.size
    boxes = {
        "S": (0, 0, w // 2, h // 2),
        "D": (w // 2, 0, w, h // 2),
        "H": (0, h // 2, w // 2, h),
        "C": (w // 2, h // 2, w, h),
    }
    sprites: dict[str, Image.Image] = {}
    for suit, box in boxes.items():
        q = sheet.crop(box)
        px = q.load()
        ww, hh = q.size
        # Cream background -> transparent; keep red/black ink
        for y in range(hh):
            for x in range(ww):
                r, g, b, a = px[x, y]
                # near-white / cream
                if r > 200 and g > 185 and b > 160 and abs(r - g) < 40:
                    px[x, y] = (0, 0, 0, 0)
                    continue
                # slight despeckle of pale anti-alias
                if r > 230 and g > 220 and b > 200:
                    px[x, y] = (0, 0, 0, 0)
        # Trim to content bbox
        alpha = q.split()[-1]
        bbox = alpha.getbbox()
        if bbox:
            q = q.crop(bbox)
        # Slight pad
        pad = 4
        canvas = Image.new("RGBA", (q.width + pad * 2, q.height + pad * 2), (0, 0, 0, 0))
        canvas.paste(q, (pad, pad), q)
        sprites[suit] = canvas
        canvas.save(SUIT_OUT / f"{suit}.png")
        print(f"suit {suit}: {canvas.size}")
    return sprites


def is_suit_pixel(r: int, g: int, b: int, a: int, suit: str) -> bool:
    if a < 200:
        return False
    if suit in ("H", "D"):
        return r > 180 and g < 90 and b < 90
    # black suits
    return r < 40 and g < 40 and b < 40


def find_components(im: Image.Image, suit: str, min_area: int = 40):
    """Connected components of suit-colored pixels."""
    w, h = im.size
    px = im.load()
    seen = [[False] * w for _ in range(h)]
    comps = []
    for y0 in range(h):
        for x0 in range(w):
            r, g, b, a = px[x0, y0]
            if seen[y0][x0] or not is_suit_pixel(r, g, b, a, suit):
                continue
            # BFS
            stack = [(x0, y0)]
            seen[y0][x0] = True
            cells = []
            while stack:
                x, y = stack.pop()
                cells.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx]:
                        rr, gg, bb, aa = px[nx, ny]
                        if is_suit_pixel(rr, gg, bb, aa, suit):
                            seen[ny][nx] = True
                            stack.append((nx, ny))
            if len(cells) < min_area:
                continue
            xs = [c[0] for c in cells]
            ys = [c[1] for c in cells]
            comps.append(
                {
                    "cells": cells,
                    "bbox": (min(xs), min(ys), max(xs) + 1, max(ys) + 1),
                    "area": len(cells),
                    "cx": sum(xs) / len(xs),
                    "cy": sum(ys) / len(ys),
                }
            )
    comps.sort(key=lambda c: c["area"], reverse=True)
    return comps


def erase_suit_pixels(im: Image.Image, suit: str) -> Image.Image:
    out = im.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_suit_pixel(r, g, b, a, suit):
                px[x, y] = (255, 255, 255, 255)
            # soften reddish anti-alias around red suits
            elif suit in ("H", "D") and a > 200 and r > 150 and g < 140 and b < 140:
                px[x, y] = (255, 255, 255, 255)
            elif suit in ("S", "C") and a > 200 and r < 80 and g < 80 and b < 80 and not (
                # keep black rank letters: they'll be in corner; also erased then we need ranks!
                False
            ):
                # Don't erase all black — ranks are black too!
                pass
    return out


def erase_only_components(im: Image.Image, comps) -> Image.Image:
    out = im.copy()
    px = out.load()
    for c in comps:
        x0, y0, x1, y1 = c["bbox"]
        # expand slightly to clear AA fringe
        x0 = max(0, x0 - 2)
        y0 = max(0, y0 - 2)
        x1 = min(im.width, x1 + 2)
        y1 = min(im.height, y1 + 2)
        for y in range(y0, y1):
            for x in range(x0, x1):
                # only clear if not pure black letter? Clear all non-white in bbox of suit comps
                r, g, b, a = px[x, y]
                if r > 240 and g > 240 and b > 240:
                    continue
                # If this is suit-ish or AA, wipe to white
                if (r > 120 and g < 150 and b < 150) or (r < 90 and g < 90 and b < 90):
                    # careful: rank letter is black — only wipe if inside suit component cells dilated
                    pass
        for x, y in c["cells"]:
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < im.width and 0 <= ny < im.height:
                        px[nx, ny] = (255, 255, 255, 255)
    return out


def paste_suit(base: Image.Image, sprite: Image.Image, cx: float, cy: float, target_h: float, rotate180=False):
    sp = sprite.copy()
    if rotate180:
        sp = sp.rotate(180, expand=True)
    scale = target_h / sp.height
    nw = max(1, int(sp.width * scale))
    nh = max(1, int(sp.height * scale))
    sp = sp.resize((nw, nh), Image.Resampling.LANCZOS)
    x = int(round(cx - nw / 2))
    y = int(round(cy - nh / 2))
    base.alpha_composite(sp, (x, y))


def process_card(src: Path, suit: str, rank: str, sprites: dict[str, Image.Image]) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    comps = find_components(im, suit, min_area=30)
    if not comps:
        print(f"WARN no comps {src.name}")
        return im

    # Corner index suits are small; body pips larger.
    areas = [c["area"] for c in comps]
    # Heuristic: components in top-left / bottom-right corners are index suits
    def is_corner(c):
        cx, cy = c["cx"], c["cy"]
        return (cx < im.width * 0.28 and cy < im.height * 0.28) or (
            cx > im.width * 0.72 and cy > im.height * 0.72
        )

    # Erase all suit components (not rank letters — letters aren't suit-colored for red,
    # but for black suits rank is same color as suit!)
    # For black suits, rank letter is also black — must NOT erase letter components.
    # Rank letters are typically taller/narrower and in corner next to small suit.

    body = []
    corners = []
    for c in comps:
        if is_corner(c) and c["area"] < max(areas) * 0.55:
            corners.append(c)
        else:
            body.append(c)

    # For black suits, the rank glyph may be detected as a component.
    # Filter body: keep blob-like (wider) suit shapes; discard tall thin letter boxes.
    def looks_like_letter(c):
        x0, y0, x1, y1 = c["bbox"]
        bw, bh = x1 - x0, y1 - y0
        if bh <= 0:
            return False
        aspect = bw / bh
        # Letters A,K,Q,J,T,2-9 tend to be taller than wide; suits are often wider or square-ish
        # Also letters sit left of the corner suit
        if is_corner(c) and aspect < 0.85 and c["area"] < max(areas) * 0.5:
            return True
        # large center letter? Neon face cards don't have that.
        return False

    if suit in ("S", "C"):
        # remove letter-like comps from erasure and replacement
        letters = [c for c in comps if looks_like_letter(c)]
        letter_ids = {id(c) for c in letters}
        corners = [c for c in corners if id(c) not in letter_ids]
        body = [c for c in body if id(c) not in letter_ids]
        # Also: among corner pair, the left one might be letter — keep right/more square as suit
        refined = []
        for c in corners:
            x0, y0, x1, y1 = c["bbox"]
            bw, bh = max(1, x1 - x0), max(1, y1 - y0)
            if bw / bh < 0.7 and c["cx"] < im.width * 0.18:
                continue  # likely rank letter
            refined.append(c)
        corners = refined

    erase_list = body + corners
    out = erase_only_components(im, erase_list)

    sprite = sprites[suit]
    # Place replacements
    for c in body:
        x0, y0, x1, y1 = c["bbox"]
        target_h = (y1 - y0) * 1.08
        # Upside-down pips: bottom half of card typically inverted in pip cards
        rot = c["cy"] > im.height * 0.55 and rank not in ("A", "J", "Q", "K")
        # For Ace center etc never rotate unless bottom index
        if rank in ("A", "J", "Q", "K"):
            rot = False
        paste_suit(out, sprite, c["cx"], c["cy"], target_h, rotate180=rot)

    for c in corners:
        x0, y0, x1, y1 = c["bbox"]
        target_h = (y1 - y0) * 1.15
        rot = c["cy"] > im.height * 0.5
        paste_suit(out, sprite, c["cx"], c["cy"], target_h, rotate180=rot)

    return out


def neon_name(suit: str, rank: str) -> str:
    # Neon: S10, SA, HJ, CK — suit letter + rank (T as 10)
    r = "10" if rank == "T" else rank
    return f"{suit}{r}.png"


def main():
    sprites = extract_suit_sprites()
    OUT.mkdir(parents=True, exist_ok=True)
    ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"]
    suits = ["S", "H", "D", "C"]
    # backup current jorel if not already something
    for suit in suits:
        for rank in ranks:
            src = NEON / neon_name(suit, rank)
            if not src.exists():
                print("missing", src)
                continue
            card = process_card(src, suit, rank, sprites)
            dst = OUT / f"{rank}{suit}.png"
            card.save(dst, optimize=True)
            print("wrote", dst.name, "comps done")

    # card back — prefer blue neon
    back = NEON / "Back_Blue.png"
    if back.exists():
        Image.open(back).convert("RGBA").save(OUT / "card_back.png")
        print("wrote card_back.png")

    # turn off pixelated? we'll adjust CSS separately
    print("DONE")


if __name__ == "__main__":
    main()
