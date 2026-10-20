/** Tiny synthesized sound set (WebAudio) until real audio is produced. Muted with ?mute=1. */
let ctx: AudioContext | null = null;
let muted = new URLSearchParams(location.search).has("mute");
try {
  if (localStorage.getItem("cv-sound") === "off") muted = true;
} catch {
  /* storage unavailable */
}
export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("cv-sound", m ? "off" : "on");
  } catch {
    /* storage unavailable */
  }
}

const TONES: Record<string, [number, number, OscillatorType][]> = {
  spin: [[220, 0.06, "triangle"]],
  drop: [[140, 0.05, "sine"]],
  win: [[660, 0.08, "triangle"], [880, 0.1, "triangle"]],
  bank: [[990, 0.05, "sine"]],
  unlock: [[523, 0.1, "square"], [784, 0.14, "square"]],
  halo: [[1200, 0.12, "sine"]],
  trigger: [[523, 0.12, "triangle"], [659, 0.12, "triangle"], [784, 0.2, "triangle"]],
  feature: [[392, 0.15, "triangle"], [523, 0.2, "triangle"]],
  chest: [[880, 0.12, "square"]],
  multiply: [[523, 0.1, "triangle"], [784, 0.1, "triangle"], [1047, 0.25, "triangle"]],
  summary: [[659, 0.2, "triangle"], [784, 0.3, "triangle"]],
  bigwin: [[523, 0.15, "square"], [659, 0.15, "square"], [784, 0.15, "square"], [1047, 0.35, "square"]],
  maxwin: [[523, 0.2, "square"], [784, 0.2, "square"], [1047, 0.2, "square"], [1568, 0.5, "square"]],
  mystery: [[300, 0.2, "sawtooth"], [450, 0.25, "sawtooth"]],
};

export function sound(name: string) {
  if (muted) return;
  const seq = TONES[name];
  if (!seq) return;
  try {
    ctx ??= new AudioContext();
    let t = ctx.currentTime;
    for (const [f, d, type] of seq) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + d);
      t += d * 0.9;
    }
  } catch {
    /* audio unavailable */
  }
}
