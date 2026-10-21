"""Rig the approved master frame (spine/character/master/master.png) for the runtime.

The master is one clean, cel-shaded painting in the final pose (finger raised for the bird). Instead
of cutting it into pieces (cut edges and missing underpainting tear as soon as a part moves), the whole
painting is ONE weighted mesh: every pixel follows a blend of bones (hips, chest, neck, head, eyes,
raised forearm and hand, halo, head wings, hair / sleeve / dress chains with physics, cloud puffs), so
the body bends with no seams. The bird (bird_*.png, its own canvas) sits on her fingertip and flies
with swapped wing frames. Positions below are pixels of master.png (P space, y down).

  /usr/bin/python3 spine/tools/make_master_rig.py   # writes spine/character/character.json + images
Then spine/tools/make_character.sh packs it into the game.
"""
import json, math, os, sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rigkit import (TAU, Pose, Skeleton, back_out, bump, catmull, rot2, smooth, timelines, top4, track)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CH = os.path.join(ROOT, "character")
SRC = os.path.join(CH, "master")
IMG = os.path.join(CH, "images")
FPS = 30
RIG_H = 1424

# ---------------------------------------------------------------- landmarks (P)
PERCH = (698, 400)       # fingertip, where the bird sits
WRIST = (697, 705)
ELBOW = (690, 971)       # under the sleeve
SHOULDER = (913, 796)
NECK = (1129, 740)
HEAD = (1130, 651)       # head pivot (chin/neck)
HEAD_TOP = (1080, 300)
WAIST = (1130, 1050)
SEAT = (1150, 1450)
HEAD_C = (1150, 480)
HEAD_H = 360
EYES = [("eyeL", (1052, 505), 30, 25, 15), ("eyeR", (1160, 522), 50, 34, 22)]  # bone, centre, half-width, half-height, lower lid
EYE_ROT = -9.0  # eye line in S (falls slightly to her left side of the picture)

HAND = [(640, 390), (725, 385), (780, 480), (775, 660), (645, 665), (640, 480)]
FORE = [(640, 660), (775, 655), (760, 790), (750, 940), (700, 985), (640, 965), (628, 800)]
HALO = [(980, 160), (1400, 160), (1400, 350), (1330, 350), (1300, 290), (1180, 262), (1060, 290), (1000, 365), (975, 365)]
WING_L = [(905, 265), (1000, 265), (1030, 380), (1010, 470), (940, 460), (905, 380)]
WING_R = [(1360, 265), (1510, 265), (1520, 450), (1480, 630), (1400, 630), (1365, 520)]
HEADP = [(940, 420), (1000, 335), (1100, 305), (1220, 312), (1320, 360), (1370, 440), (1380, 560), (1330, 620), (1250, 640),
         (1180, 670), (1100, 690), (1040, 680), (990, 640), (950, 580), (930, 500)]
NECKP = [(1060, 640), (1220, 640), (1230, 760), (1070, 770)]
REST_ARM = [(1270, 900), (1390, 930), (1470, 1100), (1590, 1380), (1790, 1450), (1790, 1600), (1560, 1610), (1490, 1480),
            (1400, 1250), (1300, 1060)]
SLEEVE = [(560, 760), (900, 760), (920, 950), (860, 1250), (700, 1300), (570, 1200), (520, 1000)]
TORSO = [(830, 740), (1300, 760), (1370, 1000), (1330, 1300), (1150, 1420), (900, 1350), (800, 1050)]
LEGS = [(650, 1150), (900, 1100), (1150, 1300), (1200, 1500), (1310, 2000), (1300, 2370), (1000, 2380), (980, 2100), (900, 1700),
        (680, 1520)]
DRESS_L = [(340, 1580), (700, 1380), (980, 1500), (990, 2320), (820, 2340), (560, 2330), (360, 2050)]
DRESS_R = [(1300, 1400), (1700, 1560), (1940, 1900), (1900, 2230), (1760, 2200), (1500, 1900), (1300, 1700)]
CLOUD = [(110, 1600), (700, 1560), (1300, 1580), (1950, 1500), (1950, 2340), (110, 2340)]
HAIR_L = [(990, 560), (860, 820), (660, 1080), (470, 1300), (340, 1560)]
HAIR_R = [(1280, 560), (1440, 800), (1620, 1000), (1800, 1220), (1860, 1560)]
SLEEVE_C = [(850, 790), (700, 1020), (600, 1250)]
DRESS_L_C = [(760, 1450), (600, 1850), (470, 2280)]
DRESS_R_C = [(1350, 1480), (1650, 1780), (1880, 2120)]


# ---------------------------------------------------------------- geometry helpers
def seg_dist(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy), t


def inside(poly, p):
    x, y = p
    c = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def member(poly, p, f):
    d = min(seg_dist(p, a, b)[0] for a, b in zip(poly, poly[1:] + poly[:1]))
    return smooth(-f, f, d if inside(poly, p) else -d)


