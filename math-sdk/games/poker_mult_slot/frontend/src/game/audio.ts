/** Casino audio — SFX WAV pack + music bed.
 *  AUDIO OWNERSHIP: React owns music, win stings (selection by winX ONLY),
 *  Big Win stings, UI sounds and ducking. Godot owns ONLY frame-synced
 *  sounds (reel stops, spin loop, joker land, mult land, anticipation cue)
 *  and never plays win stings — so each sting fires exactly once.
 *  Every trigger passes a 50 ms retrigger guard; win stings are limited to
 *  one voice (a new sting replaces the previous instead of stacking). */

import { assetUrl } from "./assets";

const FILES = {
  button_click: assetUrl("assets/sounds/button_click.wav"),
  card_deal: assetUrl("assets/sounds/card_deal.wav"),
  card_deal_turbo: assetUrl("assets/sounds/card_deal_turbo.wav"),
} as const;

const MUSIC_FILE = assetUrl("assets/sounds/music_muerta.wav");
/** Background loop sits well below SFX so the mix has space for game sounds.
 *  music_muerta.wav is normalized to -22 LUFS (see scripts/normalize_audio.sh):
 *  at ×0.40 the bed plays at ≈ -30 LUFS effective — ~6-7 dB under the win
 *  stings (files -17…-14.5 × default volumes) and ~10 dB under reel stops. */
const MUSIC_LEVEL = 0.4;

type Sfx = keyof typeof FILES;

let unlocked = false;
const LS_KEY = "pms_audio_settings";
function loadVol(k: string, d: number): number {
  try {
    const num = Number(JSON.parse(localStorage.getItem(LS_KEY) ?? "{}")?.[k]);
    return Number.isFinite(num) ? Math.min(1, Math.max(0, num)) : d;
  } catch {
    return d;
  }
}
function persistVols() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ sfx: sfxVol, master: masterVol, muted: masterMuted }));
  } catch {
    /* storage unavailable */
  }
}
let sfxVol = loadVol("sfx", 0.55);
let masterVol = loadVol("master", 1);
let masterMuted = false;
try {
  masterMuted = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}")?.muted === true;
} catch {
  /* ignore */
}
let audioCtx: AudioContext | null = null;
const pool = new Map<Sfx, HTMLAudioElement[]>();
let musicEl: HTMLAudioElement | null = null;

// ——— Retrigger guard + per-category voice limits ———
// The SAME event twice within 50 ms is ignored (rapid clicking, or any
// future React/Godot overlap, must never flange a hit against itself).
// Wins are capped at ONE voice: a new win/big-win sting stops the previous
// one instead of stacking on top of it. UI is capped at 2 voices.
const RETRIGGER_MS = 50;
const lastTriggerAt = new Map<string, number>();
const activeWinVoices = new Set<AudioBufferSourceNode>();

/** Debug aid (?sfxlog=1): every ADMITTED trigger lands here with a timestamp,
 *  so a verification run can prove no sample fires twice within 100 ms. */
const sfxLogEnabled =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("sfxlog");

function logTrigger(event: string) {
  if (!sfxLogEnabled) return;
  const w = window as typeof window & { __sfxLog?: Array<{ t: number; event: string }> };
  (w.__sfxLog ??= []).push({ t: performance.now(), event });
}

/** False (skip the sound) when this exact event fired within RETRIGGER_MS. */
function gate(event: string): boolean {
  const now = performance.now();
  if (now - (lastTriggerAt.get(event) ?? -Infinity) < RETRIGGER_MS) return false;
  lastTriggerAt.set(event, now);
  logTrigger(event);
  return true;
}

function stopWinVoices() {
  for (const src of activeWinVoices) {
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
  }
  activeWinVoices.clear();
}

// ——— Music bed ———
// Played through WebAudio as a looping AudioBufferSourceNode: the loop wraps on the exact
// sample, so there is no gap or click at the seam. (An <audio loop> element re-seeks at the
// end of the file, which leaves an audible hiccup in most browsers.) The <audio> element
// below is only a fallback for when the WAV cannot be decoded.
let musicBuffer: AudioBuffer | null = null;
let musicLoading: Promise<AudioBuffer | null> | null = null;
let musicSource: AudioBufferSourceNode | null = null;
let musicGain: GainNode | null = null;
let musicFallback = false;
let musicStopTimer = 0;

