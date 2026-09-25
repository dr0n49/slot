import { memo, useId, type CSSProperties } from "react";
import { assetUrl } from "../game/assets";
import { CandleShrine } from "./CandleShrine";

/** Shared backdrop — a crimson lattice (splash + in-game). Vector, so it stays sharp on any
 *  screen. The papel-picado bunting used to be baked into this art; it is now the live
 *  Bunting layer below so each flag can sway on its own string. */
export const SERIES_BG = "assets/bg/muerta-bg.svg";
export const SERIES_BG_PORTRAIT = "assets/bg/muerta-bg-portrait.svg";
/** Free-spins variant: same lattice, warmed by the CSS hue-shift in noir.css (.bg-bonus-layer). */
export const SERIES_BG_BONUS = "assets/bg/muerta-bg-bonus.svg";
export const SERIES_BG_PORTRAIT_BONUS = "assets/bg/muerta-bg-portrait-bonus.svg";

/** Landscape art on wide screens, tall art on phones held upright. */
export function BgPicture({ className, bonus = false }: { className: string; bonus?: boolean }) {
  return (
    <picture>
      <source media="(orientation: portrait)" srcSet={assetUrl(bonus ? SERIES_BG_PORTRAIT_BONUS : SERIES_BG_PORTRAIT)} />
      <img src={assetUrl(bonus ? SERIES_BG_BONUS : SERIES_BG)} alt="" className={className} draggable={false} />
    </picture>
  );
}

