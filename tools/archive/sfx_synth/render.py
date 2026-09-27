#!/usr/bin/env python3
"""In-house SFX renderer for Muerta Poker (C3).

Fully owned, original sounds — pure procedural DSP, no external samples.
Output: 48 kHz mono WAV, 4 variations per sound, to scripts/sfx_synth/out/.

Techniques (deliberately no plain oscillator beeps):
  • marimba / wood bar .... modal synthesis: partials ~1 / 3.9 / 9.2 × f0,
    each with its own exponential decay (high partials much faster), a 3-5 ms
    filtered-noise mallet transient, gentle body resonance.
  • small bell ............ inharmonic partials ~1 / 2.0 / 2.76 / 5.4 / 8.9 × f0,
    long low-partial decay, short high ones, slight detune beating.
  • wood knock ............ 2-3 damped modes (150-400 Hz) + band-passed noise
    click, very short.
  • low drum .............. pitch-drop sine ~90 → 55 Hz + soft noise skin,
    warm, no click.
  • nylon pluck (accents) . Karplus-Strong, low-pass in the loop, soft pick.

Every file: DC-removed, faded to true zero, sample peak ≤ -1 dBFS (≈ -1.4 dBFS
target headroom so encoded/true peak stays ≤ -1 dBTP).

Run:  /usr/bin/python3 scripts/sfx_synth/render.py            (all sounds)
      /usr/bin/python3 scripts/sfx_synth/render.py count_tick (one sound)
"""

import os
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
PEAK_TARGET = 0.85  # ≈ -1.4 dBFS sample peak


# ────────────────────────────────────────────────────────────────────────────
# DSP building blocks
# ────────────────────────────────────────────────────────────────────────────

def _env_exp(n, tau):
    """Exponential decay envelope over n samples with time constant tau (s)."""
    return np.exp(-np.arange(n) / max(1e-6, SR * tau))


def _noise_bandpass(n, lo_hz, hi_hz):
    """Band-passed white noise."""
    x = np.random.uniform(-1.0, 1.0, n)
    ny = SR / 2
    b, a = signal.butter(2, [max(20, lo_hz) / ny, min(hi_hz, ny * 0.98) / ny], btype="band")
    return signal.lfilter(b, a, x)


def marimba(f0, dur, velocity=1.0, rng=None, decay_scale=1.0):
    """Marimba/wood bar via modal synthesis (~1 / 3.9 / 9.2 × f0) + mallet."""
    rng = rng or np.random.default_rng()
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    # partial ratios, decays (high partials die much faster), amplitudes
    partials = [
        (1.0, 0.30 * decay_scale, 1.00),
        (3.9, 0.09 * decay_scale, 0.34),
        (9.2, 0.025 * decay_scale, 0.12),
    ]
    for ratio, tau, amp in partials:
        f = f0 * ratio * (1 + rng.uniform(-0.008, 0.008))
        phase = rng.uniform(0, 2 * np.pi)
        out += amp * np.sin(2 * np.pi * f * t + phase) * _env_exp(n, tau)
    # 3-5 ms filtered-noise mallet transient at the strike
    m = int(SR * rng.uniform(0.003, 0.005))
    strike = _noise_bandpass(m, f0 * 0.7, f0 * 5.0) * _env_exp(m, 0.0035)
    out[:m] += 0.45 * velocity * strike
    # gentle body resonance: one soft low mode an octave below, quick tail
    body_f = f0 * 0.5 * (1 + rng.uniform(-0.01, 0.01))
    out += 0.10 * np.sin(2 * np.pi * body_f * t + rng.uniform(0, 2 * np.pi)) * _env_exp(n, 0.05)
    return velocity * out


