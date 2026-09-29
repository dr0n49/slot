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
/** Background loop sits clearly below SFX but alive on phone speakers:
 *  music_muerta.wav is normalized to -22 LUFS (see scripts/normalize_audio.sh);
 *  at ×0.68 the bed plays at ≈ -25.5 LUFS effective. Clearance during wins now
 *  comes from the REAL ducking node below (C5: 5-6 dB, attack 100 ms, release
 *  350 ms), not from burying the bed. */
const MUSIC_LEVEL = 0.68;
/** C5 music ducking: −5.5 dB under win / joker-focus / bonus-transition cues. */
const DUCK_FACTOR = 0.53;
const DUCK_ATTACK_S = 0.1;
const DUCK_RELEASE_S = 0.35;
let musicDucked = false;
let duckReleaseTimer = 0;

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
/** Session-only mute (hidden tab): NEVER persisted, NEVER touches the user's
 *  mute state or the HUD speaker icon. Undone on visibilitychange. */
let tempMuted = false;
let audioCtx: AudioContext | null = null;
/** C5: persistent buses. Every WebAudio voice connects to sfxGain → masterGain
 *  → destination, so mute (≈40 ms ramp) and volume changes reach voices that
 *  are ALREADY playing — tested by muting mid big-win sting. */
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
const pool = new Map<Sfx, HTMLAudioElement[]>();
let musicEl: HTMLAudioElement | null = null;

// ——— Retrigger guard + per-category voice limits ———
// The SAME event twice within 50 ms is ignored (rapid clicking, or any
// future React/Godot overlap, must never flange a hit against itself).
// Wins are capped at ONE voice: a new win/big-win sting stops the previous
// one instead of stacking on top of it. UI is capped at 2 voices.
const RETRIGGER_MS = 50;
const lastTriggerAt = new Map<string, number>();
/** Active win-category voices with their gain nodes, so a replacing sting
 *  fades the previous one out over ~40 ms instead of hard-stopping it (click).
 *  src is anything stoppable (buffer source or oscillator) — synthesized
 *  fallback cues register their first oscillator. */
const activeWinVoices = new Set<{ src: { stop: (when?: number) => void }; gain: GainNode }>();

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
  const c = audioCtx;
  const now = c?.currentTime ?? 0;
  for (const v of activeWinVoices) {
    try {
      // 40 ms exponential fade, then a stop 10 ms past the tail — no click.
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), now);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      v.src.stop(now + 0.05);
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
  const base = on ? clamp01(MUSIC_LEVEL * masterVol) : 0;
  // C5: the bed ducks 5.5 dB under win / joker-focus / bonus cues — attack
  // 100 ms in, release 350 ms back (a muted bed never ducks).
  const target = on ? base * (musicDucked ? DUCK_FACTOR : 1) : 0;
  const tc = !on ? 0.05 : musicDucked ? DUCK_ATTACK_S / 3 : DUCK_RELEASE_S / 3;
  // Short glide — no zipper noise on the volume slider, no click on mute.
  musicGain.gain.cancelScheduledValues(c.currentTime);
  musicGain.gain.setTargetAtTime(target, c.currentTime, tc);

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

/** C5: duck the music bed while a foreground reward cue plays. The release is
 *  scheduled for the cue's own tail AND can be forced early (skip/cancel) via
 *  releaseDuck(). */
function duckForCue(durationMs: number) {
  duckMusic(true);
  window.clearTimeout(duckReleaseTimer);
  duckReleaseTimer = window.setTimeout(() => duckMusic(false), durationMs);
}

function duckMusic(on: boolean) {
  if (musicDucked === on) return;
  musicDucked = on;
  updateMusic();
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

/** Lazily created WebAudio context (needs a user gesture before it will run). */
function ensureCtx() {
  if (!canAudio() || !unlocked) return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    sfxGain = audioCtx.createGain();
    sfxGain.connect(masterGain);
    applyVoiceGains();
  }
  if (audioCtx.state === "suspended") void audioCtx.resume().catch(() => {});
  return audioCtx;
}

/** C5: live gain application — the bus gains (and the HTMLAudio pool volumes)
 *  follow mute/volume changes in real time. setTargetAtTime tc 0.02 ≈ a
 *  40 ms ramp: no click, fast enough for a mid-sting mute test. */