/** Deterministic pseudo-random in [0,1) so the embers look scattered but never re-shuffle on render. */
function rnd(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ══════════════════════════════════════════════════════════════════
// Papel-picado bunting — textured, die-cut flag art (skull / flower cut-outs,
// paper fibre, embossed edge, soft drop shadow) exported 1:1 from the
// original backdrop art (the version where the flags were baked in) to
// public/assets/bunting/papel-N.webp, one image per flag, hung on the same
// two twisted ropes at the same attach points.
//
// Motion is compositor-only (transform / opacity on HTML layers, no SVG
// filters re-rendered per frame — the old procedural flags ran 10 animated
// feTurbulence filters, which repainted the whole garland every frame):
//   • .papel-swing   — sine-eased pendulum around the flag's rope knot
//   • .papel-flutter — faster, out-of-phase skew/squash from the top edge,
//                      so the paper bends like it catches the air
//   • .papel-sheen   — a highlight masked to the flag's own silhouette whose
//                      opacity follows the swing, so the flag reads as a
//                      turning sheet of paper, not a flat sticker
// All sizes are in cqw of the .bunting box (1 art unit = 1/1600 of its
// width), so the garland scales exactly like the old 1600×140 SVG did.
// ══════════════════════════════════════════════════════════════════

/** Flag image = 78×104 art units plus a 16-unit margin (drop shadow) on every side. */
const PAPEL_PAD = 16;
const PAPEL_W = 78 + PAPEL_PAD * 2;
const PAPEL_H = 104 + PAPEL_PAD * 2;
/** Attach point (rope knot) + resting pose of each flag, from the original art. */
const PAPEL_FLAGS: Array<{ x: number; y: number; rot: number; sx: number; sy: number; skew: number }> = [
  { x: 31.4, y: 14.2, rot: 12.4, sx: 0.924, sy: 0.948, skew: -0.1 },
  { x: 151.7, y: 31.7, rot: 7.2, sx: 0.919, sy: 0.941, skew: 0.0 },
  { x: 253.0, y: 36.8, rot: -0.4, sx: 0.96, sy: 0.945, skew: -2.2 },
  { x: 367.9, y: 31.7, rot: -7.0, sx: 0.925, sy: 0.914, skew: 2.5 },
  { x: 488.4, y: 14.0, rot: -10.6, sx: 0.909, sy: 0.914, skew: -0.9 },
  { x: 1111.4, y: 14.0, rot: 14.0, sx: 0.949, sy: 0.933, skew: -1.7 },
  { x: 1223.4, y: 30.9, rot: 8.4, sx: 0.922, sy: 0.937, skew: 0.3 },
  { x: 1340.1, y: 36.8, rot: -1.9, sx: 0.892, sy: 0.914, skew: 1.8 },
  { x: 1456.0, y: 31.0, rot: -7.5, sx: 0.979, sy: 0.966, skew: 2.0 },
  { x: 1567.6, y: 14.3, rot: -10.7, sx: 0.947, sy: 0.953, skew: -1.9 }
];
/** Same rope curves as the original art (y=4 at the ends, sagging to ~38). */
const ROPES = ["M-20 4 Q259.67 72 539.33 4", "M1060.67 4 Q1340.33 72 1620 4"];
const U = (n: number) => `${((n * 100) / 1600).toFixed(4)}cqw`;

/** Two ropes with five flags each, a clear gap over the board's top-centre.
 *  Exported so BootSplash can hang the same live garland over the intro cards. */
export function Bunting() {
  const uid = useId().replace(/:/g, "");
  return (
    <div className="bunting" aria-hidden>
      <svg className="bunting-ropes" viewBox="0 0 1600 140" preserveAspectRatio="none">
        <defs>
          <pattern
            id={`${uid}-twist`}
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-38)"
          >
            <rect width="3" height="3" fill="#8a7a58" />
            <rect width="1.5" height="3" fill="#d8c9a4" />
          </pattern>
        </defs>
        {ROPES.map((d) => (
          <g key={d}>
            <path d={d} fill="none" stroke="#000" strokeWidth={3.4} opacity={0.35} transform="translate(1.5 3.5)" />
            <path d={d} fill="none" stroke="#3b3223" strokeWidth={3.2} />
            <path d={d} fill="none" stroke={`url(#${uid}-twist)`} strokeWidth={2.6} />
            <path d={d} fill="none" stroke="#fff" strokeOpacity={0.16} strokeWidth={0.7} transform="translate(0 -0.8)" />
          </g>
        ))}
      </svg>
      {PAPEL_FLAGS.map((f, i) => {
        const src = assetUrl(`assets/bunting/papel-${i}.webp`);
        // Deterministic per-flag variety so neighbours never swing in lockstep.
        const swingS = 3.2 + rnd(i, 7) * 1.8;
        const flutterS = 1.35 + rnd(i, 3) * 0.9;
        return (
          <div
            key={i}
            className="papel"
            style={{ left: `${(f.x / 16).toFixed(4)}%`, top: U(f.y) }}
          >
            <div
              className="papel-swing"
              style={
                {
                  "--rot": `${f.rot}deg`,
                  "--amp": `${(3.6 + rnd(i, 9) * 3.2).toFixed(2)}deg`,
                  animationDuration: `${swingS.toFixed(2)}s`,
                  animationDelay: `${(-rnd(i, 8) * swingS).toFixed(2)}s`,
                } as CSSProperties
              }
            >
              <div
                className="papel-pose"
                style={{ transform: `scale(${f.sx}, ${f.sy}) skewX(${f.skew}deg)` }}
              >
                <div
                  className="papel-flutter"
                  style={{
                    animationDuration: `${flutterS.toFixed(2)}s`,
                    animationDelay: `${(-rnd(i, 4) * flutterS).toFixed(2)}s`,
                  }}
                >
                  <img
                    src={src}
                    alt=""
                    draggable={false}
                    className="papel-img"
                    style={{
                      left: U(-(39 + PAPEL_PAD)),
                      top: U(-PAPEL_PAD),
                      width: U(PAPEL_W),
                      height: U(PAPEL_H),
                    }}
                  />
                  <span
                    className="papel-sheen"
                    style={
                      {
                        left: U(-(39 + PAPEL_PAD)),
                        top: U(-PAPEL_PAD),
                        width: U(PAPEL_W),
                        height: U(PAPEL_H),
                        WebkitMaskImage: `url(${src})`,
                        maskImage: `url(${src})`,
                        animationDuration: `${swingS.toFixed(2)}s`,
                        animationDelay: `${(-rnd(i, 8) * swingS).toFixed(2)}s`,
                      } as CSSProperties
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const EMBER_COUNT = 22;

/**
 * Slow rising marigold petals / embers behind the board — gives the empty flanks of the
 * landscape layout something alive to look at. Pure CSS (see vibrant.css), off in lite-fx.
 */
function AmbientEmbers() {
  return (
    <div className="ambient-embers" aria-hidden>
      {Array.from({ length: EMBER_COUNT }, (_, i) => {
        const size = 4 + rnd(i, 1) * 9;
        return (
          <i
            key={i}
            className={i % 3 === 0 ? "is-petal" : undefined}
            style={
              {
                "--x": (rnd(i, 2) * 100).toFixed(1),
                "--s": `${size.toFixed(1)}px`,
                "--d": `${(9 + rnd(i, 3) * 9).toFixed(1)}s`,
                "--t": `${(-rnd(i, 4) * 18).toFixed(1)}s`,
                "--dx": `${((rnd(i, 5) - 0.5) * 90).toFixed(0)}px`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/** Memoized: the in-game App re-renders on every Godot bridge event; the
 *  backdrop only changes when `bonus` flips, so it never re-renders otherwise. */
export const CosmicBackground = memo(function CosmicBackground({ bonus = false }: { bonus?: boolean }) {
  return (
    <div
      className="cosmic-bg pointer-events-none absolute inset-0 overflow-hidden"
      data-bonus={bonus ? "1" : "0"}
      aria-hidden
    >
      <BgPicture className="storm-photo" />
      <div className="bg-bonus-layer" style={{ opacity: bonus ? 1 : 0 }}>
        <BgPicture className="storm-photo" bonus />
      </div>
      <div className="cosmic-vignette" />
      <Bunting />
      <AmbientEmbers />
      <CandleShrine />
    </div>
  );
});
