"""Generate the chest and frame Spine 4.3 rigs (JSON) from the art in spine/<rig>/images.
Run with /usr/bin/python3 (needs PIL); then import with the Spine CLI (see make_rigs.sh)."""
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def size(rig, name):
    with Image.open(os.path.join(ROOT, rig, "images", name + ".png")) as im:
        return im.size

def k(t, **v):
    d = {"time": round(t, 4)} if t else {}
    d.update(v)
    return d

def rgba(t, a, rgb="ffffff"):
    return k(t, color=f"{rgb}{int(round(a * 255)):02x}")

# ---------------------------------------------------------------- chest
def chest():
    cw, chh = size("chest", "chest_closed")
    gw, gh = size("chest", "glow")
    rw, rh = size("chest", "ring")
    skel = {
        "skeleton": {"hash": "sky-drop-chest", "spine": "4.3.26", "x": -cw / 2, "y": 0, "width": cw, "height": chh, "fps": 30, "images": "./images/"},
        "bones": [{"name": "root"}, {"name": "chest", "parent": "root"}, {"name": "glow", "parent": "root", "y": chh * 0.48}, {"name": "ring", "parent": "root", "y": chh * 0.48}],
        "slots": [
            {"name": "glow", "bone": "glow", "color": "ffd96a00", "attachment": "glow", "blend": "additive"},
            {"name": "chest", "bone": "chest", "attachment": "chest_closed"},
            {"name": "ring", "bone": "ring", "color": "fff2b000", "attachment": "ring", "blend": "additive"},
        ],
        "skins": [{"name": "default", "attachments": {
            "glow": {"glow": {"scaleX": 2.4, "scaleY": 2.4, "width": gw, "height": gh}},
            "chest": {"chest_closed": {"y": chh / 2, "width": cw, "height": chh}, "chest_open": {"y": chh / 2, "width": cw, "height": chh}},
            "ring": {"ring": {"width": rw, "height": rh}},
        }}],
        "animations": {},
    }
    A = skel["animations"]
    A["idle"] = {"bones": {"chest": {"scale": [k(0), k(1.0, x=1.012, y=1.012), k(2.0)]}}}
    A["unlock"] = {
        "slots": {"glow": {"rgba": [rgba(0, 0, "ffd96a"), rgba(0.2, 1, "ffd96a"), rgba(0.8, 0.85, "ffd96a")]},
                  "ring": {"rgba": [rgba(0, 1, "fff2b0"), rgba(0.6, 0, "fff2b0")]}},
        "bones": {
            "chest": {"rotate": [k(0), k(0.08, value=-6), k(0.18, value=6), k(0.28, value=-4), k(0.38, value=3), k(0.5, value=-1), k(0.6)],
                      "scale": [k(0), k(0.15, x=1.12, y=1.12), k(0.4, x=1, y=1)]},
            "ring": {"scale": [k(0, x=0.4, y=0.4), k(0.6, x=1.7, y=1.7)]},
            "glow": {"scale": [k(0, x=0.6, y=0.6), k(0.3, x=1.1, y=1.1), k(0.8)]},
        },
    }
    A["unlocked"] = {
        "slots": {"glow": {"rgba": [rgba(0, 0.85, "ffd96a"), rgba(0.6, 0.55, "ffd96a"), rgba(1.2, 0.85, "ffd96a")]}},
        "bones": {"chest": {"rotate": [k(0, value=-2.5), k(0.6, value=2.5), k(1.2, value=-2.5)]},
                  "glow": {"scale": [k(0), k(0.6, x=1.12, y=1.12), k(1.2)]}},
    }
    A["open"] = {
        "slots": {"chest": {"attachment": [k(0, name="chest_open")]},
                  "glow": {"rgba": [rgba(0, 1, "fff0a0"), rgba(0.7, 0.9, "ffd96a")]},
                  "ring": {"rgba": [rgba(0, 1, "fffbe0"), rgba(0.55, 0, "fffbe0")]}},
        "bones": {"chest": {"scale": [k(0, x=0.75, y=0.75), k(0.18, x=1.18, y=1.18), k(0.45, x=1, y=1)]},
                  "ring": {"scale": [k(0, x=0.5, y=0.5), k(0.55, x=2.1, y=2.1)]},
                  "glow": {"scale": [k(0, x=1.5, y=1.5), k(0.7, x=1.15, y=1.15)]}},
    }
    A["opened"] = {
        "slots": {"chest": {"attachment": [k(0, name="chest_open")]},
                  "glow": {"rgba": [rgba(0, 0.9, "ffd96a"), rgba(0.8, 0.6, "ffd96a"), rgba(1.6, 0.9, "ffd96a")]}},
        "bones": {"glow": {"scale": [k(0, x=1.15, y=1.15), k(0.8, x=1.25, y=1.25), k(1.6, x=1.15, y=1.15)]}},
    }
    A["locked"] = {"slots": {"chest": {"rgba": [rgba(0, 1, "e6e6e6")]}}}
    return skel

# ---------------------------------------------------------------- frame
def frame():
    fw, fh = size("frame", "frame")
    bw, bh = size("frame", "beam")
    skel = {
        "skeleton": {"hash": "sky-drop-frame", "spine": "4.3.26", "x": -fw / 2, "y": -fh / 2, "width": fw, "height": fh, "fps": 30, "images": "./images/"},
        "bones": [{"name": "root"}, {"name": "frame", "parent": "root"}, {"name": "shine", "parent": "root", "rotation": -20, "x": -fw * 0.7, "scaleY": 4.5, "scaleX": 1.4}],
        "slots": [
            {"name": "frame", "bone": "frame", "attachment": "frame"},
            {"name": "flash", "bone": "frame", "color": "ffffff00", "attachment": "frame", "blend": "additive"},
            {"name": "shine", "bone": "shine", "color": "fff6c800", "attachment": "beam", "blend": "additive"},
        ],
        "skins": [{"name": "default", "attachments": {
            "frame": {"frame": {"width": fw, "height": fh}},
            "flash": {"frame": {"width": fw, "height": fh}},
            "shine": {"beam": {"width": bw, "height": bh}},
        }}],
        "animations": {
            "idle": {"slots": {"flash": {"rgba": [rgba(0, 0)]}}},
            "win": {
                "slots": {"flash": {"rgba": [rgba(0, 0, "fff2c0"), rgba(0.12, 0.55, "fff2c0"), rgba(0.45, 0, "fff2c0")]},
                          "shine": {"rgba": [rgba(0, 0, "fff6c8"), rgba(0.1, 0.9, "fff6c8"), rgba(0.5, 0, "fff6c8")]}},
                "bones": {"shine": {"translate": [k(0), k(0.5, x=fw * 1.4)]}},
            },
            "anticipation": {"slots": {"flash": {"rgba": [rgba(0, 0.1, "ffd060"), rgba(0.4, 0.45, "ffd060"), rgba(0.8, 0.1, "ffd060")]}}},
            "feature": {"slots": {"flash": {"rgba": [rgba(0, 0.05, "ffe0f0"), rgba(1.5, 0.2, "ffe0f0"), rgba(3, 0.05, "ffe0f0")]}}},
        },
    }
    return skel

for rig, build in (("chest", chest), ("frame", frame)):
    out = os.path.join(ROOT, rig, rig + ".json")
    json.dump(build(), open(out, "w"), indent=1)
    print("wrote", out)
