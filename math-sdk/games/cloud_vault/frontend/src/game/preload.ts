import { waitForVisualWarmup } from "../spine/visualWarmup";
import { loadRig, spineDisabled } from "../spine/runtime";
import { modeArtSrc, modeBlurSrc } from "./modes";

/** Decode the actual game artwork before exposing the welcome cards or play controls. */
export const VISUAL_IMAGES = [
  "./art/provider/ruby_gaming.png", "./art/ui/logo.webp", "./art/bg.jpg", "./art/bg_portrait.jpg",
  "./art/frame_v25.webp", "./fx/reference_cloud/puff_center.png", "./character/char_painterly.webp", "./art/ui/bonus_ruby.png",
  ...["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "S"].map((s) => `./symbols/${s}.webp`),
  "./art/ui/bg_bonus.jpg", "./art/ui/bg_bonus_portrait.jpg",
  ...["closed", "ready", "open"].map((s) => `./art/bloom/lotus_${s}.webp`),
  ...(["extra_chance", "super_chance", "raid", "storm", "bonus", "super", "mystery"] as const).flatMap((m) => [modeArtSrc(m), modeBlurSrc(m)]),
  "./fx/fragments.webp",
  "./art/ui/key.webp", "./art/ui/win_lotus_v3.webp",
  // Round screens: painted lettering and digits (spine/tools/import_win_art_v5.py).
  ...["total-win", "big-win", "mega-win", "epic-win", "max-win", "bloom-bonus", "bloom-super", "bloom-epic", "free-spins"].map((n) => `./art/screens/v5/titles/${n}.webp`),
  ...[..."0123456789", "decimal", "comma", "multiply", "dollar"].map((n) => `./art/screens/v5/glyphs/${n}.webp`),
  ...[1, 2, 3, 4, 5].map((n) => `./fx/cloud${n}.png`),
] as const;

/** The decoded images stay referenced for the page's life, so the browser keeps them in its memory cache and the
 * start screen's own <img> tags get them at once (no revalidation round trip, no second decode). */
const kept: HTMLImageElement[] = [];

function decodedImage(src: string, tries = 2): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    kept.push(img);
    // A downloaded image whose early decode is refused (Safari does this for large images under memory pressure)
    // still paints: the browser decodes it on first draw, so it must not stop the game.
    img.onload = () => img.decode().then(() => resolve(), (e) => {
      console.warn(`[preload] decode deferred to first paint: ${src}`, e);
      resolve();
    });
    img.onerror = () => reject(new Error(`Artwork unavailable: ${new URL(src, location.href).href}`));
    img.src = src;
  }).catch((e) => {
    // One more attempt for a dropped connection before the loading screen reports it.
    if (tries > 1) return decodedImage(src, tries - 1);
    throw e;
  });
}

export async function preloadVisuals(progress: (done: number, total: number) => void): Promise<void> {
  // Spine may fall back to the decoded PNGs on devices without WebGL.
  const rigs = spineDisabled() ? [] : ["symbols", "frame", "character", "screens"];
  const tasks: (() => Promise<unknown>)[] = [
    ...VISUAL_IMAGES.map((src) => () => decodedImage(src)),
    ...rigs.map((name) => () => loadRig(name).catch(() => undefined)),
    // The start screen's bundled faces (Latin, Cyrillic and Vietnamese subsets of Nunito), loaded before it is shown.
    // FontFaceSet.load rejects when a face fails to load; a font must never stop the game with "connection problem",
    // the text then falls back to the next family in the stack.
    () => Promise.all([document.fonts.load('700 16px "Lora"', "A"), document.fonts.load('900 16px "Nunito"', "Aa Яя ạ")]).catch(() => undefined),
    () => document.fonts.ready,
    () => waitForVisualWarmup(),
  ];
  let done = 0;
  progress(done, tasks.length);
  await Promise.all(tasks.map(async (task) => {
    await task();
    progress(++done, tasks.length);
  }));
}