def bell(f0, dur, velocity=1.0, rng=None):
    """Small bell: inharmonic partials, long low decay, detune beating."""
    rng = rng or np.random.default_rng()
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    partials = [
        (1.00, dur * 0.55, 1.00),
        (2.00, dur * 0.30, 0.45),
        (2.76, dur * 0.22, 0.30),
        (5.40, dur * 0.12, 0.16),
        (8.90, dur * 0.07, 0.08),
    ]
    for ratio, tau, amp in partials:
        f = f0 * ratio * (1 + rng.uniform(-0.004, 0.004))
        phase = rng.uniform(0, 2 * np.pi)
        out += amp * np.sin(2 * np.pi * f * t + phase) * _env_exp(n, tau)
    # slight detune beating on the fundamental (two lines ± ~0.15 %)
    beat = 1 + rng.uniform(0.0008, 0.002)
    out += 0.35 * np.sin(2 * np.pi * f0 * beat * t) * _env_exp(n, dur * 0.5)
    out += 0.35 * np.sin(2 * np.pi * f0 / beat * t) * _env_exp(n, dur * 0.5)
    # tiny strike ping
    m = int(SR * 0.004)
    out[:m] += 0.25 * velocity * _noise_bandpass(m, f0 * 2, f0 * 9) * _env_exp(m, 0.0025)
    return velocity * out


def wood_knock(dur, modes=((185, 0.030, 1.0), (320, 0.016, 0.55)), velocity=1.0, rng=None, click_hz=(700, 2600)):
    """Wood knock: 2-3 damped low modes + a very short band-passed noise click."""
    rng = rng or np.random.default_rng()
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f0, tau, amp in modes:
        f = f0 * (1 + rng.uniform(-0.02, 0.02))
        out += amp * np.sin(2 * np.pi * f * t + rng.uniform(0, 2 * np.pi)) * _env_exp(n, tau)
    m = int(SR * 0.0025)
    out[:m] += 0.6 * velocity * _noise_bandpass(m, click_hz[0], click_hz[1]) * _env_exp(m, 0.0012)
    return velocity * out


def low_drum(dur, f_start=90.0, f_end=55.0, velocity=1.0, rng=None):
    """Low drum: pitch-drop sine (90 → 55 Hz) + soft noise skin. Warm, no click."""
    rng = rng or np.random.default_rng()
    n = int(SR * dur)
    t = np.arange(n) / SR
    # pitch drops fast in the first ~60 ms, then settles
    f = f_end + (f_start - f_end) * np.exp(-t / 0.05)
    phase = 2 * np.pi * np.cumsum(f) / SR
    amp = np.minimum(t / 0.003, 1.0) * _env_exp(n, dur * 0.42)  # 3 ms fade-in: no click
    out = np.sin(phase) * amp
    # soft skin: quiet low band noise, fast decay
    skin_n = min(n, int(SR * 0.09))
    out[:skin_n] += 0.18 * velocity * _noise_bandpass(skin_n, 60, 380) * _env_exp(skin_n, 0.035)
    return velocity * out


def ks_pluck(f0, dur, velocity=1.0, rng=None, damp=0.995):
    """Nylon pluck via Karplus-Strong with a low-pass inside the loop."""
    rng = rng or np.random.default_rng()
    n = int(SR * dur)
    period = max(2, int(SR / f0))
    excite = np.random.uniform(-1, 1, period)
    b, a = signal.butter(2, 0.42)  # soft pick: low-pass the excitation
    buf = signal.lfilter(b, a, excite)
    out = np.zeros(n)
    idx = 0
    prev = 0.0
    for i in range(n):
        cur = buf[idx]
        buf[idx] = damp * 0.5 * (cur + prev)  # loop low-pass (the string loss)
        prev = cur
        out[i] = cur
        idx = (idx + 1) % period
    return velocity * out


# ────────────────────────────────────────────────────────────────────────────
# Mixdown / master
# ────────────────────────────────────────────────────────────────────────────

def place(base, sound, at_s):
    """Mix `sound` into `base` starting at at_s seconds (clipped to length)."""
    i = int(SR * at_s)
    j = min(base.size, i + sound.size)
    if j > i:
        base[i:j] += sound[: j - i]
    return base


def master(x, tail_ms=8):
    """DC-remove, true-zero fades, normalize to the peak target."""
    x = x - np.mean(x)
    fade_in = int(SR * 0.001)
    fade_out = int(SR * tail_ms / 1000)
    if x.size > fade_in + fade_out:
        x[:fade_in] *= np.linspace(0, 1, fade_in)
        x[-fade_out:] *= np.linspace(1, 0, fade_out)
    peak = np.max(np.abs(x)) or 1.0
    x = x / peak * PEAK_TARGET
    return x.astype(np.float32)