function applyVoiceGains() {
  const c = audioCtx;
  if (!c || !masterGain || !sfxGain) return;
  const now = c.currentTime;
  const mv = (masterMuted || tempMuted) ? 0.0001 : Math.max(0.0001, masterVol);
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setTargetAtTime(mv, now, 0.02);
  sfxGain.gain.cancelScheduledValues(now);
  sfxGain.gain.setTargetAtTime(Math.max(0.0001, sfxVol), now, 0.02);
  updateUiGains();
}

/** HTMLAudio UI cues can't join the WebAudio bus — their per-element volume
 *  is recomputed here on every mute/volume change instead. */
function updateUiGains() {
  const silent = masterMuted || tempMuted;
  for (const list of pool.values()) {
    for (const el of list) {
      const g = (el as HTMLAudioElement & { __gain?: number }).__gain ?? 1;
      el.volume = silent ? 0 : clamp01(sfxVol * g * masterVol);
    }
  }
}

function audioEnabled() {
  return canAudio() && unlocked && !masterMuted && !tempMuted;
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
  (el as HTMLAudioElement & { __gain?: number }).__gain = gain;
  el.volume = clamp01(sfxVol * gain * masterVol);
  // ±3 % random pitch so a burst of clicks never sounds machine-gunned.
  el.playbackRate = 0.97 + Math.random() * 0.06;
  el.currentTime = 0;
  void el.play().catch(() => {});
}

// ——— WebAudio stings + deal cascade ———

/** Short bell partial used by the win/scatter stings. dest defaults to the
 *  SFX bus (C5) so mute/volume changes reach the partial live; win stings
 *  pass a shared cue gain so the whole synthesized cue lives under one
 *  cancelable voice (same policy as sampled stings). */
function ding(
  c: AudioContext,
  freq: number,
  t0: number,
  dur: number,
  gain: number,
  type: OscillatorType,
  dest?: AudioNode,
): OscillatorNode {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t0 + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(dest ?? sfxGain ?? c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
  return o;
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
 *  category "wins" registers the voice so the next win sting can replace it.
 *  The per-voice gain is RELATIVE — sfxVol/masterVol live on the C5 buses. */
function playSample(name: Sample, gain = 1, rate = 1, category?: "wins"): boolean {
  const c = ensureCtx();
  const buf = sampleBuffers.get(name);
  if (!c || !buf || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return false;
  if (category === "wins") stopWinVoices();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = Math.max(0.0001, gain);
  src.connect(g);
  g.connect(sfxGain ?? c.destination);
  if (category === "wins") {
    const voice = { src, gain: g };
    activeWinVoices.add(voice);
    src.onended = () => activeWinVoices.delete(voice);
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
    const vol = 0.34;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), c.currentTime + 0.08);
    src.connect(gain);
    gain.connect(sfxGain ?? c.destination);
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
  const vol = 0.11;
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), c.currentTime + 0.1);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain ?? c.destination);
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
    gain.gain.value = Math.max(0.001, 0.7);
    src.connect(gain);
    gain.connect(sfxGain ?? c.destination);
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
  const vol = 0.16;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * 0.5), now + 0.12);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), now + dur);
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain ?? c.destination);
  osc.start(now);
  lfo.start(now);
  anticipationVoice = { osc, lfo, gain };
}

