/**
 * Spine runtime glue (Pixi 8 + spine-pixi-v8 4.3). Skeletons are exported from the
 * editor projects in games/cloud_vault/spine/*.spine (see spine/README.md).
 */
import { Application, Assets } from "pixi.js";
import { Spine } from "@esotericsoftware/spine-pixi-v8";

const RIGS = {
  character: { data: "./spine/character/character.json", atlas: "./spine/character/character.atlas" },
  symbols: { data: "./spine/symbols/symbols.json", atlas: "./spine/symbols/symbols.atlas" },
  chest: { data: "./spine/chest/chest.json", atlas: "./spine/chest/chest.atlas" },
  frame: { data: "./spine/frame/frame.json", atlas: "./spine/frame/frame.atlas" },
  screens: { data: "./spine/screens/screens.json", atlas: "./spine/screens/screens.atlas" },
} as const;
export type RigName = keyof typeof RIGS;

const loaded = new Map<RigName, Promise<void>>();

export function loadRig(name: RigName): Promise<void> {
  if (!loaded.has(name)) {
    const r = RIGS[name];
    Assets.add({ alias: `${name}Data`, src: r.data });
    Assets.add({ alias: `${name}Atlas`, src: r.atlas });
    loaded.set(name, Assets.load([`${name}Data`, `${name}Atlas`]).then(() => undefined));
  }
  return loaded.get(name)!;
}

export const makeSpine = (name: RigName) => Spine.from({ skeleton: `${name}Data`, atlas: `${name}Atlas`, scale: 1 });

/** A transparent Pixi canvas that fills `host` and follows its size. */
export async function makeApp(host: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    resizeTo: host,
    preference: "webgl",
  });
  app.canvas.style.position = "absolute";
  app.canvas.style.inset = "0";
  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";
  app.canvas.style.pointerEvents = "none";
  host.appendChild(app.canvas);
  return app;
}

/** Spine availability: false if WebGL or loading fails (the DOM art stays as fallback). */
export const spineDisabled = () => new URLSearchParams(location.search).has("nospine");

/* ---------------------------------------------------------------- character reactions */

export type CharacterCue =
  | "spin"
  | "win"
  | "anticipation"
  | "trigger"
  | "featureEnd"
  | "bigwin"
  | "settle";

type Listener = (cue: CharacterCue) => void;
const listeners = new Set<Listener>();
export const characterBus = {
  emit: (cue: CharacterCue) => listeners.forEach((l) => l(cue)),
  on: (l: Listener) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