def chain(points, bones, p):
    best = None
    for i, (a, b) in enumerate(zip(points, points[1:])):
        d, t = seg_dist(p, a, b)
        if best is None or d < best[0]:
            best = (d, i + t)
    d, s = best
    w = {}
    for k, bn in enumerate(bones):
        c = k + 0.5
        v = 1 - abs(s - c) / 0.75
        if (k == 0 and s < c) or (k == len(bones) - 1 and s > c):
            v = 1
        if v > 0:
            w[bn] = v
    tot = sum(w.values())
    return d, {k: v / tot for k, v in w.items()}


def body(p):
    y = p[1]
    chest = 1 - smooth(1100, 1300, y)
    legs = smooth(1900, 2100, y)
    return {"chest": chest, "hips": (1 - chest) * (1 - legs), "legs": (1 - chest) * legs}


def rest_arm(p):
    # Shoulder follows the chest, the hand stays planted on the cloud.
    _, t = seg_dist(p, (1300, 950), (1700, 1520))
    c = 1 - smooth(0.25, 0.75, t)
    return {"chest": c, "hips": 1 - c}


def head(p):
    w = {"head": 1.0}
    u = (math.cos(math.radians(-EYE_ROT)), math.sin(math.radians(-EYE_ROT)))  # along the eye line, P
    n = (-u[1], u[0])  # down the face, P
    for bone, c, a, b, lid in EYES:
        du = (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1]
        dn = (p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1]
        m = 1 - smooth(0.7, 1.25, math.hypot(du / a, dn / b))
        if dn > lid:  # below the lower lid the cheek stays put
            m *= max(0.0, 1 - (dn - lid) / 8.0)
        if m > 0:
            w[bone] = m
            w["head"] -= m
    return w


REGIONS = [
    (HAND, 14, {"hand_up": 1}),
    (FORE, 16, {"fore_up": 1}),
    (HALO, 16, {"halo": 1}),
    (WING_L, 16, {"wing_L": 1}),
    (WING_R, 16, {"wing_R": 1}),
    (HEADP, 22, head),
    (NECKP, 22, {"neck": 1}),
    (REST_ARM, 24, rest_arm),
    (SLEEVE, 26, ("chain", SLEEVE_C, ["sleeve1", "sleeve2"])),
    (TORSO, 26, body),
    (LEGS, 26, body),
    (DRESS_L, 28, ("chain", DRESS_L_C, ["dressL1", "dressL2"])),
    (DRESS_R, 28, ("chain", DRESS_R_C, ["dressR1", "dressR2"])),
    (CLOUD, 30, "cloud"),
]


def cloud(p):
    x = p[0]
    l = 1 - smooth(450, 850, x)
    r = smooth(1200, 1600, x)
    return {"cloud_L": l, "cloud_R": r, "cloud_C": max(0.0, 1 - l - r)}


def weights(p):
    out = {}
    left = 1.0

    def give(spec, amount):
        if callable(spec):
            spec = spec(p)
        elif spec == "cloud":
            spec = cloud(p)
        elif isinstance(spec, tuple):
            spec = chain(spec[1], spec[2], p)[1]
        for b, v in spec.items():
            out[b] = out.get(b, 0) + v * amount

    for poly, f, spec in REGIONS:
        m = member(poly, p, f)
        if m > 0 and left > 1e-4:
            give(spec, m * left)
            left -= m * left
    if left > 1e-4:
        hair = []
        for pts, bones in ((HAIR_L, ["hairL1", "hairL2", "hairL3", "hairL4"]), (HAIR_R, ["hairR1", "hairR2", "hairR3", "hairR4"])):
            d, w = chain(pts, bones, p)
            m = 1 - smooth(220, 360, d)
            if m > 0:
                hair.append((m, w))
        if hair:
            tot = sum(m for m, _ in hair)
            share = min(1.0, max(m for m, _ in hair))
            for m, w in hair:
                give(w, left * share * m / tot)
            left -= left * share
        give(body, left)
    return top4(out)


# ---------------------------------------------------------------- mesh (denser around the eyes for blinks)
EYE_ZONE = (1010, 1225, 470, 575)


def lines(lo, size, step, dlo, dhi, dstep):
    v = set(range(0, size, step)) | {size} | {x - lo for x in range(dlo, dhi + 1, dstep) if 0 < x - lo < size}
    out = []
    for x in sorted(v):
        if not out or x - out[-1] >= 3:
            out.append(x)
    if out[-1] != size:
        out[-1] = size
    return out


def build_mesh(sk, img, x0, y0, S, k, step):
    w, h = img.size
    xs = lines(x0, w, step, EYE_ZONE[0], EYE_ZONE[1], 6)
    ys = lines(y0, h, step, EYE_ZONE[2], EYE_ZONE[3], 6)
    alpha = img.split()[3]
    cells, used = [], set()
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            if alpha.crop((xs[i], ys[j], xs[i + 1], ys[j + 1])).getbbox():
                cells.append((i, j))
                used |= {(i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1)}
    idx, uvs, verts = {}, [], []
    for (i, j) in sorted(used, key=lambda v: (v[1], v[0])):
        idx[(i, j)] = len(idx)
        vx, vy = xs[i], ys[j]
        uvs += [round(vx / w, 5), round(vy / h, 5)]
        p = (x0 + vx, y0 + vy)
        ws = weights(p)
        verts.append(len(ws))
        for b, v in ws:
            lx, ly = sk.bind(b, S(p))
            verts += [sk.index(b), round(lx, 2), round(ly, 2), round(v, 4)]
    tris = []
    for (i, j) in cells:
        a, b, c, d = idx[(i, j)], idx[(i + 1, j)], idx[(i + 1, j + 1)], idx[(i, j + 1)]
        tris += [a, b, c, a, c, d]
    return {"type": "mesh", "uvs": uvs, "triangles": tris, "vertices": verts, "hull": 0,
            "width": round(w * k, 2), "height": round(h * k, 2)}, len(idx)


