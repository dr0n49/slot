/** Original recorded music/effects. Local assets only; no generation credentials in the client. */
import { AudioSettings, type AudioBus } from "./audioSettings";

let store: Storage | undefined;
try { store = localStorage; } catch { /* Private/restricted storage. */ }
const settings = new AudioSettings(store, new URLSearchParams(location.search).has("mute"));
export const volumes = () => settings.snapshot();

const ASSETS = "./audio/v9/";
type Scene = "base" | "bonus";
/** `duck`: ms the music dips under this cue; `depth`: music level while it dips (default 0.56, about -5 dB). */
type Cue = { file: string; gain: number; cooldown: number; voices: number; duck?: number; depth?: number };
/** Music slider and scene crossfades feed the same bus; cue-specific ducking follows it. */
// Music files are mastered at -22 LUFS. At the default slider (0.7) the bed plays near -27 LUFS, about 1-2 dB
// under the effects (1.0.37 played it near -34 LUFS: a reviewer heard no music at all).
const MUSIC_TRIM = 0.9;
const CUES: Record<string, Cue> = {
  click: { file: "ui_click_v9", gain: 0.8, cooldown: 70, voices: 2 },
  spin: { file: "spin_v9", gain: 0.9, cooldown: 150, voices: 1 },
  drop: { file: "land_v9", gain: 0.7, cooldown: 70, voices: 2 },
  land: { file: "land_v9", gain: 0.45, cooldown: 55, voices: 2 }, // one soft touch-down per column
  pop: { file: "pop_v9", gain: 0.72, cooldown: 120, voices: 2 },
  win: { file: "cluster_win_v9", gain: 0.85, cooldown: 260, voices: 2, duck: 900, depth: 0.72 },
  halo: { file: "scatter_v9", gain: 0.9, cooldown: 100, voices: 2 },
  anticipation: { file: "anticipation_v9", gain: 0.7, cooldown: 1000, voices: 1 },
  bank: { file: "bank_v9", gain: 0.8, cooldown: 100, voices: 2 },
  unlock: { file: "unlock_v9", gain: 0.85, cooldown: 180, voices: 2 },
  plusone: { file: "extra_spin_v9", gain: 0.9, cooldown: 300, voices: 1 },
  trigger: { file: "trigger_v9", gain: 0.95, cooldown: 900, voices: 1, duck: 3200 },
  transition: { file: "transition_v9", gain: 1.2, cooldown: 500, voices: 1 },
  enter: { file: "trigger_v9", gain: 0.95, cooldown: 900, voices: 1, duck: 2600 }, // the player steps from the intro card into the bonus
  chest: { file: "lotus_open_v9", gain: 0.9, cooldown: 300, voices: 2 },
  multiply: { file: "multiply_v9", gain: 0.9, cooldown: 700, voices: 1, duck: 2200 },
  feature: { file: "feature_v9", gain: 0.9, cooldown: 900, voices: 1, duck: 4200 },
  mystery: { file: "feature_v9", gain: 0.8, cooldown: 900, voices: 1, duck: 2400 },
  countEnd: { file: "count_end", gain: 0.85, cooldown: 0, voices: 1 },
  summary: { file: "summary_v9", gain: 0.95, cooldown: 1000, voices: 1, duck: 5200 },
  bigwin: { file: "bigwin_v9", gain: 0.95, cooldown: 1000, voices: 1, duck: 5200 },
  maxwin: { file: "maxwin_v9", gain: 0.95, cooldown: 1000, voices: 1, duck: 7200 },
};

type Track = { source: AudioBufferSourceNode; gain: GainNode; startedAt: number; pauseTimer?: ReturnType<typeof setTimeout> };
type Voice = { name: string; source: AudioBufferSourceNode; gain: GainNode };
let ctx: AudioContext | null = null;
let fxGain: GainNode;
let musicGain: GainNode;
let duckGain: GainNode;
let masterGain: GainNode;
let musicRequested = false;
let scene: Scene = "base";
let lifecycleBound = false;
const lifecycleAbort = new AbortController();
let duckUntil = 0;
let duckTimer: ReturnType<typeof setTimeout> | undefined;
let variation = 0;
let effectEpoch = 0;
const tracks = new Map<Scene, Track>();
const voices = new Set<Voice>();
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const lastPlayed = new Map<string, number>();
const repeats = new Map<string, number>();

