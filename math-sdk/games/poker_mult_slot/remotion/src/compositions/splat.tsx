import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Wet cloud pool — the shared celebration splat.
 *
 * Built from a union of overlapping circles so the silhouette can only be
 * smooth lobes (the old hooked-spike look is structurally impossible here).
 * Rim light = the same circle set dilated and offset behind the body, so the
 * thin gold/cyan edge follows the cloud exactly. Animated with frame-driven
 * breathing; no CSS keyframes.
 */

type Puff = { cx: number; cy: number; r: number; phase: number; speed: number };

export const PUFFS: Puff[] = [
  { cx: 142, cy: 168, r: 62, phase: 0.0, speed: 0.9 },
  { cx: 208, cy: 122, r: 68, phase: 1.1, speed: 0.8 },
  { cx: 312, cy: 94, r: 65, phase: 2.0, speed: 1.1 },
  { cx: 422, cy: 96, r: 64, phase: 3.1, speed: 0.9 },
  { cx: 522, cy: 124, r: 64, phase: 4.2, speed: 1.0 },
  { cx: 594, cy: 178, r: 55, phase: 5.0, speed: 0.85 },
  { cx: 548, cy: 222, r: 56, phase: 5.9, speed: 0.95 },
  { cx: 440, cy: 234, r: 61, phase: 6.8, speed: 0.9 },
  { cx: 324, cy: 232, r: 62, phase: 7.7, speed: 1.05 },
  { cx: 214, cy: 212, r: 60, phase: 8.6, speed: 0.9 },
  // interior fillers: keep the union solid and every notch shallow
  { cx: 266, cy: 166, r: 72, phase: 9.5, speed: 0.7 },
  { cx: 452, cy: 164, r: 74, phase: 10.4, speed: 0.75 },
  { cx: 372, cy: 206, r: 62, phase: 11.3, speed: 0.8 },
  { cx: 366, cy: 128, r: 44, phase: 12.1, speed: 0.85 },
];

const DROPS = [
  { x: 350, y0: 244, w: 26, len: 40 },
  { x: 492, y0: 240, w: 18, len: 26 },
];

export const breath = (frame: number): number[] =>
  PUFFS.map(
    (p) => p.r + Math.sin(frame / 9 + p.phase) * 2.4 + Math.sin(frame / 23 + p.phase * 2) * 1.6,
  );