async function loadMusicBuffer(c: AudioContext): Promise<AudioBuffer | null> {
  if (musicBuffer) return musicBuffer;
  if (!musicLoading) {
    musicLoading = (async () => {
      try {
        const res = await fetch(MUSIC_FILE);
        const raw = await res.arrayBuffer();
        musicBuffer = await c.decodeAudioData(raw);
        return musicBuffer;
      } catch {
        return null;
      } finally {
        musicLoading = null;
      }
    })();
  }
  return musicLoading;
}

function ensureMusic() {
  if (!musicEl) {
    musicEl = new Audio(MUSIC_FILE);
    musicEl.loop = true;
    musicEl.preload = "auto";
  }
  return musicEl;
}

function updateMusicFallback() {
  const el = ensureMusic();
  el.volume = clamp01(MUSIC_LEVEL * masterVol);
  if (audioEnabled()) {
    if (el.paused) void el.play().catch(() => {});
  } else if (!el.paused) {
    el.pause();
  }
}

function updateMusic() {
  if (!unlocked) return;
  if (musicFallback) {
    updateMusicFallback();
    return;
  }
  const c = ensureCtx();
  if (!c) return;
  if (!musicGain) {
    musicGain = c.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(c.destination);
  }
  const on = audioEnabled() && masterVol > 0;
  const target = on ? clamp01(MUSIC_LEVEL * masterVol) : 0;
  // Short glide — no zipper noise on the volume slider, no click on mute/unmute.
  musicGain.gain.cancelScheduledValues(c.currentTime);
  musicGain.gain.setTargetAtTime(target, c.currentTime, 0.05);

  window.clearTimeout(musicStopTimer);
  if (!on) {
    // Silent: release the source once the fade-out has finished.
    if (musicSource) {
      const src = musicSource;
      musicStopTimer = window.setTimeout(() => {
        if (musicSource !== src) return;
        musicSource = null;
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }, 400);
    }
    return;
  }
  if (musicSource) return;
  void loadMusicBuffer(c).then((buf) => {
    if (!buf) {
      musicFallback = true;
      updateMusic();
      return;
    }
    // Re-check: state may have changed while the file was decoding.
    if (musicSource || !audioEnabled() || !musicGain) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = buf.duration;
    src.connect(musicGain);
    src.start(0);
    musicSource = src;
  });
}