# ---------------------------------------------------------------- choreography
CYAN, GOLD, WHITE, HALO_GLOW = (0x8f, 0xe9, 0xff), (0xff, 0xe2, 0x7a), (0xff, 0xff, 0xff), (0xff, 0xe9, 0xa0)


class Rig:
    def __init__(self, sk, S, P, bird_faces):
        self.sk, self.S, self.P, self.faces = sk, S, P, bird_faces

    def life(self, p, t, b=3.0, s=6.0, h=3.0, e=1.0):
        """Breathing, sway, float, hair and cloth waves, cloud morph. Periods divide the loop."""
        sb, ss = math.sin(TAU * t / b), math.sin(TAU * t / s)
        p.add("hips", y=7 * e * math.sin(TAU * t / b + 0.6), r=0.6 * e * ss)
        p.add("chest", r=1.4 * e * math.sin(TAU * t / s - 0.7), sx=1 + 0.008 * sb, sy=1 + 0.016 * sb)
        p.add("neck", r=-0.6 * e * ss)
        p.add("head", r=2.2 * e * math.sin(TAU * t / s - 1.3))
        p.add("arm_up", r=0.5 * e * math.sin(TAU * t / b + 0.5))
        p.add("fore_up", r=0.9 * math.sin(TAU * t / b + 1.0))
        p.add("hand_up", r=1.4 * math.sin(TAU * t / b + 1.6))
        for i in range(4):
            p.add(f"hairL{i + 1}", r=(1.6 + 1.3 * i) * e * math.sin(TAU * t / h - 0.9 * i))
            p.add(f"hairR{i + 1}", r=(1.4 + 1.4 * i) * e * math.sin(TAU * t / h - 0.9 * i + 1.7))
        for i in range(2):
            p.add(f"sleeve{i + 1}", r=1.6 * e * math.sin(TAU * t / h - 0.6 * i + 0.8))
            p.add(f"dressL{i + 1}", r=1.4 * e * math.sin(TAU * t / h - 0.7 * i + 0.3))
            p.add(f"dressR{i + 1}", r=1.8 * e * math.sin(TAU * t / h - 0.8 * i + 1.1))
        p.add("wing_L", r=2.5 * e * math.sin(TAU * t / (b / 2)))
        p.add("wing_R", r=-2.5 * e * math.sin(TAU * t / (b / 2) + 0.4))
        p.add("halo", r=1.2 * ss, y=3 * math.sin(TAU * t / b + 1.2))
        q = 1 + 0.02 * sb
        p.add("cloud_L", x=4 * ss, sx=q, sy=q)
        p.add("cloud_C", y=4 * math.sin(TAU * t / b + 1.5), sx=1 + 0.012 * math.sin(TAU * t / s + 1))
        q = 1 + 0.02 * math.sin(TAU * t / b + 2.4)
        p.add("cloud_R", x=-4 * math.sin(TAU * t / s + 0.5), sx=q, sy=q)

    def flutter(self, p, t, env, amp=9, hz=6):
        if env > 0:
            p.add("wing_L", r=amp * env * math.sin(TAU * hz * t))
            p.add("wing_R", r=-amp * env * math.sin(TAU * hz * t + 0.5))

    def eyes(self, p, sy):
        p.add("eyeL", sy=sy)
        p.add("eyeR", sy=sy)

    def look(self, p, target):
        """She already looks up at her finger; when the bird is away, her head follows it (+ = toward her finger)."""
        a = max(-6.0, min(1.5, (PERCH[0] - target[0]) / (0.9 * HEAD_H) * 5.0 + 0.0))
        a = a if target[0] > PERCH[0] + 60 or target[1] > PERCH[1] + 80 else min(a, 1.5)
        p.add("head", r=a)
        p.add("neck", r=0.3 * a)
        p.add("chest", r=0.12 * a)

    def perch(self, pose):
        return self.P(self.sk.pos(pose, "perch"))

    def around(self, th, r=1.0):
        c = (HEAD_C[0], HEAD_C[1] - 0.25 * HEAD_H)
        return (c[0] + 1.1 * r * HEAD_H * math.cos(th), c[1] - 0.72 * r * HEAD_H * math.sin(th))

    def bird(self, t, pose, pos, flying, swaps, vx=0.0):
        s, s0 = self.S(pos), self.sk.world["bird"]
        flip = 1.0
        if flying and abs(vx) > 0.5:
            flip = 1.0 if ((vx > 0) == (self.faces == "right")) else -1.0
        pose.add("bird", x=s[0] - s0[0], y=s[1] - s0[1], sx=flip)
        if flying:
            swaps["bird_body"] = "bird_body"
            swaps["bird_wing"] = ["bird_wing_up", "bird_wing_mid", "bird_wing_down", "bird_wing_mid"][int(t * 14) % 4]
        else:
            swaps["bird_body"] = "bird_sit"
            swaps["bird_wing"] = None