function stopVoice(v: Voice) {
  try {
    if (ctx) { v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01); v.source.stop(ctx.currentTime + 0.06); }
    else v.source.stop();
  } catch { /* Already ended. */ }
  voices.delete(v);
}
let cancelCount: (() => void) | undefined;
function stopEffects() { cancelCount?.(); effectEpoch++; for (const v of [...voices]) stopVoice(v); }
const offsets: Record<Scene, number> = { base: 0, bonus: 0 };
function pauseTrack(which: Scene, track: Track) {
  clearTimeout(track.pauseTimer);
  if (tracks.get(which) !== track) return;
  offsets[which] = (track.source.context.currentTime - track.startedAt) % track.source.buffer!.duration;
  track.source.stop();
  track.source.disconnect();
  track.gain.disconnect();
  tracks.delete(which);
  // Only the current scene needs a decoded music buffer after the crossfade.
  buffers.delete(`music_${which}_v9`);
}
function pauseTracks() {
  for (const [which, track] of tracks) pauseTrack(which, track);
}
function resume() {
  if (document.hidden) return;
  if (musicRequested) startMusic();
}
function bindLifecycle() {
  if (lifecycleBound) return;
  lifecycleBound = true;
  const suspend = () => {
    pauseTracks(); stopEffects();
    if (ctx?.state === "running") void ctx.suspend().catch(() => {});
  };
  document.addEventListener("visibilitychange", () => document.hidden ? suspend() : resume(), { signal: lifecycleAbort.signal });
  window.addEventListener("pagehide", suspend, { signal: lifecycleAbort.signal });
  window.addEventListener("pageshow", resume, { signal: lifecycleAbort.signal });
  const recover = () => {
    if (musicRequested && (ctx?.state !== "running" || (volumes().music > 0 && !tracks.has(scene)))) resume();
  };
  window.addEventListener("pointerup", recover, { signal: lifecycleAbort.signal });
  window.addEventListener("keydown", recover, { signal: lifecycleAbort.signal });
}
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      try { if (session) session.type = "playback"; } catch { /* Optional in embedded browsers. */ }
      ctx = new AudioContext();
      masterGain = ctx.createGain(); masterGain.gain.value = 0.9;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -4; limiter.knee.value = 4; limiter.ratio.value = 12;
      limiter.attack.value = 0.003; limiter.release.value = 0.15;
      masterGain.connect(limiter).connect(ctx.destination);
      fxGain = ctx.createGain(); fxGain.gain.value = volumes().fx; fxGain.connect(masterGain);
      musicGain = ctx.createGain(); musicGain.gain.value = volumes().music * MUSIC_TRIM;
      duckGain = ctx.createGain(); duckGain.gain.value = 1;
      musicGain.connect(duckGain).connect(masterGain);
      bindLifecycle();
    }
    if (!document.hidden && ctx.state !== "running" && ctx.state !== "closed") void ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}
function level(bus: AudioBus, value: number) {
  const v = settings.set(bus, value);
  if (bus === "fx") {
    if (ctx && fxGain) fxGain.gain.setTargetAtTime(v, ctx.currentTime, 0.015);
    if (!v) {
      stopEffects(); clearTimeout(duckTimer); duckUntil = 0;
      if (ctx && duckGain) duckGain.gain.setTargetAtTime(1, ctx.currentTime, 0.1);
    }
    else if (musicRequested) { audio(); preloadEffects(); }
  } else {
    if (ctx && musicGain) musicGain.gain.setTargetAtTime(v * MUSIC_TRIM, ctx.currentTime, 0.08);
    if (v > 0) startMusic(); else pauseTracks();
  }
}
export function setFxVolume(v: number) { level("fx", v); }
export function setMusicVolume(v: number) { level("music", v); }
export function toggleFx() { const v = settings.toggle("fx"); level("fx", v); }
export function toggleMusic() { const v = settings.toggle("music"); level("music", v); }