function canAudio() {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

/** Lazily created WebAudio context (needs a user gesture before it will run). */
function ensureCtx() {
  if (!canAudio() || !unlocked) return null;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume().catch(() => {});
  return audioCtx;
}

function audioEnabled() {
  return canAudio() && unlocked && !masterMuted;
}

function playSfx(name: Sfx, gain = 1) {
  if (!gate(`ui:${name}`)) return;
  if (!audioEnabled()) return;
  if (sfxVol <= 0 || masterVol <= 0) return;
  let list = pool.get(name);
  if (!list) {
    list = [];
    pool.set(name, list);
  }
  let el = list.find((a) => a.paused);
  if (!el) {
    // UI voice cap: with every element busy, recycle the oldest instead of
    // stacking a third copy of the same click.
    if (list.length >= 2) el = list[0];
    else {
      el = new Audio(FILES[name]);
      el.preload = "auto";
      list.push(el);
    }
  }
  el.volume = clamp01(sfxVol * gain * masterVol);
  el.currentTime = 0;
  void el.play().catch(() => {});
}

// ——— WebAudio stings + deal cascade ———

/** Short bell partial used by the win/scatter stings. */
function ding(
  c: AudioContext,
  freq: number,
  t0: number,
  dur: number,
  gain: number,
  type: OscillatorType,
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t0 + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

// ——— Sample pack (rendered SFX: card slap, guitar wins, bells, brass fanfares) ———
// Decoded once after the first user gesture. Every call site falls back to the small synthesized
// sting when a sample is not decoded yet, so a slow network never leaves the game silent.
const SAMPLE_FILES = {
  reel_stop_0: "assets/sounds/reel_stop_0.mp3",
  reel_stop_1: "assets/sounds/reel_stop_1.mp3",
  reel_stop_2: "assets/sounds/reel_stop_2.mp3",
  reel_stop_3: "assets/sounds/reel_stop_3.mp3",
  reel_stop_4: "assets/sounds/reel_stop_4.mp3",
  spin_loop: "assets/sounds/spin_loop.wav",
  win_soft: "assets/sounds/win_soft.mp3",
  win_line: "assets/sounds/win_line.mp3",
  win_multi: "assets/sounds/win_multi.mp3",
  joker_land: "assets/sounds/joker_land.mp3",
  anticipation: "assets/sounds/anticipation.mp3",
  bonus_trigger: "assets/sounds/bonus_trigger.mp3",
  big_nice: "assets/sounds/big_nice.mp3",
  big_super: "assets/sounds/big_super.mp3",
  big_sensational: "assets/sounds/big_sensational.mp3",
  big_max: "assets/sounds/big_max.mp3",
  mult_land: "assets/sounds/mult_land.mp3",
} as const;
type Sample = keyof typeof SAMPLE_FILES;
const sampleBuffers = new Map<Sample, AudioBuffer>();
const samplePending = new Set<Sample>();

function loadSample(name: Sample) {
  if (sampleBuffers.has(name) || samplePending.has(name)) return;
  const c = ensureCtx();
  if (!c) return;
  samplePending.add(name);
  void (async () => {
    try {
      const res = await fetch(assetUrl(SAMPLE_FILES[name]));
      const buf = await c.decodeAudioData(await res.arrayBuffer());
      sampleBuffers.set(name, buf);
    } catch {
      /* stays on the synthesized fallback */
    } finally {
      samplePending.delete(name);
    }
  })();
}

function preloadSamples() {
  (Object.keys(SAMPLE_FILES) as Sample[]).forEach(loadSample);
}

/** Fire a decoded sample once. Returns false when it is not ready (caller uses the synth fallback).
 *  category "wins" registers the voice so the next win sting can replace it. */
function playSample(name: Sample, gain = 1, rate = 1, category?: "wins"): boolean {
  const c = ensureCtx();
  const buf = sampleBuffers.get(name);
  if (!c || !buf || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return false;
  if (category === "wins") stopWinVoices();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = Math.max(0.0001, sfxVol * masterVol * gain);
  src.connect(g);
  g.connect(c.destination);
  if (category === "wins") {
    activeWinVoices.add(src);
    src.onended = () => activeWinVoices.delete(src);
  }
  src.start();
  return true;
}

const dealBuffers = new Map<string, AudioBuffer>();

async function dealBuffer(name: "card_deal" | "card_deal_turbo"): Promise<AudioBuffer | null> {
  const cached = dealBuffers.get(name);
  if (cached) return cached;
  try {
    const res = await fetch(FILES[name]);
    const buf = await res.arrayBuffer();
    const ctx = ensureCtx();
    if (!ctx) return null;
    const decoded = await ctx.decodeAudioData(buf);
    dealBuffers.set(name, decoded);
    return decoded;
  } catch {
    return null;
  }
}

/** One shared reel-spin rumble for the whole spin (not per column). */
let reelSpinLoop: {
  osc: OscillatorNode;
  lfo: OscillatorNode | null;
  gain: GainNode;
  stopped: boolean;
} | null = null;

function startReelSpinLoopInternal() {
  stopReelSpinLoopInternal(0);
  const c = ensureCtx();
  if (!c || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
  const loopBuf = sampleBuffers.get("spin_loop");
  if (loopBuf) {
    // Riffling-deck loop (rendered sample) — seamless, replaces the synth rumble.
    const src = c.createBufferSource();
    src.buffer = loopBuf;
    src.loop = true;
    const gain = c.createGain();
    const vol = sfxVol * masterVol * 0.34;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), c.currentTime + 0.08);
    src.connect(gain);
    gain.connect(c.destination);
    src.start();
    reelSpinLoop = { osc: src as unknown as OscillatorNode, lfo: null, gain, stopped: false };
    return;
  }
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 48;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 160;
  filter.Q.value = 0.9;
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 9.5;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 28;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  const gain = c.createGain();
  const vol = sfxVol * masterVol * 0.11;
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), c.currentTime + 0.1);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  osc.start();
  lfo.start();
  reelSpinLoop = { osc, lfo, gain, stopped: false };
}