def blink(t, times):
    v = 1.0
    for tb in times:
        d = t - tb
        if 0 <= d < 0.07:
            v *= 1 - 0.92 * smooth(0, 1, d / 0.07)
        elif 0.07 <= d < 0.11:
            v *= 0.08
        elif 0.11 <= d < 0.23:
            v *= 0.08 + 0.92 * smooth(0, 1, (d - 0.11) / 0.12)
    return v


def twinkle(slots, p, bone, t, starts, dur=0.5, size=0.5):
    a = 0.0
    for t0 in starts:
        if t0 <= t < t0 + dur:
            a = max(a, math.sin(math.pi * (t - t0) / dur))
    p.add(bone, r=90 * t, sx=max(0.01, a * size), sy=max(0.01, a * size))
    slots[bone] = (WHITE, a)


def bursts(slots, p, t, starts, dist=170, dur=0.45):
    best = (0.0, 0.0)
    for t0 in starts:
        if t0 <= t < t0 + dur:
            d = (t - t0) / dur
            best = max(best, (math.sin(math.pi * d), back_out(d)))
    a, d = best
    for k in range(4):
        ang = math.radians(45 + 90 * k)
        p.add(f"burst{k + 1}", x=dist * d * math.cos(ang), y=dist * d * math.sin(ang), r=180 * d, sx=max(0.01, 0.6 * a), sy=max(0.01, 0.6 * a))
        slots[f"burst{k + 1}"] = (WHITE, a)