function loadEffect(file: string, decoder?: BaseAudioContext): Promise<AudioBuffer | null> {
  if (!buffers.has(file)) {
    const c = decoder ?? audio();
    if (!c) return Promise.resolve(null);
    buffers.set(file, fetch(`${ASSETS}${file}.mp3`)
      .then((r) => { if (!r.ok) throw Error("Sound asset unavailable"); return r.arrayBuffer(); })
      .then((b) => c.decodeAudioData(b))
      .catch(() => { buffers.delete(file); console.warn("Sound asset unavailable:", file); return null; }));
  }
  return buffers.get(file)!;
}
/** Decode both counter sounds while the splash artwork loads. Offline decoding
 * needs no audio gesture, and even a short first count can start on its first beat. */
export function warmCountSounds() {
  if (volumes().fx <= 0 || typeof OfflineAudioContext === "undefined") return;
  try {
    const decoder = new OfflineAudioContext(1, 1, 44100);
    void loadEffect("count_tick", decoder);
    void loadEffect(CUES.countEnd.file, decoder);
  } catch { /* The normal effects preload retries on the first user gesture. */ }
}
function preloadEffects() {
  if (volumes().fx <= 0 || document.hidden) return;
  for (const file of new Set(["count_tick", ...Object.values(CUES).map((cue) => cue.file)])) void loadEffect(file);
}
let duckDepth = 1;
function duckMusic(ms: number, depth = 0.56) {
  if (!ctx || !duckGain) return;
  // A deeper dip already running is not lifted by a lighter one.
  if (performance.now() >= duckUntil) duckDepth = 1;
  duckDepth = Math.min(duckDepth, depth);
  duckUntil = Math.max(duckUntil, performance.now() + ms);
  duckGain.gain.setTargetAtTime(duckDepth, ctx.currentTime, 0.12);
  clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    if (ctx) duckGain.gain.setTargetAtTime(1, ctx.currentTime, 0.45);
  }, Math.max(0, duckUntil - performance.now()));
}
/** Schedule the short Total Win sequence on the audio clock. A slow WebGL frame
 * can skip a displayed number without dropping a tick or shifting its pitch. */
export function startCountTicks(startMs: number, durationMs: number) {
  cancelCount?.();
  const c = volumes().fx > 0 && !document.hidden ? audio() : null;
  if (!c) return () => {};
  const bus = c.createGain();
  bus.gain.value = 0.55;
  bus.connect(fxGain);
  const sources = new Set<AudioBufferSourceNode>();
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelCount = undefined;
    bus.gain.setTargetAtTime(0, c.currentTime, 0.003);
    for (const source of sources) source.stop(c.currentTime + 0.012);
    if (!sources.size) bus.disconnect();
  };
  cancelCount = stop;
  void loadEffect("count_tick").then((buffer) => {
    if (stopped || !buffer) return;
    const start = c.currentTime + (startMs - performance.now()) / 1000;
    const count = Math.ceil(durationMs / 85);
    const first = Math.max(0, Math.ceil((c.currentTime - start - 0.02) / 0.085));
    for (let i = first; i < count; i++) {
      const when = start + 0.085 * i;
      const source = c.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 2 ** (7 * (i - first) / (12 * Math.max(1, count - first - 1)));
      source.connect(bus);
      sources.add(source);
      source.onended = () => {
        sources.delete(source);
        source.disconnect();
        if (stopped && !sources.size) bus.disconnect();
      };
      source.start(Math.max(c.currentTime, when));
    }
  });
  return stop;
}

