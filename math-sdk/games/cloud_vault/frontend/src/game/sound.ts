/**
 * Synthesized sound (WebAudio) until real audio is produced: effects plus a soft ambient
 * music loop, each with its own volume (the menu's two sliders). ?mute=1 starts silent.
 * Every sound goes through one master chain, so volume 0 silences everything.
 */
let ctx: AudioContext | null = null;
let fxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicTimer: number | null = null;

const read = (k: string, d: number) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : Math.min(1, Math.max(0, Number(v)));
  } catch {
    return d;
  }
};
const write = (k: string, v: number) => {
  try {
    localStorage.setItem(k, String(v));
  } catch {
    /* storage unavailable */
  }
};

const muteParam = new URLSearchParams(location.search).has("mute");
let fxVol = muteParam ? 0 : read("sd-fx", 0.8);
let musicVol = muteParam ? 0 : read("sd-music", 0.5);

export const volumes = () => ({ fx: fxVol, music: musicVol });
export function setFxVolume(v: number) {
  fxVol = v;
  write("sd-fx", v);
  if (fxGain) fxGain.gain.value = v;
}
export function setMusicVolume(v: number) {
  musicVol = v;
  write("sd-music", v);
  if (musicGain) musicGain.gain.value = v * 0.35;
  if (v > 0) startMusic();
}

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      fxGain = ctx.createGain();
      fxGain.gain.value = fxVol;
      fxGain.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = musicVol * 0.35;
      musicGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

const TONES: Record<string, [number, number, OscillatorType][]> = {
  spin: [[260, 0.05, "triangle"]],
  drop: [[150, 0.05, "sine"]],
  win: [[660, 0.08, "triangle"], [880, 0.1, "triangle"]],
  pop: [[900, 0.04, "sine"], [1200, 0.05, "sine"]],
  bank: [[990, 0.05, "sine"]],
  unlock: [[523, 0.1, "square"], [784, 0.14, "square"]],
  halo: [[1200, 0.12, "sine"]],
  anticipation: [[330, 0.25, "sawtooth"], [392, 0.3, "sawtooth"]],
  plusone: [[784, 0.08, "triangle"], [1047, 0.18, "triangle"]],
  trigger: [[523, 0.12, "triangle"], [659, 0.12, "triangle"], [784, 0.2, "triangle"]],
  transition: [[220, 0.25, "sine"], [330, 0.3, "sine"]],
  feature: [[392, 0.15, "triangle"], [523, 0.2, "triangle"], [659, 0.3, "triangle"]],
  chest: [[880, 0.12, "square"]],
  multiply: [[523, 0.1, "triangle"], [784, 0.1, "triangle"], [1047, 0.25, "triangle"]],
  summary: [[659, 0.2, "triangle"], [784, 0.3, "triangle"]],
  bigwin: [[523, 0.15, "square"], [659, 0.15, "square"], [784, 0.15, "square"], [1047, 0.35, "square"]],
  maxwin: [[523, 0.2, "square"], [784, 0.2, "square"], [1047, 0.2, "square"], [1568, 0.5, "square"]],
  mystery: [[300, 0.2, "sawtooth"], [450, 0.25, "sawtooth"]],
  click: [[700, 0.03, "sine"]],
};

export function sound(name: string) {
  if (fxVol <= 0) return;
  const seq = TONES[name];
  const c = seq && audio();
  if (!c || !fxGain) return;
  let t = c.currentTime;
  for (const [f, d, type] of seq) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(fxGain);
    o.start(t);
    o.stop(t + d);
    t += d * 0.9;
  }
}

/** Gentle ambient pad: a slow I–vi–IV–V progression on soft sines. */
const CHORDS = [
  [261.6, 329.6, 392.0],
  [220.0, 261.6, 329.6],
  [174.6, 220.0, 261.6],
  [196.0, 246.9, 293.7],
];
export function startMusic() {
  if (musicTimer !== null || musicVol <= 0) return;
  const c = audio();
  if (!c || !musicGain) return;
  let i = 0;
  const play = () => {
    if (!ctx || !musicGain) return;
    const t = ctx.currentTime;
    for (const f of CHORDS[i++ % CHORDS.length]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 1.2);
      g.gain.linearRampToValueAtTime(0.0001, t + 4.2);
      o.connect(g).connect(musicGain);
      o.start(t);
      o.stop(t + 4.3);
    }
  };
  play();
  musicTimer = window.setInterval(play, 4000);
}