function stopReelSpinLoopInternal(fadeMs = 90) {
  const loop = reelSpinLoop;
  if (!loop || loop.stopped) {
    reelSpinLoop = null;
    return;
  }
  loop.stopped = true;
  reelSpinLoop = null;
  const c = audioCtx;
  const now = c?.currentTime ?? 0;
  try {
    loop.gain.gain.cancelScheduledValues(now);
    loop.gain.gain.setValueAtTime(Math.max(0.0001, loop.gain.gain.value), now);
    loop.gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.02, fadeMs / 1000));
  } catch {
    /* ignore */
  }
  window.setTimeout(() => {
    try {
      loop.osc.stop();
      loop.lfo?.stop();
    } catch {
      /* already stopped */
    }
  }, fadeMs + 30);
}

/** Rising "the bonus might drop" tension bed, held for the extra reel time. */
let anticipationVoice: { osc: OscillatorNode; lfo: OscillatorNode | null; gain: GainNode } | null = null;

function stopAnticipationInternal(fadeMs = 120) {
  const v = anticipationVoice;
  anticipationVoice = null;
  if (!v) return;
  const c = audioCtx;
  const now = c?.currentTime ?? 0;
  try {
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), now);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeMs / 1000);
  } catch {
    /* ignore */
  }
  window.setTimeout(() => {
    try {
      v.osc.stop();
      v.lfo?.stop();
    } catch {
      /* already stopped */
    }
  }, fadeMs + 40);
}

function playAnticipationInternal(durationMs: number) {
  stopAnticipationInternal(0);
  if (!audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
  const c = ensureCtx();
  if (!c) return;
  const sample = sampleBuffers.get("anticipation");
  if (sample) {
    // Rising heartbeat drone; the playback rate squeezes its build into the real hold time.
    const src = c.createBufferSource();
    src.buffer = sample;
    src.playbackRate.value = Math.min(2.2, Math.max(0.8, 3.0 / Math.max(0.6, durationMs / 1000)));
    const gain = c.createGain();
    gain.gain.value = Math.max(0.001, sfxVol * masterVol * 0.7);
    src.connect(gain);
    gain.connect(c.destination);
    src.start();
    anticipationVoice = { osc: src as unknown as OscillatorNode, lfo: null, gain };
    return;
  }
  const now = c.currentTime;
  const dur = Math.max(0.25, durationMs / 1000);
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(70, now);
  osc.frequency.exponentialRampToValueAtTime(260, now + dur);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(240, now);
  filter.frequency.exponentialRampToValueAtTime(1900, now + dur);
  filter.Q.value = 2.2;
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(3, now);
  lfo.frequency.linearRampToValueAtTime(13, now + dur);
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.04;
  const gain = c.createGain();
  const vol = sfxVol * masterVol * 0.16;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * 0.5), now + 0.12);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), now + dur);
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  lfo.start(now);
  anticipationVoice = { osc, lfo, gain };
}