def write_wav(name, x):
    path = os.path.join(OUT, name)
    wavfile.write(path, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
    return path


# ────────────────────────────────────────────────────────────────────────────
# The seven sounds — 4 variations each
# ────────────────────────────────────────────────────────────────────────────

def render_count_tick(rng):
    """Dry marimba ~880 Hz, 40-60 ms, almost no tail (code pitch-steps it)."""
    f0 = 880 * rng.uniform(0.99, 1.01)
    dur = rng.uniform(0.045, 0.06)
    return marimba(f0, dur, velocity=rng.uniform(0.85, 1.05), rng=rng, decay_scale=rng.uniform(0.7, 1.0))


def render_fs_count(rng):
    """Wood knock + small bell A5 → D6, 0.3 s."""
    total = np.zeros(int(SR * 0.3))
    place(total, wood_knock(0.05, velocity=rng.uniform(0.8, 1.0), rng=rng), 0.0)
    place(total, bell(880 * rng.uniform(0.995, 1.005), 0.16, velocity=0.8, rng=rng), 0.045)
    place(total, bell(1174.66 * rng.uniform(0.995, 1.005), 0.22, velocity=0.9, rng=rng), 0.115)
    return total


def render_spin_press(rng):
    """Deep wood knock, 90-110 ms, heavier than button_click."""
    f = rng.uniform(0.97, 1.03)
    return wood_knock(
        rng.uniform(0.09, 0.11),
        modes=((150 * f, 0.055, 1.0), (255 * f, 0.028, 0.6), (395 * f, 0.014, 0.35)),
        velocity=rng.uniform(0.95, 1.1),
        rng=rng,
        click_hz=(500, 2000),
    )


def render_autoplay_start(rng):
    """Wood knock + small bell, <150 ms."""
    total = np.zeros(int(SR * 0.15))
    place(total, wood_knock(0.06, velocity=rng.uniform(0.85, 1.0), rng=rng), 0.0)
    place(total, bell(880 * rng.uniform(0.995, 1.005), 0.1, velocity=0.55, rng=rng), 0.035)
    return total


def render_autoplay_stop(rng):
    """Two quick descending wood knocks, <150 ms."""
    total = np.zeros(int(SR * 0.15))
    place(total, wood_knock(0.055, modes=((230, 0.026, 1.0), (380, 0.013, 0.5)), velocity=rng.uniform(0.85, 1.0), rng=rng), 0.0)
    place(total, wood_knock(0.06, modes=((185, 0.03, 1.0), (300, 0.015, 0.5)), velocity=rng.uniform(0.85, 1.0), rng=rng), 0.07)
    return total


def render_miss_release(rng):
    """Soft low-drum heartbeat that stops + one low marimba B♭2 decaying. 0.8 s, calm."""
    total = np.zeros(int(SR * 0.8))
    # two soft heartbeats… then nothing (the "stops")
    place(total, low_drum(0.28, velocity=0.8, rng=rng), 0.0)
    place(total, low_drum(0.26, velocity=0.65, rng=rng), 0.19)
    # …one low marimba B♭2 (116.54 Hz) breathing out over the rest
    place(total, marimba(116.54 * rng.uniform(0.995, 1.005), 0.55,
                         velocity=rng.uniform(0.55, 0.7), rng=rng, decay_scale=1.6), 0.22)
    return total


def render_bonus_outro(rng):
    """Low drum hit + marimba chord roll resolving minor → major + bell glint, 2 s."""
    total = np.zeros(int(SR * 2.0))
    place(total, low_drum(0.5, velocity=1.0, rng=rng), 0.0)
    # minor roll: D3 F3 A3
    for i, f in enumerate((146.83, 174.61, 220.0)):
        place(total, marimba(f * rng.uniform(0.998, 1.002), 0.9,
                             velocity=rng.uniform(0.6, 0.75), rng=rng, decay_scale=1.5), 0.07 + i * 0.075)
    # resolve to major: D3 F#3 A3 D4
    for i, f in enumerate((146.83, 185.0, 220.0, 293.66)):
        place(total, marimba(f * rng.uniform(0.998, 1.002), 1.2,
                             velocity=rng.uniform(0.65, 0.8), rng=rng, decay_scale=1.7), 0.62 + i * 0.09)
    # bell glint on top of the resolution
    place(total, bell(1760 * rng.uniform(0.995, 1.005), 0.7, velocity=0.5, rng=rng), 1.05)
    # nylon pluck accent under the resolve
    place(total, ks_pluck(146.83, 1.0, velocity=0.35, rng=rng, damp=0.9965), 0.60)
    return total


SOUNDS = {
    "count_tick": render_count_tick,
    "fs_count": render_fs_count,
    "spin_press": render_spin_press,
    "autoplay_start": render_autoplay_start,
    "autoplay_stop": render_autoplay_stop,
    "miss_release": render_miss_release,
    "bonus_outro": render_bonus_outro,
}


def main() -> None:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    os.makedirs(OUT, exist_ok=True)
    names = [only] if only else list(SOUNDS)
    for name in names:
        if name not in SOUNDS:
            print(f"unknown sound: {name}")
            continue
        for v in range(1, 5):
            rng = np.random.default_rng(1000 * list(SOUNDS).index(name) + v)
            x = master(SOUNDS[name](rng))
            path = write_wav(f"{name}_v{v}.wav", x)
            print(f"wrote {path}  ({x.size / SR:.2f}s)")
    # audition page
    write_audition_page()
    print(f"audition page: {os.path.join(OUT, 'index.html')}")


def write_audition_page() -> None:
    """index.html — every variation playable, grouped by sound, with the
    CURRENT in-game stop-gap next to each group for comparison."""
    stopgaps = {
        "count_tick": ("— (synthesized triangle blip at runtime; no file)", None),
        "fs_count": ("— (synthesized two-note chime at runtime; no file)", None),
        "spin_press": ("button_click.wav", "current_button_click.wav"),
        "autoplay_start": ("button_click.wav", "current_button_click.wav"),
        "autoplay_stop": ("button_click.wav", "current_button_click.wav"),
        "miss_release": ("win_soft.mp3 pitched to 0.85", "current_win_soft.mp3"),
        "bonus_outro": ("big_nice.mp3 at 0.7 gain", "current_big_nice.mp3"),
    }
    # copy the stop-gap files next to the page for file:// playback
    import shutil
    sounds_dir = os.path.abspath(os.path.join(OUT, "..", "..", "public", "assets", "sounds"))
    for _, src in stopgaps.values():
        if src:
            src_path = os.path.join(sounds_dir, src.replace("current_", ""))
            if os.path.exists(src_path):
                shutil.copy(src_path, os.path.join(OUT, src))

    rows = []
    for name, fn in SOUNDS.items():
        label, cur = stopgaps[name]
        variations = "".join(
            f'<audio controls preload="none" src="{name}_v{v}.wav"></audio>'
            f'<span class="v">v{v}</span>'
            for v in range(1, 5)
        )
        cur_html = (
            f'<audio controls preload="none" src="{cur}"></audio><span class="v">now</span>'
            if cur else '<span class="none">runtime synth — no file</span>'
        )
        rows.append(f"""
      <section>
        <h2>{name}</h2>
        <p class="desc">{fn.__doc__ or ''}</p>
        <div class="row">{variations}</div>
        <p class="cur">current in-game: {label}</p>
        <div class="row">{cur_html}</div>
      </section>""")

    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Muerta Poker — in-house SFX audition (C3)</title>
<style>
  body {{ background: #120a0d; color: #f1e6cc; font: 15px/1.5 system-ui, sans-serif; margin: 2rem; }}
  h1 {{ color: #ffd97a; }} h2 {{ color: #e0861e; margin-bottom: .2rem; }}
  section {{ border-bottom: 1px solid #2c1c22; padding: 1rem 0; }}
  .row audio {{ height: 32px; margin-right: .4rem; vertical-align: middle; }}
  .v {{ color: #9c8b7a; font-size: .8rem; margin-right: .8rem; }}
  .desc {{ color: #b6a48d; margin: .2rem 0 .6rem; }}
  .cur {{ color: #7d6f61; font-size: .85rem; margin: .5rem 0 .2rem; }}
  .none {{ color: #7d6f61; font-size: .85rem; }}
</style></head><body>
<h1>Muerta Poker — in-house SFX audition</h1>
<p>4 variations per sound (varying partial ratios, decays, velocity). Pick per sound, e.g. “count_tick: v2”.</p>
{''.join(rows)}
</body></html>"""
    with open(os.path.join(OUT, "index.html"), "w") as f:
        f.write(html)


if __name__ == "__main__":
    main()
