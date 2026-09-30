"""Conventional sample editing/composition. No model or external audio service.

Six auditions only: final bank and runtime integration await listening review.
Uses numpy from the bundled workspace runtime and the existing local ffmpeg.
"""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import numpy as np

ROOT = Path(__file__).resolve().parent
FF = "/opt/homebrew/bin/ffmpeg"
SR = 48000
OUT = ROOT / "auditions"
OUT.mkdir(exist_ok=True)
spec = json.loads((ROOT.parent / "phase2d-audio-bank-2026-09-30/event-bank.json").read_text())
targets = {c["id"]: c for c in spec["cues"]}
origins = {}


def ff(args, payload=None):
    p = subprocess.run([FF, "-hide_banner", "-nostdin", *args], input=payload,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode:
        raise RuntimeError(p.stderr.decode()[-2000:])
    return p


def load(key, path, cutoff=6500):
    p = ff(["-i", str(path), "-af", f"highpass=f=65,lowpass=f={cutoff}",
            "-ar", str(SR), "-ac", "1", "-f", "f32le", "pipe:1"])
    a = np.frombuffer(p.stdout, dtype="<f4").astype(np.float64)
    peak = float(np.max(np.abs(a)))
    onset = np.flatnonzero(np.abs(a) > peak * .006)
    a = a[max(0, int(onset[0]) - 144):] if onset.size else a
    a /= max(peak, .00001)
    origins[key] = {"path": str(path.relative_to(ROOT)),
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    return a


guitar = ROOT / "sources/SpanishClassicalGuitar-SFZ+FLAC-20190618/samples"
samples = {n: load(n, guitar / (n + ".flac"), 5200)
           for n in ["D2", "D3", "D4", "D5", "A2", "A3", "A4", "C3", "C4", "C5",
                     "F3", "F4", "E3", "G3"]}
ratio = 2 ** (1 / 12)
samples["A#2"] = np.interp(np.arange(int(len(samples["A2"])/ratio))*ratio,
                            np.arange(len(samples["A2"])), samples["A2"])
origins["A#2"] = {**origins["A2"], "transposeSemitones": 1}
v = ROOT / "sources/vcsl"
k = ROOT / "sources/kenney/Audio"
samples.update({
    "paper": load("paper", k / "card-shove-1.ogg", 6000),
    "place": load("place", k / "card-place-2.ogg", 6200),
    "wood": load("wood", v / "wood_click_pp_rr1.wav", 4600),
    "bell": load("bell", v / "BellTree_Hit_D5_rr1_Mid.wav", 6000),
    "metal": load("metal", v / "Cowbell1_Muted_v2_rr1_Mid.wav", 3000),
    "drum": load("drum", v / "HDrumL_HitMuted_v2_rr1_Sum.wav", 2800),
    "hand": load("hand", v / "HDrumL_Hand_rr1_Sum.wav", 1800),
    "shaker": load("shaker", v / "Mid_ShakerLowFaster_Down_rr1.wav", 5200),
    "brass": load("brass", ROOT / "sources/vsco/Trombone_Sustain_D3_v1_1.wav", 1100),
    "bass": load("bass", ROOT / "sources/vsco/Trombone_Sustain_D2_v1_1.wav", 1000),
})


class Mix:
    def __init__(self, seconds, channels=1, loop=False):
        self.a = np.zeros((round(seconds * SR), channels), dtype=np.float64)
        self.loop, self.used = loop, set()

    def add(self, key, when, gain, duration, semitones=0, pan=0, attack=.002, decay=0):
        self.used.add(key)
        src = samples[key]
        rate = 2 ** (semitones / 12)
        length = min(round(duration * SR), int((len(src)-1) / rate))
        x = np.interp(np.arange(length) * rate, np.arange(len(src)), src)
        t = np.arange(length) / SR
        # Sample tails are enveloped before summing; the loop itself has no fade.
        x *= np.minimum(1, t / max(attack, .0001))
        x *= np.minimum(1, (length / SR - t) / min(.055, duration / 3))
        if decay:
            x *= np.exp(-t / decay)
        x *= gain
        vals = x[:, None]
        if self.a.shape[1] == 2:
            vals = x[:, None] * np.array([np.cos((pan+1)*np.pi/4),
                                         np.sin((pan+1)*np.pi/4)])[None, :]
        start = round(when * SR)
        if self.loop:
            np.add.at(self.a, (np.arange(length)+start) % len(self.a), vals)
        else:
            keep = min(length, len(self.a)-start)
            if keep > 0:
                self.a[start:start+keep] += vals[:keep]

    def room(self):
        dry = self.a.copy()
        for delay, gain in [(47, .045), (89, .022)]:
            offset = round(delay / 1000 * SR)
            reflection = dry[:, ::-1] if self.a.shape[1] == 2 else dry
            if self.loop:
                self.a += np.roll(reflection, offset, axis=0) * gain
            else:
                self.a[offset:] += reflection[:-offset] * gain


def motif(m, start, spacing, gain, length, bell_gain=0):
    for i, n in enumerate(["D4", "A4", "C5", "D5"]):
        m.add(n, start+i*spacing, gain * (1 if i in [0, 3] else .84), length, pan=-.13, decay=.35)
        if bell_gain:
            semi = [0, 7, 10, 12][i]
            m.add("bell", start+i*spacing+.009, bell_gain, length, semi, pan=.2, decay=.19)


made = {}
m = Mix(.1)
m.add("paper", 0, .8, .1, decay=.04)
m.add("wood", .004, .45, .085, decay=.032)
made["spin_press"] = m
m = Mix(.13)
m.add("place", 0, .9, .13, decay=.05)
m.add("wood", .003, .6, .12, decay=.06)
m.add("bell", .004, .045, .11, -24, decay=.037)
made["reel_stop_0"] = m
m = Mix(.65)
motif(m, .002, .15, .6, .19, .045)
m.add("hand", 0, .16, .12, decay=.05)
m.room()
made["win_normal"] = m
m = Mix(1.2)
motif(m, .002, .15, .55, .54, .1)
m.add("drum", .005, .21, .38, decay=.16)
m.add("metal", .006, .04, .16, decay=.04)
m.add("brass", .46, .12, .67, attack=.03, decay=.3)
m.room()
made["big_nice"] = m
m = Mix(1.25)
for t in [0, .1, .2]:
    m.add("wood", t, .35, .11, decay=.045)
motif(m, .3, .15, .5, .45, .15)
m.add("bass", .76, .16, .43, attack=.025, decay=.22)
m.add("drum", .3, .18, .35, decay=.13)
m.room()
made["bonus_trigger"] = m

# Exact 16-bar phrase at 100 BPM. All instrument/room tails wrap into the
# next phrase rather than being cut at a file boundary or globally faded.
m = Mix(38.4, 2, True)
chords = [("D2", "F3", "A3"), ("C3", "E3", "G3"),
          ("A#2", "D3", "F3"), ("A2", "C3", "E3")]
for bar in range(16):
    at = bar * 2.4
    bass, third, fifth = chords[(bar // 2) % 4]
    for t in [0, 1.2]:
        m.add(bass, at+t, .18, 1.3, pan=-.12, decay=.6)
        m.add("hand", at+t+.01, .095, .23, pan=.05, decay=.1)
    for t, n in [(0.6, third), (1.8, fifth)]:
        m.add(n, at+t, .095, .9, pan=.16, decay=.48)
        m.add("drum", at+t+.008, .03, .17, pan=.08, decay=.07)
    for i in range(8):
        m.add("shaker", at+i*.3+.004, .022 if i % 2 else .033, .13, pan=.2, decay=.055)
    if bar % 4 == 0:
        motif(m, at, .6, .09, .74)
    if bar in [3, 11]:
        m.add("bell", at+1.8, .018, .55, -12, pan=.22, decay=.17)
    if bar in [0, 8]:
        m.add("bass", at+.02, .017, 1.1, pan=-.1, attack=.05, decay=.4)
m.room()
made["music_base"] = m


def meter(path, integrated=-24, tp=-3):
    p = ff(["-i", str(path), "-af", f"loudnorm=I={integrated}:TP={tp}:LRA=7:print_format=json",
            "-f", "null", "-"])
    return json.loads(re.search(r'\{\s*"input_i".*?\}', p.stderr.decode(), re.S).group())


report = {"status": "six CC0 auditions; listening review pending; no runtime installation",
          "sourceFiles": origins, "cues": []}
for name, mix in made.items():
    # Gentle conventional peak rounding on compact stingers, preserving gaps.
    if name in ["win_normal", "big_nice", "bonus_trigger"]:
        mix.a = np.tanh(mix.a * 1.25) / 1.25
    source = OUT / (name + "-edit.wav")
    wav = OUT / (name + ".wav")
    c = targets[name]
    ff(["-y", "-f", "f32le", "-ar", str(SR), "-ac", str(c["channels"]),
        "-i", "pipe:0", "-c:a", "pcm_s24le", str(source)], mix.a.astype("<f4").tobytes())
    if "sample peak" in c["target"]:
        peak_target = float(re.search(r'peak−(\d+)', c["target"]).group(1)) * -1
        peak_db = 20*np.log10(float(np.max(np.abs(mix.a))))
        gain = peak_target - peak_db
        measured = None
    else:
        i_target = -float(re.search(r'−(\d+) LUFS', c["target"]).group(1))
        tp_target = -float(re.search(r'dBTP', c["target"]).string.split("TP≤−")[1].split(" ")[0])
        measured = meter(source, i_target, tp_target)
        gain = min(i_target-float(measured["input_i"]), tp_target-float(measured["input_tp"])-.1)
    ff(["-y", "-i", str(source), "-af", f"volume={gain:.8f}dB",
        "-ar", str(SR), "-c:a", "pcm_s24le", str(wav)])
    final = meter(wav, -24, -3)
    decoded = ff(["-i", str(wav), "-f", "f32le", "pipe:1"])
    vals = np.frombuffer(decoded.stdout, dtype="<f4").reshape(-1, c["channels"])
    report["cues"].append({"id": name, "file": str(wav.relative_to(ROOT)),
        "frames": len(vals), "expectedFrames": c["samples"], "channels": c["channels"],
        "target": c["target"], "sourceKeys": sorted(mix.used), "gainDb": gain,
        "samplePeakDbfs": float(20*np.log10(np.max(np.abs(vals)))),
        "lufsIntegrated": final["input_i"], "truePeakDbtp": final["input_tp"],
        "loop": c["loop"], "seamSampleDelta": float(np.max(np.abs(vals[0]-vals[-1]))) if c["loop"] else None,
        "sha256": hashlib.sha256(wav.read_bytes()).hexdigest()})
    ff(["-y", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "192k", str(OUT / (name+".mp3"))])
    source.unlink()  # Raw edit is deterministic from this script and original sources.

# The user requested 30 seconds for audition, while the loop is a full 38.4 s.
ff(["-y", "-i", str(OUT/"music_base.wav"), "-t", "30", "-c:a", "libmp3lame",
    "-b:a", "192k", str(OUT/"music_base-30s.mp3")])
(ROOT/"verification.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report["cues"], indent=2))