def animations(R):
    """name -> (duration, loop, frame(t) -> (pose, slots, swaps, bird P))."""
    hh = HEAD_H
    IDLE, FEAT = (3.0, 6.0, 3.0), (1.5, 3.0, 1.5)

    def landed(t, p, lift=0.0):
        x, y = R.perch(p)
        return (x, y - lift - 0.025 * hh * max(0.0, math.sin(TAU * t / 0.75)))

    A = {}

    # idle_01 (6 s) — the reference's cycle: bird on her finger, flies around her head, lands again.
    def idle_body(t):
        p = Pose()
        R.life(p, t, *IDLE)
        p.add("fore_up", r=track(t, [(0, 0), (1.3, 0), (1.42, -2.5), (1.58, 3.5), (2.0, 0), (4.8, 0), (5.05, -3), (5.4, 1), (6, 0)]))
        p.add("hand_up", r=track(t, [(0, 0), (1.3, 0), (1.42, -3), (1.58, 5), (2.0, 0), (4.8, 0), (5.05, -4), (5.4, 1), (6, 0)]))
        R.flutter(p, t, bump(t, 2.0, 3.8))
        R.eyes(p, blink(t, [0.8, 3.3]))
        return p

    go = [(1.5, landed(1.5, idle_body(1.5))), (1.9, R.around(2.4, 0.75)), (2.35, R.around(1.6)), (2.85, R.around(0.7)),
          (3.35, R.around(-0.2, 1.05)), (3.85, R.around(0.9, 1.15)), (4.4, R.around(2.2, 1.0)), (4.8, (760, 330)),
          (5.05, landed(5.05, idle_body(5.05)))]

    def idle_01(t):
        p = idle_body(t)
        flying = 1.5 <= t < 5.05
        pos = catmull(t, go) if flying else landed(t, p)
        prev = catmull(max(1.5, t - 0.05), go) if flying else pos
        R.look(p, pos)
        slots, swaps = {}, {}
        twinkle(slots, p, "halo_spark1", t, [1.0, 4.0])
        twinkle(slots, p, "halo_spark2", t, [2.5, 5.2])
        bursts(slots, p, t, [5.05], dist=120, dur=0.35)
        R.bird(t, p, pos, flying, swaps, pos[0] - prev[0])
        return p, slots, swaps, pos
    A["idle_01"] = (6.0, True, idle_01)

    # idle_02 (6 s): the bird hops and flutters on her finger; she giggles (squint, head bob).
    def idle_02(t):
        p = Pose()
        R.life(p, t, *IDLE)
        hop = 0.22 * hh * max(bump(t, 1.2, 1.55, 0.12), bump(t, 2.0, 2.35, 0.12))
        flap = bump(t, 3.6, 4.6, 0.15)
        p.add("head", r=track(t, [(0, 0), (1.3, 0), (1.6, 2.5), (2.6, 2.5), (3.2, 0), (6, 0)]))
        p.add("hips", y=4 * bump(t, 1.4, 2.6, 0.2) * math.sin(TAU * 4 * t))
        p.add("hand_up", r=-3 * bump(t, 1.2, 1.3, 0.05) - 3 * bump(t, 2.0, 2.1, 0.05))
        R.eyes(p, blink(t, [0.5, 4.9, 5.15]) * (0.55 if 1.4 < t < 2.6 else 1.0))
        pos = landed(t, p, lift=hop + 0.3 * hh * flap)
        R.look(p, pos)
        slots, swaps = {}, {}
        twinkle(slots, p, "halo_spark1", t, [3.0])
        R.bird(t, p, pos, flap > 0.2 or hop > 0.04 * hh, swaps)
        return p, slots, swaps, pos
    A["idle_02"] = (6.0, True, idle_02)

    def reaction(dur, body_fn, lift=None, fly=None, extra=None, per=IDLE, e=1.0, bird_pos=None, eyes=None):
        def f(t):
            p = Pose()
            R.life(p, t, *per, e=e)
            body_fn(t, p)
            if eyes:
                R.eyes(p, eyes(t))
            pos = bird_pos(t, p) if bird_pos else landed(t, p, lift=(lift(t) if lift else 0.0) * hh)
            prev = bird_pos(max(0.0, t - 0.05), p) if bird_pos else pos
            R.look(p, pos)
            slots, swaps = {}, {}
            if extra:
                extra(t, p, slots)
            R.bird(t, p, pos, fly(t) if fly else False, swaps, pos[0] - prev[0])
            return p, slots, swaps, pos
        return (dur, False, f)

    A["spin_ack"] = reaction(0.5,
        lambda t, p: (p.add("chest", r=track(t, [(0, 0), (0.15, 2), (0.5, 0)])), p.add("hips", y=track(t, [(0, 0), (0.12, -5), (0.35, 1), (0.5, 0)])),
                      p.add("hand_up", r=track(t, [(0, 0), (0.1, -3), (0.25, 3), (0.5, 0)]))),
        lift=lambda t: 0.3 * math.sin(math.pi * min(1, max(0, (t - 0.05) / 0.4))), fly=lambda t: 0.08 < t < 0.4)

    A["cascade_continue"] = reaction(0.4,
        lambda t, p: (p.add("hips", y=track(t, [(0, 0), (0.12, 9), (0.4, 0)])), p.add("head", r=track(t, [(0, 0), (0.15, 1.5), (0.4, 0)]))),
        lift=lambda t: 0.2 * math.sin(math.pi * min(1, t / 0.4)), fly=lambda t: 0.05 < t < 0.35,
        extra=lambda t, p, s: bursts(s, p, t, [0.08], dist=110, dur=0.3), eyes=lambda t: 0.6 if 0.05 < t < 0.3 else 1.0)

    A["small_win"] = reaction(0.8,
        lambda t, p: (p.add("hips", y=track(t, [(0, 0), (0.2, 18), (0.5, 0), (0.62, 4), (0.8, 0)])), R.flutter(p, t, bump(t, 0.1, 0.6, 0.1), 12, 7),
                      p.add("halo", y=track(t, [(0, 0), (0.25, 8), (0.8, 0)]))),
        lift=lambda t: 0.85 * math.sin(math.pi * min(1, t / 0.75)), fly=lambda t: 0.05 < t < 0.72,
        extra=lambda t, p, s: bursts(s, p, t, [0.25]), eyes=lambda t: 0.5 if 0.1 < t < 0.6 else 1.0)

    A["medium_win"] = reaction(1.1,
        lambda t, p: (p.add("hips", y=track(t, [(0, 0), (0.25, 22), (0.6, 0), (0.75, 6), (1.1, 0)])), R.flutter(p, t, bump(t, 0.15, 0.9, 0.15), 14, 7),
                      p.add("halo", y=track(t, [(0, 0), (0.3, 10), (1.1, 0)]), sx=track(t, [(0, 1), (0.35, 1.08), (1.1, 1)]), sy=track(t, [(0, 1), (0.35, 1.08), (1.1, 1)]))),
        fly=lambda t: 0.05 < t < 0.98,
        bird_pos=lambda t, p: landed(t, p) if t < 0.1 or t > 1.0 else catmull(t, [(0.1, landed(0.1, p)), (0.4, R.around(2.0, 1.2)),
                                                                              (0.7, R.around(1.2, 1.25)), (1.0, landed(1.0, p))]),
        extra=lambda t, p, s: (bursts(s, p, t, [0.45], dist=190), s.__setitem__("halo_glow", (HALO_GLOW, track(t, [(0, 0.0), (0.35, 0.8), (1.1, 0.0)])))),
        eyes=lambda t: 0.5 if 0.15 < t < 0.85 else 1.0)

    A["anticipation"] = reaction(1.5,
        lambda t, p: (p.add("chest", r=track(t, [(0, 0), (0.5, 3)])), p.add("head", r=track(t, [(0, 0), (0.6, 2.5)])),
                      p.add("hips", x=track(t, [(0, 0), (0.5, -10)])), p.add("fore_up", r=track(t, [(0, 0), (0.5, 4)])),
                      R.flutter(p, t, track(t, [(0, 0), (0.4, 0.6)]), 6, 8)),
        lift=lambda t: track(t, [(0, 0), (0.5, 0.4)]) + 0.04 * math.sin(TAU * 9 * t), fly=lambda t: t > 0.3,
        extra=lambda t, p, s: s.__setitem__("halo_glow", (HALO_GLOW, track(t, [(0, 0.0), (0.6, 0.6)]))),
        eyes=lambda t: track(t, [(0, 1), (0.3, 1.06)]), e=1.2)

    top = R.around(math.pi / 2, 1.55)
    A["feature_trigger"] = reaction(1.5,
        lambda t, p: (p.add("hips", y=track(t, [(0, 0), (0.22, -8), (0.55, 28), (0.9, 6), (1.5, 0)])),
                      p.add("fore_up", r=track(t, [(0, 0), (0.22, -3), (0.55, 5), (1.5, 0)])),
                      p.add("halo", sx=track(t, [(0, 1), (0.6, 1.15), (1.5, 1.03)]), sy=track(t, [(0, 1), (0.6, 1.15), (1.5, 1.03)])),
                      R.flutter(p, t, bump(t, 0.3, 1.2, 0.15), 14, 7)),
        fly=lambda t: t >= 0.3, per=FEAT, e=1.3,
        bird_pos=lambda t, p: landed(t, p) if t < 0.3 else catmull(t, [(0.3, landed(0.3, p)), (0.55, R.around(2.3, 1.1)), (0.75, top),
                                                                      (1.0, R.around(0.9, 1.35)), (1.5, R.around(0.0, 1.35))]),
        extra=lambda t, p, s: (bursts(s, p, t, [0.75], dist=260, dur=0.55), s.__setitem__("halo_glow", (HALO_GLOW, track(t, [(0, 0.2), (0.6, 1.0), (1.5, 0.6)]))),
                               twinkle(s, p, "halo_spark1", t, [0.55]), twinkle(s, p, "halo_spark2", t, [0.7])),
        eyes=lambda t: 0.45 if 0.45 < t < 1.1 else 1.0)

    def feature_idle(t):
        p = Pose()
        R.life(p, t, *FEAT, e=1.6)
        R.flutter(p, t, 1.0, 5, 3)
        R.eyes(p, blink(t, [1.1]))
        th = TAU * t / 3.0
        pos, prev = R.around(th, 1.35), R.around(th - TAU * 0.05 / 3.0, 1.35)
        R.look(p, pos)
        slots, swaps = {"halo_glow": (HALO_GLOW, 0.6 + 0.2 * math.sin(TAU * t / 1.5))}, {}
        twinkle(slots, p, "halo_spark1", t, [0.4, 1.9])
        twinkle(slots, p, "halo_spark2", t, [1.2, 2.6])
        R.bird(t, p, pos, True, swaps, pos[0] - prev[0])
        return p, slots, swaps, pos
    A["feature_idle"] = (3.0, True, feature_idle)

    def big_bird(t, p):
        if t < 0.3 or t >= 2.1:
            return landed(t, p)
        th0 = 2.6
        if t < 0.5:
            return catmull(t, [(0.3, landed(0.3, p)), (0.5, R.around(th0, 1.35))])
        if t < 1.7:
            return R.around(th0 - 2 * TAU * (t - 0.5) / 1.2, 1.35)
        return catmull(t, [(1.7, R.around(th0 - 2 * TAU, 1.35)), (1.9, (760, 330)), (2.1, landed(2.1, p))])

    A["big_win"] = reaction(2.2,
        lambda t, p: (p.add("hips", y=track(t, [(0, 0), (0.25, 24), (0.5, 0), (0.75, 28), (1.05, 0), (1.2, 5), (1.45, 0)])),
                      p.add("head", r=track(t, [(0, 0), (0.4, -3), (1.4, -3), (2.0, 0)])),
                      p.add("halo", sx=track(t, [(0, 1), (0.4, 1.15), (1.6, 1.15), (2.2, 1)]), sy=track(t, [(0, 1), (0.4, 1.15), (1.6, 1.15), (2.2, 1)])),
                      R.flutter(p, t, bump(t, 0.2, 1.6, 0.2), 14, 7)),
        fly=lambda t: 0.3 <= t < 2.1, e=1.3, bird_pos=big_bird,
        extra=lambda t, p, s: (bursts(s, p, t, [0.5, 1.0, 1.5], dist=200), s.__setitem__("halo_glow", (HALO_GLOW, track(t, [(0, 0.0), (0.4, 1.0), (1.6, 1.0), (2.2, 0.0)]))),
                               twinkle(s, p, "halo_spark1", t, [0.4, 1.2]), twinkle(s, p, "halo_spark2", t, [0.8, 1.6])),
        eyes=lambda t: 0.45 if 0.25 < t < 1.6 else 1.0)

    A["settle_to_idle"] = reaction(0.7, lambda t, p: None, fly=lambda t: t < 0.6,
        bird_pos=lambda t, p: catmull(t, [(0, R.around(0.0, 1.35)), (0.35, R.around(1.4, 1.0)), (0.6, landed(0.6, p))]) if t < 0.6 else landed(t, p))
    return A