function playReelStopInternal(col: number) {
  if (!audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
  const c = ensureCtx();
  if (!c) return;
  if (playSample(`reel_stop_${Math.min(4, Math.max(0, col))}` as Sample, 0.85)) return;
  const now = c.currentTime;
  const vol = sfxVol * masterVol;
  const f = 185 + col * 28;
  ding(c, f, now, 0.07, vol * 0.22, "triangle");
  ding(c, f * 0.5, now, 0.09, vol * 0.12, "sine");
  void dealBuffer("card_deal").then((buf) => {
    const ctx = ensureCtx();
    if (!buf || !ctx || masterMuted) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1.05 + col * 0.03;
    const g = ctx.createGain();
    g.gain.value = Math.max(0.001, vol * 0.38);
    src.connect(g);
    g.connect(ctx.destination);
    src.start(ctx.currentTime);
  });
}

// ——— Public audio API ———

export const audio = {
  unlock() {
    if (!canAudio()) return;
    unlocked = true;
    ensureCtx();
    // Warm deal buffers so the cascade isn't late on the first spin.
    void dealBuffer("card_deal");
    void dealBuffer("card_deal_turbo");
    preloadSamples();
    updateMusic();
  },
  isMasterMuted() {
    return masterMuted;
  },
  toggleMasterMute() {
    masterMuted = !masterMuted;
    // A persisted zero volume (slider saved at 0) gates every sound even after
    // unmuting — enabling sound must actually be audible, so restore defaults.
    if (!masterMuted) {
      if (masterVol <= 0) masterVol = 1;
      if (sfxVol <= 0) sfxVol = 0.55;
    }
    persistVols();
    if (!masterMuted) {
      unlocked = true;
      ensureCtx();
    }
    updateMusic();
    return masterMuted;
  },
  getMasterVolume() {
    return masterVol;
  },
  setMasterVolume(v: number) {
    masterVol = clamp01(v);
    persistVols();
    updateMusic();
  },
  getSfxVolume() {
    return sfxVol;
  },
  setSfxVolume(v: number) {
    sfxVol = clamp01(v);
    persistVols();
  },
  play(name: Sfx) {
    playSfx(name);
  },

  /** Bright lock-in sting for 3/4/5 golden cards. */
  playScatter(count: number) {
    if (!gate("bonus:scatter")) return;
    const c = ensureCtx();
    if (!c || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
    if (playSample("bonus_trigger", count >= 5 ? 1 : count >= 4 ? 0.92 : 0.85)) return;
    const n = count >= 5 ? 5 : count >= 4 ? 4 : 3;
    const hits = n === 5 ? [392, 494, 587, 698, 880] : n === 4 ? [392, 523, 659, 784] : [440, 554, 659];
    const vol = sfxVol * 0.42 * masterVol;
    const now = c.currentTime;
    hits.forEach((f, i) => {
      const t = now + i * 0.155;
      ding(c, f, t, 0.28, vol, "triangle");
      ding(c, f * 2.01, t, 0.16, vol * 0.22, "sine");
    });
    const resolve = now + hits.length * 0.155 + 0.04;
    const chord = n >= 5 ? [523, 659, 784, 1047] : n === 4 ? [523, 659, 784] : [440, 554, 659];
    for (const f of chord) ding(c, f, resolve, 0.62, vol * 0.26, "sine");
  },

  /**
   * The one win-sting, selected by winX ONLY (never by line count):
   *   <1x  → win_soft (pays less than the stake: a plucked note, no celebration)
   *   ≥15x → win_multi
   *   else → win_line
   * A new sting replaces the previous win voice instead of stacking.
   */
  playLineWin(spinWinX = 0) {
    if (!gate("wins:line")) return;
    const x = Number(spinWinX) || 0;
    if (x <= 0) return;
    const c = ensureCtx();
    if (!c || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
    if (x < 1) {
      if (playSample("win_soft", 0.85, 1, "wins")) return;
      const v = sfxVol * 0.2 * masterVol;
      ding(c, 523.25, c.currentTime, 0.14, v, "triangle");
      return;
    }
    const multi = x >= 15;
    if (playSample(multi ? "win_multi" : "win_line", 0.85, 1, "wins")) return;
    const vol = sfxVol * (multi ? 0.5 : 0.42) * masterVol;
    const base = multi ? 659.25 : 587.33;
    const now = c.currentTime;
    ding(c, base, now, 0.16, vol, "triangle");
    ding(c, base * 1.5, now + 0.07, 0.22, vol * 0.8, "triangle");
    ding(c, base * 2, now + 0.15, 0.42, vol * 0.55, "sine");
    ding(c, base * 3.01, now + 0.15, 0.2, vol * 0.16, "sine");
    if (multi) ding(c, base * 2.5, now + 0.24, 0.3, vol * 0.3, "sine");
  },

  /**
   * Big-win tier sting — escalates with the ladder
   * (nice → super → sensational → max). Replaces any running win voice
   * (the ladder never stacks on a line-win sting).
   */
  playBigWin(tier: "nice" | "super" | "sensational" | "max") {
    if (!gate("wins:big")) return;
    const c = ensureCtx();
    if (!c || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
    stopWinVoices();
    if (playSample(`big_${tier}` as Sample, 0.85, 1, "wins")) return;
    const now = c.currentTime;
    const vol = sfxVol * masterVol;
    if (tier === "nice") {
      const v = vol * 0.48;
      ding(c, 523.25, now, 0.22, v, "triangle");
      ding(c, 659.25, now + 0.08, 0.28, v * 0.85, "triangle");
      ding(c, 783.99, now + 0.18, 0.45, v * 0.55, "sine");
      return;
    }
    if (tier === "super") {
      const v = vol * 0.55;
      ding(c, 392, now, 0.18, v * 0.7, "triangle");
      ding(c, 523.25, now + 0.07, 0.22, v, "triangle");
      ding(c, 659.25, now + 0.14, 0.28, v * 0.9, "triangle");
      ding(c, 830.61, now + 0.24, 0.5, v * 0.5, "sine");
      ding(c, 1046.5, now + 0.28, 0.35, v * 0.22, "sine");
      return;
    }
    if (tier === "sensational") {
      const v = vol * 0.62;
      const hits = [440, 554, 659, 830, 988];
      hits.forEach((f, i) => {
        const t = now + i * 0.07;
        ding(c, f, t, 0.22, v * (0.55 + i * 0.08), "triangle");
        ding(c, f * 2.01, t, 0.14, v * 0.18, "sine");
      });
      const resolve = now + 0.42;
      for (const f of [523.25, 659.25, 783.99, 1046.5]) {
        ding(c, f, resolve, 0.7, v * 0.28, "sine");
      }
      return;
    }
    // max
    {
      const v = vol * 0.7;
      const hits = [349.23, 440, 523.25, 659.25, 783.99, 987.77];
      hits.forEach((f, i) => {
        const t = now + i * 0.085;
        ding(c, f, t, 0.26, v * (0.5 + i * 0.07), "triangle");
        ding(c, f * 2, t + 0.02, 0.16, v * 0.2, "sine");
      });
      const resolve = now + 0.58;
      for (const f of [523.25, 659.25, 783.99, 1046.5, 1318.5]) {
        ding(c, f, resolve, 0.95, v * 0.3, "sine");
      }
      ding(c, 1568, resolve + 0.05, 0.55, v * 0.18, "sine");
    }
  },

  /**
   * Start the shared reel_spin_loop (once per spin). Column stop SFX are
   * fired from playReelStop when each reel snaps — not scheduled here.
   */
  playDealCascade(_delaysMs: number[], _turbo: boolean) {
    startReelSpinLoopInternal();
  },

  /** Alias — begin the looping spin rumble. */
  startReelSpinLoop() {
    startReelSpinLoopInternal();
  },

  /** Fade out reel_spin_loop (call when the last column snaps). */
  playAnticipation(durationMs: number) {
    playAnticipationInternal(durationMs);
  },

  stopAnticipation() {
    stopAnticipationInternal();
  },

  stopReelSpinLoop(fadeMs = 90) {
    stopReelSpinLoopInternal(fadeMs);
  },

  /** A joker (bonus card) has just landed: heavy toll + gold glint. */
  playJokerLand() {
    if (!gate("bonus:joker")) return;
    if (playSample("joker_land", 0.9)) return;
    const c = ensureCtx();
    if (!c || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
    const now = c.currentTime;
    const vol = sfxVol * masterVol;
    ding(c, 110, now, 0.9, vol * 0.4, "sine");
    ding(c, 880, now + 0.05, 0.4, vol * 0.18, "triangle");
  },

  /** A 10–20× line win (below the Big Win ladder): a lighter fanfare. */
  playMidWin(spinWinX: number) {
    if (spinWinX < 10 || spinWinX >= 20) return;
    if (!gate("wins:mid")) return;
    stopWinVoices();
    playSample("big_nice", 0.7, 1, "wins");
  },

  /** A multiplier chip lands on the board. */
  playMultLand() {
    if (!gate("bonus:mult")) return;
    playSample("mult_land", 0.7);
  },

  /** Short reel_stop — must be called from the column snap callback. */
  playReelStop(col: number) {
    if (!gate(`reels:stop${col}`)) return;
    playReelStopInternal(col);
  },
};