function playReelStopInternal(col: number) {
  if (!audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
  const c = ensureCtx();
  if (!c) return;
  // ±3-4 % pitch: five columns stopping in a row must not read as one sample.
  if (playSample(`reel_stop_${Math.min(4, Math.max(0, col))}` as Sample, 0.85, 0.96 + Math.random() * 0.08)) return;
  const now = c.currentTime;
  const vol = 1; // relative — the C5 bus carries sfxVol × masterVol
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
    g.gain.value = Math.max(0.001, 0.38);
    src.connect(g);
    g.connect(sfxGain ?? ctx.destination);
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
  /** Session-only silence for the hidden-tab pause. Not persisted, not shown
   *  on the speaker icon, forgotten the moment the tab is visible again. */
  setTempMuted(v: boolean) {
    if (tempMuted === v) return;
    tempMuted = v;
    applyVoiceGains();
    updateMusic();
  },
  /** C5: end the music duck early — skip/cancel of the cue that started it. */
  releaseDuck() {
    window.clearTimeout(duckReleaseTimer);
    duckMusic(false);
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
    applyVoiceGains();
    updateMusic();
    return masterMuted;
  },
  getMasterVolume() {
    return masterVol;
  },
  setMasterVolume(v: number) {
    masterVol = clamp01(v);
    persistVols();
    applyVoiceGains();
    updateMusic();
  },
  getSfxVolume() {
    return sfxVol;
  },
  setSfxVolume(v: number) {
    sfxVol = clamp01(v);
    persistVols();
    applyVoiceGains();
  },
  play(name: Sfx) {
    playSfx(name);
  },

  /** Bright lock-in sting for 3/4/5 golden cards. */
  playScatter(count: number) {
    if (!gate("bonus:scatter")) return;
    duckForCue(1600);
    const c = ensureCtx();
    if (!c || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
    if (playSample("bonus_trigger", count >= 5 ? 1 : count >= 4 ? 0.92 : 0.85)) return;
    const n = count >= 5 ? 5 : count >= 4 ? 4 : 3;
    const hits = n === 5 ? [392, 494, 587, 698, 880] : n === 4 ? [392, 523, 659, 784] : [440, 554, 659];
    const vol = 0.42;
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
   * The synthesized fallback runs through ONE cue gain registered as a win
   * voice, so the replacement policy covers it too (C7).
   */
  playLineWin(spinWinX = 0) {
    if (!gate("wins:line")) return;
    const x = Number(spinWinX) || 0;
    if (x <= 0) return;
    duckForCue(x < 1 ? 1200 : 2200);
    const c = ensureCtx();
    if (!c || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
    if (x < 1) {
      if (playSample("win_soft", 0.85, 1, "wins")) return;
      stopWinVoices();
      const cue = c.createGain();
      cue.gain.value = 1;
      cue.connect(c.destination);
      // One voice for the cue: a replacing sting fades the cue gain (no
      // click), exactly like it fades a sampled sting.
      const o = ding(c, 523.25, c.currentTime, 0.14, 0.2, "triangle", cue);
      const voice = { src: o, gain: cue };
      activeWinVoices.add(voice);
      o.onended = () => activeWinVoices.delete(voice);
      return;
    }
    const multi = x >= 15;
    if (playSample(multi ? "win_multi" : "win_line", 0.85, 1, "wins")) return;
    stopWinVoices();
    const vol = multi ? 0.5 : 0.42;
    const base = multi ? 659.25 : 587.33;
    const now = c.currentTime;
    const cue = c.createGain();
    cue.gain.value = 1;
    cue.connect(c.destination);
    const first = ding(c, base, now, 0.16, vol, "triangle", cue);
    const voice = { src: first, gain: cue };
    activeWinVoices.add(voice);
    first.onended = () => activeWinVoices.delete(voice);
    ding(c, base * 1.5, now + 0.07, 0.22, vol * 0.8, "triangle", cue);
    ding(c, base * 2, now + 0.15, 0.42, vol * 0.55, "sine", cue);
    ding(c, base * 3.01, now + 0.15, 0.2, vol * 0.16, "sine", cue);
    if (multi) ding(c, base * 2.5, now + 0.24, 0.3, vol * 0.3, "sine", cue);
  },

  /**
   * Big-win tier sting — escalates with the ladder
   * (nice → super → sensational → max). Replaces any running win voice
   * (the ladder never stacks on a line-win sting).
   *
   * C7 per-tier gains: the samples ship at different loudnesses (measured
   * integrated LUFS: nice −13.1, super −15.0, sensational −14.5, max −14.5),
   * which made SUPER ~2 dB QUIETER than NICE. These gains make the ladder
   * monotonic (−16.0 → −14.7 → −14.5 → −14.3 effective LUFS at unity master)
   * while keeping each file's true peak ≤ −1.2 dBFS (file peaks: −1.3 / −1.5
   * / −1.5 / −1.4 + gain).
   */
  playBigWin(tier: "nice" | "super" | "sensational" | "max") {
    if (!gate("wins:big")) return;
    duckForCue(6000);
    const c = ensureCtx();
    if (!c || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
    stopWinVoices();
    const TIER_GAIN = { nice: 0.72, super: 1.035, sensational: 1.035, max: 1.023 } as const;
    if (playSample(`big_${tier}` as Sample, TIER_GAIN[tier], 1, "wins")) return;
    // Synthesized fallback: same one-voice/cancellation policy as sampled
    // stings (C7) — every partial runs through one registered cue gain.
    const now = c.currentTime;
    const cue = c.createGain();
    cue.gain.value = 1;
    cue.connect(c.destination);
    const vol = 1; // relative — the C5 bus carries sfxVol × masterVol
    const first = ding(c, 523.25, now, 0.22, vol * 0.35, "triangle", cue);
    const voice = { src: first, gain: cue };
    activeWinVoices.add(voice);
    first.onended = () => activeWinVoices.delete(voice);
    if (tier === "nice") {
      ding(c, 659.25, now + 0.08, 0.28, vol * 0.3, "triangle", cue);
      ding(c, 783.99, now + 0.18, 0.45, vol * 0.19, "sine", cue);
      return;
    }
    if (tier === "super") {
      ding(c, 392, now, 0.18, vol * 0.24, "triangle", cue);
      ding(c, 523.25, now + 0.07, 0.22, vol * 0.35, "triangle", cue);
      ding(c, 659.25, now + 0.14, 0.28, vol * 0.31, "triangle", cue);
      ding(c, 830.61, now + 0.24, 0.5, vol * 0.17, "sine", cue);
      ding(c, 1046.5, now + 0.28, 0.35, vol * 0.08, "sine", cue);
      return;
    }
    if (tier === "sensational") {
      const v = vol * 0.62;
      const hits = [440, 554, 659, 830, 988];
      hits.forEach((f, i) => {
        const t = now + i * 0.07;
        ding(c, f, t, 0.22, v * (0.55 + i * 0.08), "triangle", cue);
        ding(c, f * 2.01, t, 0.14, v * 0.18, "sine", cue);
      });
      const resolve = now + 0.42;
      for (const f of [523.25, 659.25, 783.99, 1046.5]) {
        ding(c, f, resolve, 0.7, v * 0.28, "sine", cue);
      }
      return;
    }
    // max
    {
      const v = vol * 0.7;
      const hits = [349.23, 440, 523.25, 659.25, 783.99, 987.77];
      hits.forEach((f, i) => {
        const t = now + i * 0.085;
        ding(c, f, t, 0.26, v * (0.5 + i * 0.07), "triangle", cue);
        ding(c, f * 2, t + 0.02, 0.16, v * 0.2, "sine", cue);
      });
      const resolve = now + 0.58;
      for (const f of [523.25, 659.25, 783.99, 1046.5, 1318.5]) {
        ding(c, f, resolve, 0.95, v * 0.3, "sine", cue);
      }
      ding(c, 1568, resolve + 0.05, 0.55, v * 0.18, "sine", cue);
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
    // Joker-focus build-up: the bed ducks under the riser and releases when
    // the build-up ends (Godot's anticipation-off → stopAnticipation).
    duckForCue(Math.max(600, durationMs + 400));
    playAnticipationInternal(durationMs);
  },

  stopAnticipation() {
    stopAnticipationInternal();
    duckMusic(false);
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

/** DEV-ONLY verification accessor (import.meta.env.DEV): current bus gains,
 *  duck state and active win voices — lets an automated run prove that mute
 *  and the duck actually reach already-playing voices. Returns null in prod. */
export function debugAudioBuses():
  | { master: number; sfx: number; music: number; ducked: boolean; winVoices: number }
  | null {
  if (!import.meta.env.DEV) return null;
  if (!audioCtx || !masterGain || !sfxGain) return null;
  return {
    master: masterGain.gain.value,
    sfx: sfxGain.gain.value,
    music: musicGain ? musicGain.gain.value : -1,
    ducked: musicDucked,
    winVoices: activeWinVoices.size,
  };
}