export function sound(name: string) {
  const cue = CUES[name];
  if (!cue || volumes().fx <= 0 || document.hidden) return;
  const c = audio(); if (!c) return;
  if (name === "spin") {
    stopEffects(); clearTimeout(duckTimer); duckUntil = 0;
    duckGain.gain.setTargetAtTime(1, c.currentTime, 0.1);
  } else if (name === "transition") {
    for (const v of [...voices]) if (["summary", "bigwin", "maxwin"].includes(v.name)) stopVoice(v);
    clearTimeout(duckTimer); duckUntil = 0; duckGain.gain.setTargetAtTime(1, c.currentTime, 0.1);
  }
  const requested = performance.now(), epoch = effectEpoch;
  const since = requested - (lastPlayed.get(name) ?? -Infinity);
  if (since < cue.cooldown) return;
  lastPlayed.set(name, requested);
  // Quick repeats (cascades, column landings) step down so a chain never piles up into a loud wash.
  const run = since < 700 ? Math.min(4, (repeats.get(name) ?? 0) + 1) : 0;
  repeats.set(name, run);
  const level = cue.gain * Math.pow(0.85, run);
  void loadEffect(cue.file).then((buffer) => {
    if (epoch !== effectEpoch || !buffer || volumes().fx <= 0 || document.hidden || performance.now() - requested > 1000) return;
    const same = [...voices].filter((v) => v.name === name);
    while (same.length >= cue.voices) stopVoice(same.shift()!);
    while (voices.size >= 10) stopVoice(voices.values().next().value!);
    const source = c.createBufferSource(), gain = c.createGain(); source.buffer = buffer;
    // A 6 ms fade-in: no click at the start of a cue.
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(level, c.currentTime + 0.006);
    if (name === "drop" || name === "land" || name === "pop") source.playbackRate.value = [0.98, 1, 1.02, 1.01][variation++ % 4];
    source.connect(gain).connect(fxGain);
    const v: Voice = { name, source, gain }; voices.add(v);
    source.onended = () => { voices.delete(v); source.disconnect(); gain.disconnect(); };
    if (cue.duck) duckMusic(cue.duck, cue.depth);
    source.start();
  });
}
/** Both scenes use the context unlocked by Start, including in an embedded game. A later bonus
 * never needs permission to start a second media element. Keep the outgoing loop playing until
 * the incoming file has decoded, then fade between them on the same audio clock. */
function playScene(which: Scene, c: AudioContext, buffer: AudioBuffer) {
  if (ctx !== c || scene !== which || !musicRequested || document.hidden || !volumes().music) return;
  if (!tracks.has(which)) {
    const source = c.createBufferSource(), gain = c.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain).connect(musicGain);
    const offset = offsets[which] % buffer.duration;
    source.start(0, offset);
    tracks.set(which, { source, gain, startedAt: c.currentTime - offset });
  }
  for (const [name, track] of tracks) {
    clearTimeout(track.pauseTimer);
    track.gain.gain.cancelScheduledValues(c.currentTime);
    track.gain.gain.setTargetAtTime(name === which ? 1 : 0, c.currentTime, 0.3);
    if (name !== which) track.pauseTimer = setTimeout(() => pauseTrack(name, track), 1400);
  }
}
export function startMusic() {
  musicRequested = true;
  if (document.hidden) return;
  // resume() is called synchronously from the splash/button gesture, before any fetch or await.
  if (!volumes().music && !volumes().fx) return;
  const c = audio();
  if (!c) return;
  const which = scene;
  if (volumes().music > 0) {
    void loadEffect(`music_${which}_v9`, c).then((buffer) => {
      if (buffer) playScene(which, c, buffer);
      if (which !== scene && !tracks.has(which)) buffers.delete(`music_${which}_v9`);
    });
  }
  preloadEffects();
}
export function setMusicScene(next: Scene) {
  if (scene === next) return;
  scene = next;
  if (musicRequested) startMusic();
}

if (import.meta.hot) import.meta.hot.dispose(() => {
  musicRequested = false; lifecycleAbort.abort(); pauseTracks(); stopEffects(); clearTimeout(duckTimer);
  if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
});
