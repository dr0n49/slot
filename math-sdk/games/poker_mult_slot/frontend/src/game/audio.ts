/** Casino audio — SFX WAV pack. No music bed, no thunder: deal + UI + stings only. */

import { assetUrl } from "./assets";

const FILES = {
  button_click: assetUrl("assets/sounds/button_click.wav"),
  card_deal: assetUrl("assets/sounds/card_deal.wav"),
  card_deal_turbo: assetUrl("assets/sounds/card_deal_turbo.wav"),
} as const;

const MUSIC_FILE = assetUrl("assets/sounds/music_muerta.wav");
/** Background loop sits well below SFX so the mix has space for game sounds. */
const MUSIC_LEVEL = 0.42;

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
let sfxVol = loadVol("sfx", 0.7);
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

function ensureMusic() {
  if (!musicEl) {
    musicEl = new Audio(MUSIC_FILE);
    musicEl.loop = true; // the WAV is a sample-exact seamless loop
    musicEl.preload = "auto";
  }
  return musicEl;
}

function updateMusic() {
  if (!unlocked) return;
  const el = ensureMusic();
  el.volume = clamp01(MUSIC_LEVEL * masterVol);
  if (audioEnabled()) {
    if (el.paused) void el.play().catch(() => {});
  } else if (!el.paused) {
    el.pause();
  }
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
  if (!audioEnabled()) return;
  if (sfxVol <= 0 || masterVol <= 0) return;
  let list = pool.get(name);
  if (!list) {
    list = [];
    pool.set(name, list);
  }
  let el = list.find((a) => a.paused);
  if (!el) {
    el = new Audio(FILES[name]);
    el.preload = "auto";
    list.push(el);
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
  lfo: OscillatorNode;
  gain: GainNode;
  stopped: boolean;
} | null = null;

function startReelSpinLoopInternal() {
  stopReelSpinLoopInternal(0);
  const c = ensureCtx();
  if (!c || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
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
      loop.lfo.stop();
    } catch {
      /* already stopped */
    }
  }, fadeMs + 30);
}

/** Rising "the bonus might drop" tension bed, held for the extra reel time. */
let anticipationVoice: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;

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
      v.lfo.stop();
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
      if (sfxVol <= 0) sfxVol = 0.7;
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
    const c = ensureCtx();
    if (!c || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
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

  /** One clear "lines paid" hit, timed with the card-win reveal. */
  playLineWin(lines = 1) {
    const c = ensureCtx();
    if (!c || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
    const multi = lines >= 3;
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
   * (nice → super → sensational → max).
   */
  playBigWin(tier: "nice" | "super" | "sensational" | "max") {
    const c = ensureCtx();
    if (!c || !audioEnabled() || sfxVol <= 0 || masterVol <= 0) return;
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

  /** Short reel_stop — must be called from the column snap callback. */
  playReelStop(col: number) {
    playReelStopInternal(col);
  },
};