# ---------------------------------------------------------------- write
def main():
    master = Image.open(os.path.join(SRC, "master.png")).convert("RGBA")
    x0, y0, x1, y1 = master.getbbox()
    body_img = master.crop((x0, y0, x1, y1))
    k = RIG_H / (y1 - y0)
    cx = (x0 + x1) / 2

    def S(p):
        return ((p[0] - cx) * k, (y1 - p[1]) * k)

    def P(s):
        return (s[0] / k + cx, y1 - s[1] / k)

    cfg_path = os.path.join(SRC, "rig.json")
    cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}

    sk = Skeleton()
    sk.bone("root")
    sk.bone("char", "root")
    sk.bone("cloud_root", "char", S((1030, 1900)))
    for n, at in (("cloud_L", (500, 1950)), ("cloud_C", (1030, 1950)), ("cloud_R", (1600, 1950))):
        sk.bone(n, "cloud_root", S(at))
    sk.bone("hips", "char", S(SEAT), S(WAIST))
    sk.bone("legs", "hips", S((1100, 1900)))
    sk.bone("chest", "hips", S(WAIST), S(NECK))
    sk.bone("neck", "chest", S(NECK), S(HEAD))
    sk.bone("head", "neck", S(HEAD), S(HEAD_TOP))
    for bone, c, a, b, lid in EYES:
        u = (math.cos(math.radians(-EYE_ROT)), math.sin(math.radians(-EYE_ROT)))
        sk.bone(bone, "head", S((c[0] - u[1] * lid, c[1] + u[0] * lid)), rot=EYE_ROT)
    sk.bone("halo", "head", S((1180, 262)))
    sk.bone("halo_spark1", "halo", S((1010, 200)))
    sk.bone("halo_spark2", "halo", S((1370, 190)))
    sk.bone("wing_L", "head", S((1000, 430)))
    sk.bone("wing_R", "head", S((1370, 520)))
    sk.bone("arm_up", "chest", S(SHOULDER), S(ELBOW))
    sk.bone("fore_up", "arm_up", S(ELBOW), S(WRIST))
    sk.bone("hand_up", "fore_up", S(WRIST), S(PERCH))
    sk.bone("perch", "hand_up", S(PERCH))

    def chain_bones(prefix, pts, n, first_parent, then_parent=None):
        a, b = pts[0], pts[-1]
        out = []
        for i in range(n):
            p0 = pts[min(i, len(pts) - 1)] if len(pts) == n + 1 else (a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)
            p1 = pts[min(i + 1, len(pts) - 1)] if len(pts) == n + 1 else (a[0] + (b[0] - a[0]) * (i + 1) / n, a[1] + (b[1] - a[1]) * (i + 1) / n)
            par = first_parent if i == 0 else (then_parent if (i == 1 and then_parent) else out[-1])
            out.append(sk.bone(f"{prefix}{i + 1}", par, S(p0), S(p1)))
        return out

    chain_bones("hairL", HAIR_L, 4, "head", "chest")   # lower hair rests on the body, not the head
    chain_bones("hairR", HAIR_R, 4, "head", "chest")
    chain_bones("sleeve", SLEEVE_C, 2, "chest")
    chain_bones("dressL", DRESS_L_C, 2, "hips")
    chain_bones("dressR", DRESS_R_C, 2, "hips")
    sk.bone("bird", "char", S(PERCH))
    for n in ("trail1", "trail2"):
        sk.bone(n, "char", S(PERCH))
    for kk in range(1, 5):
        sk.bone(f"burst{kk}", "bird", S(PERCH))

    os.makedirs(IMG, exist_ok=True)
    for f in os.listdir(IMG):
        if f.endswith(".png"):
            os.remove(os.path.join(IMG, f))
    body_img.save(os.path.join(IMG, "heroine.png"))
    birds = {}
    for n in ("bird_body", "bird_sit", "bird_wing_up", "bird_wing_mid", "bird_wing_down"):
        im = Image.open(os.path.join(SRC, n + ".png")).convert("RGBA")
        bx = im.getbbox()
        im.crop(bx).save(os.path.join(IMG, n + ".png"))
        birds[n] = bx

    def radial(name, profile):
        a = Image.new("L", (128, 128))
        a.putdata([int(255 * profile(min(1.0, math.hypot(x - 63.5, y - 63.5) / 64))) for y in range(128) for x in range(128)])
        Image.merge("RGBA", (Image.new("L", (128, 128), 255),) * 3 + (a,)).save(os.path.join(IMG, name + ".png"))
    radial("fx_soft", lambda r: max(0.0, 1 - r) ** 1.8)
    Image.open(os.path.join(ROOT, "screens", "images", "spark.png")).save(os.path.join(IMG, "fx_spark.png"))

    mesh, nverts = build_mesh(sk, body_img, x0, y0, S, k, 40)
    # Bird: scale 0.40 of its 512 canvas in master pixels (the perch trial), feet on the fingertip.
    kb = cfg.get("bird_scale", 0.40)
    sit = birds["bird_sit"]
    feet = ((sit[0] + sit[2]) / 2, sit[3] - 6)

    def bird_att(n):
        b = birds[n]
        c = ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
        return {"x": round((c[0] - feet[0]) * kb * k, 2), "y": round((feet[1] - c[1]) * kb * k, 2),
                "width": round((b[2] - b[0]) * kb * k, 2), "height": round((b[3] - b[1]) * kb * k, 2)}

    soft = lambda sc: {"width": 128, "height": 128, "scaleX": round(sc, 3), "scaleY": round(sc, 3)}
    slots = [
        {"name": "heroine", "bone": "hips", "attachment": "heroine"},
        {"name": "halo_glow", "bone": "halo", "color": "ffe9a000", "attachment": "fx_soft", "blend": "additive"},
        {"name": "halo_spark1", "bone": "halo_spark1", "color": "ffffff00", "attachment": "fx_spark", "blend": "additive"},
        {"name": "halo_spark2", "bone": "halo_spark2", "color": "ffffff00", "attachment": "fx_spark", "blend": "additive"},
        {"name": "trail2", "bone": "trail2", "color": "ffffff00", "attachment": "fx_soft", "blend": "additive"},
        {"name": "trail1", "bone": "trail1", "color": "ffffff00", "attachment": "fx_soft", "blend": "additive"},
        {"name": "bird_body", "bone": "bird", "attachment": "bird_sit"},
        {"name": "bird_wing", "bone": "bird"},
    ] + [{"name": f"burst{kk}", "bone": f"burst{kk}", "color": "ffffff00", "attachment": "fx_spark", "blend": "additive"} for kk in range(1, 5)]
    skin = {
        "heroine": {"heroine": mesh},
        "halo_glow": {"fx_soft": {"width": 128, "height": 128, "scaleX": round(420 * k / 128, 3), "scaleY": round(220 * k / 128, 3)}},
        "halo_spark1": {"fx_spark": {"width": 128, "height": 128}},
        "halo_spark2": {"fx_spark": {"width": 128, "height": 128}},
        "trail1": {"fx_soft": soft(140 * k / 128)},
        "trail2": {"fx_soft": soft(140 * k / 128)},
        "bird_body": {n: bird_att(n) for n in ("bird_sit", "bird_body")},
        "bird_wing": {n: bird_att(n) for n in ("bird_wing_up", "bird_wing_mid", "bird_wing_down")},
    }
    for kk in range(1, 5):
        skin[f"burst{kk}"] = {"fx_spark": {"width": 128, "height": 128}}

    PHYS = [("hairL2", 70, 0.82), ("hairL3", 55, 0.8), ("hairL4", 45, 0.78), ("hairR2", 70, 0.82), ("hairR3", 55, 0.8),
            ("hairR4", 45, 0.78), ("sleeve1", 85, 0.84), ("sleeve2", 65, 0.82), ("dressL1", 80, 0.85), ("dressL2", 60, 0.82),
            ("dressR1", 75, 0.84), ("dressR2", 55, 0.8), ("wing_L", 140, 0.7), ("wing_R", 140, 0.7)]
    constraints = [{"type": "physics", "name": f"phys_{b}", "bone": b, "rotate": 1, "inertia": 0.6, "strength": s,
                    "damping": d, "mass": 1, "fps": 60} for b, s, d in PHYS]

    R = Rig(sk, S, P, cfg.get("bird_faces", "right"))
    setup_alpha = {s["name"]: 0.0 for s in slots if s.get("color", "ff").endswith("00")}
    setup_att = {"heroine": "heroine", "bird_body": "bird_sit", "bird_wing": None}
    S0 = sk.world["bird"][:2]
    anims = {}
    for name, (dur, loop, f) in animations(R).items():
        n = int(round(dur * FPS))
        times = [i / FPS for i in range(n + 1)]
        frames = []
        for t in times:
            pose, sl, sw, pos = f(t)
            frames.append((pose, sl, sw, S(pos)))
        for i, (pose, sl, sw, s) in enumerate(frames):  # glow trails where the bird was a moment ago
            for kk, lag in ((1, 2), (2, 4)):
                j = (i - lag) % n if loop else max(0, i - lag)
                ps = frames[j][3]
                speed = math.hypot(s[0] - ps[0], s[1] - ps[1]) * FPS / lag
                pose.add(f"trail{kk}", x=ps[0] - S0[0], y=ps[1] - S0[1], sx=0.8 - 0.2 * kk, sy=0.8 - 0.2 * kk)
                sl[f"trail{kk}"] = (GOLD, max(0.0, min(0.6, (speed - 300) / 1500)) * (1.0 - 0.3 * kk))
        if loop:
            frames[-1] = frames[0]
        anims[name] = timelines(times, [(a, b, c) for a, b, c, _ in frames], setup_alpha, setup_att)

    skel = {
        "skeleton": {"hash": "sky-drop-heroine-master", "spine": "4.3.26", "x": round(S((x0, 0))[0], 1), "y": 0,
                     "width": round((x1 - x0) * k, 1), "height": RIG_H, "fps": FPS, "images": "./images/"},
        "bones": sk.json(), "slots": slots, "constraints": constraints,
        "skins": [{"name": "default", "attachments": skin}], "animations": anims,
    }
    path = os.path.join(CH, "character.json")
    with open(path, "w") as fo:
        json.dump(skel, fo, separators=(",", ":"))
    print(f"character.json {os.path.getsize(path) // 1024} KB, mesh {nverts} verts, {len(sk.order)} bones")


if __name__ == "__main__":
    main()