/** The cloud body: halo → rims → body → core → gloss, one shared gradient. */
export const CloudSplat: React.FC<{
  hero?: React.ReactNode;
  tone?: "gold" | "ivory";
}> = ({ hero, tone = "gold" }) => {
  const frame = useCurrentFrame();
  const radii = breath(frame);
  const gid = React.useId().replace(/[:]/g, "");

  return (
    <svg viewBox="0 0 720 300" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={`body-${gid}`} gradientUnits="userSpaceOnUse" x1="250" y1="40" x2="440" y2="290">
          <stop offset="0" stopColor="#d8b8fb" />
          <stop offset="0.3" stopColor="#a76bf5" />
          <stop offset="0.62" stopColor="#7231dd" />
          <stop offset="1" stopColor="#34106e" />
        </linearGradient>
        <radialGradient id={`core-${gid}`} gradientUnits="userSpaceOnUse" cx="360" cy="160" r="190">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="0.55" stopColor="#e9d5ff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* dilate the whole union → thin rim that follows the cloud, no interior arcs */}
        <filter id={`rim-gold-${gid}`} x="-8%" y="-16%" width="116%" height="136%">
          <feMorphology operator="dilate" radius="2.6" in="SourceGraphic" />
        </filter>
        <filter id={`rim-cyan-${gid}`} x="-10%" y="-20%" width="120%" height="144%">
          <feMorphology operator="dilate" radius="6" in="SourceGraphic" />
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <filter id={`halo-${gid}`} x="-14%" y="-28%" width="128%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <clipPath id={`union-${gid}`}>
          {PUFFS.map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r={radii[i]} />
          ))}
          {DROPS.map((d, i) => (
            <rect
              key={`d${i}`}
              x={d.x - d.w / 2}
              y={d.y0}
              width={d.w}
              height={d.len + d.w / 2}
              rx={d.w / 2}
            />
          ))}
        </clipPath>
      </defs>

      {/* soft outer halo */}
      <g filter={`url(#halo-${gid})`} opacity="0.3" fill="#8b5cf6" transform="translate(0 4)">
        {PUFFS.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={radii[i]} />
        ))}
      </g>

      {/* cyan edge light, top-left */}
      <g filter={`url(#rim-cyan-${gid})`} opacity="0.55" fill="#7fe6ff" transform="translate(-4 -5)">
        {PUFFS.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={radii[i]} />
        ))}
      </g>

      {/* thin gold rim, follows the silhouette */}
      <g filter={`url(#rim-gold-${gid})`} fill="#f0c14b">
        {DROPS.map((d, i) => (
          <rect
            key={`d${i}`}
            x={d.x - d.w / 2}
            y={d.y0}
            width={d.w}
            height={d.len + d.w / 2}
            rx={d.w / 2}
          />
        ))}
        {PUFFS.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={radii[i]} />
        ))}
      </g>

      {/* body */}
      <g fill={`url(#body-${gid})`}>
        {DROPS.map((d, i) => (
          <rect
            key={`d${i}`}
            x={d.x - d.w / 2}
            y={d.y0}
            width={d.w}
            height={d.len + d.w / 2}
            rx={d.w / 2}
          />
        ))}
        {PUFFS.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={radii[i]} />
        ))}
      </g>

      {/* inner shading, clipped to the cloud */}
      <g clipPath={`url(#union-${gid})`}>
        <ellipse cx="360" cy="160" rx="250" ry="105" fill={`url(#core-${gid})`} />
        {/* wet floor shade bottom */}
        <ellipse cx="380" cy="252" rx="230" ry="46" fill="#1d0540" opacity="0.38" />
        {/* gloss strokes */}
        <ellipse cx="252" cy="102" rx="58" ry="11" fill="#ffffff" opacity="0.5" transform="rotate(-9 252 102)" />
        <ellipse cx="336" cy="86" rx="24" ry="5.5" fill="#ffffff" opacity="0.34" transform="rotate(-3 336 86)" />
        <ellipse cx="468" cy="216" rx="40" ry="8" fill="#1a0640" opacity="0.3" transform="rotate(4 468 216)" />
      </g>

      {hero ? (
        <g>
          {tone === "ivory" ? (
            <text
              x="360"
              y="184"
              textAnchor="middle"
              fontFamily="'Exo 2', 'Arial Black', sans-serif"
              fontWeight={900}
              fontSize={96}
              fill="#fdf9ef"
              stroke="#1a0830"
              strokeWidth={3}
              paintOrder="stroke"
              style={{ paintOrder: "stroke" }}
            >
              {hero}
            </text>
          ) : (
            <>
              <text
                x="360"
                y="187"
                textAnchor="middle"
                fontFamily="'Exo 2', 'Arial Black', sans-serif"
                fontWeight={900}
                fontSize={96}
                fill="none"
                stroke="#1a0830"
                strokeWidth={10}
                opacity={0.85}
              >
                {hero}
              </text>
              <text
                x="360"
                y="184"
                textAnchor="middle"
                fontFamily="'Exo 2', 'Arial Black', sans-serif"
                fontWeight={900}
                fontSize={96}
                fill="#ffd75e"
              >
                {hero}
              </text>
              <text
                x="360"
                y="184"
                textAnchor="middle"
                fontFamily="'Exo 2', 'Arial Black', sans-serif"
                fontWeight={900}
                fontSize={96}
                fill="url(#faceGrad)"
              >
                {hero}
              </text>
              <defs>
                <linearGradient id="faceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fff3b0" />
                  <stop offset="0.45" stopColor="#ffd75e" />
                  <stop offset="1" stopColor="#f0a93c" />
                </linearGradient>
              </defs>
            </>
          )}
        </g>
      ) : null}
    </svg>
  );
};

/** Layered extruded display word (same recipe as the live client). */
const DEPTH_COLORS = ["#4c2a80", "#3c1f66", "#2d1550", "#22103c", "#180a2a", "#100518"];

export const ExtrudedWord: React.FC<{ children: string; size: number }> = ({ children, size }) => {
  return (
    <div style={{ position: "relative", display: "inline-block", fontStyle: "italic", fontWeight: 900, lineHeight: 0.9 }}>
      {DEPTH_COLORS.map((color, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            color,
            fontSize: size,
            letterSpacing: -2,
            transform: `translate(${(DEPTH_COLORS.length - i) * 1.4}px, ${(DEPTH_COLORS.length - i) * 1.8}px)`,
            filter: "blur(0.5px)",
          }}
        >
          {children}
        </div>
      ))}
      <div
        style={{
          position: "relative",
          fontSize: size,
          letterSpacing: -2,
          color: "transparent",
          backgroundImage: "linear-gradient(180deg, #fff3b0 4%, #ffd75e 38%, #f0a93c 70%, #cf8420 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextStroke: "2px rgba(32,12,4,0.85)",
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Entrance pop shared by the celebration comps. */
export const usePop = (delay = 0, damping = 12, mass = 0.7) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass } });
};

export const popScale = (progress: number, from = 0.6) =>
  interpolate(progress, [0, 1], [from, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    output: "perceptual-scale",
  });
