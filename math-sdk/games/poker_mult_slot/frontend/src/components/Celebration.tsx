import type { CSSProperties, ReactNode } from "react";
import { assetUrl } from "../game/assets";
import type { BigWinTier } from "../game/bigWin";

/**
 * One quiet sparkle above the word — no bolt, no twinkle row.
 * The word + cloud carry the moment; ornaments stay laconic.
 */
export function CeleStars() {
  return (
    <div className="cele-stars" aria-hidden>
      <img src={assetUrl("assets/ui/star-ink.svg")} alt="" className="cele-star" draggable={false} />
    </div>
  );
}

/** Two tiny dust dots at the plate corners — nothing sticker-like. */
export function CeleSparkField({ count }: { count?: number }) {
  // B4: lite-fx passes a tier-driven count (6/8/10/12) — the spark field then
  // renders that many CHEAP sparks (transform/opacity only, 650 ms lifetime);
  // each one just drifts outward from the word, number renders above them.
  if (count != null) {
    return (
      <div className="cele-spark-field lite-spark-field" aria-hidden>
        {Array.from({ length: count }, (_, i) => {
          const ang = (i / count) * Math.PI * 2 + (i % 2) * 0.45;
          const dist = 88 + (i % 3) * 46;
          return (
            <span
              key={i}
              className="cele-spark-lite"
              style={{
                left: `${50 + Math.cos(ang) * 7}%`,
                top: `${44 + Math.sin(ang) * 5}%`,
                ["--tx" as string]: `${Math.round(Math.cos(ang) * dist)}px`,
                ["--ty" as string]: `${Math.round(Math.sin(ang) * dist * 0.72)}px`,
                ["--d" as string]: `${(i % 4) * 60}ms`,
              }}
            />
          );
        })}
      </div>
    );
  }
  return (
    <div className="cele-spark-field" aria-hidden>
      <span className="cele-spark-dot cele-spark-dot-a" />
      <span className="cele-spark-dot cele-spark-dot-b" />
    </div>
  );
}

/** Soft cartoon cloud (same asset as the FS trigger/bank clouds) with the hero value. */
export function CeleSplat({
  children,
  hero = false,
  compact = false,
  tone = "gold",
}: {
  children: ReactNode;
  hero?: boolean;
  compact?: boolean;
  tone?: "gold" | "ivory";
}) {
  const size = compact ? " cele-splat-compact" : hero ? " cele-splat-hero" : "";
  const num = compact ? " cele-splat-num-compact" : hero ? " cele-splat-num-hero" : "";
  return (
    <div className={`cele-splat splash-settle${size}`}>
      <img src={assetUrl("assets/ui/bank-plate.svg")} alt="" className="cele-splat-img" draggable={false} aria-hidden />
      <span className={`cele-splat-num cele-splat-num-${tone}${num}`}>{children}</span>
    </div>
  );
}

/**
 * Display word: ONE gold face with a single small depth copy behind it.
 * Stacked offset copies collided inside glyph counters (owner: letter
 * crossings) — depth is now a 3px/4px shadow span, no blur, no stroke,
 * so the gold reads edge-to-edge as one clean word.
 */
export function CeleWord({
  children,
  variant = "nice",
}: {
  children: string;
  variant?: "nice" | "super" | "sensational" | "max" | "congrats";
}) {
  return (
    <h2 className={`cele-word cele-word-${variant}`} role="heading" aria-level={2} aria-label={children}>
      <span aria-hidden className="cele-word-depth">
        {children}
      </span>
      <span aria-hidden className="cele-word-face">
        {children}
      </span>
    </h2>
  );
}

/** Deterministic pseudo-random in [0,1) — same generator as CosmicBackground's embers. */
function rnd(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const CONFETTI_COUNT: Record<BigWinTier, number> = {
  nice: 8,
  super: 13,
  sensational: 20,
  max: 36,
};

/**
 * Full-viewport burst on every Big Win rung — the board-local win-sparks
 * (CardGrid) stay put for ordinary line wins, this is the Big Win ladder's
 * "screen-wide" moment. NICE/SUPER get a small, quick spark burst (see
 * vibrant.css section 11d for their toned-down piece styling); SENSATIONAL/MAX
 * keep the full, larger burst. Pure CSS shapes (no bitmap assets): a small
 * diamond, tinted per tier in noir.css/vibrant.css. Deterministic layout so
 * re-renders don't reshuffle mid-flight.
 */
export function CeleConfetti({ tier }: { tier: BigWinTier }) {
  const n = CONFETTI_COUNT[tier];
  return (
    <div className={`cele-confetti cele-confetti-${tier}`} aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const angle = rnd(i, 1) * 360;
        const dist = 34 + rnd(i, 2) * 58; // vw-ish travel, scaled in CSS
        const delay = rnd(i, 3) * 0.32;
        const dur = 1.1 + rnd(i, 4) * 0.9;
        const size = 0.4 + rnd(i, 5) * 0.55;
        const spin = (rnd(i, 6) < 0.5 ? -1 : 1) * (260 + rnd(i, 7) * 340);
        const hue = i % 3;
        return (
          <i
            key={i}
            className={`cele-confetti-piece cele-confetti-piece-${hue}`}
            style={
              {
                "--ang": `${angle.toFixed(1)}deg`,
                "--dist": `${dist.toFixed(1)}vmin`,
                "--delay": `${delay.toFixed(2)}s`,
                "--dur": `${dur.toFixed(2)}s`,
                "--size": `${size.toFixed(2)}rem`,
                "--spin": `${spin.toFixed(0)}deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

const EMBER_COUNT: Record<BigWinTier, number> = {
  nice: 14,
  super: 20,
  sensational: 30,
  max: 42,
};

/**
 * Replaces the old spinning conic-gradient rays behind the Big Win word
 * (noir.css .cele-float::before/::after — killed in vibrant.css §12) with a
 * marigold ember/smoke burst: soft glowing embers + drifting smoke puffs
 * that rise and drift outward from the word, same visual family as the
 * board's ambient embers (vibrant.css .ambient-embers) so the celebration
 * feels like it belongs to this game rather than a generic slot vortex.
 * Deterministic layout (same rnd() generator as CeleConfetti) so re-renders
 * mid-flight don't reshuffle the burst.
 */
export function CeleEmberBurst({ tier }: { tier: BigWinTier }) {
  const n = EMBER_COUNT[tier];
  return (
    <div className={`cele-ember-burst cele-ember-burst-${tier}`} aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const angle = rnd(i, 11) * 360;
        const dist = 22 + rnd(i, 12) * 46;
        const delay = rnd(i, 13) * 0.5;
        const dur = 1.6 + rnd(i, 14) * 1.4;
        const size = 0.5 + rnd(i, 15) * 1.1;
        const drift = (rnd(i, 16) - 0.5) * 40;
        const kind = rnd(i, 17) < 0.32 ? "smoke" : "ember";
        return (
          <i
            key={i}
            className={`cele-ember-piece cele-ember-piece-${kind}`}
            style={
              {
                "--ang": `${angle.toFixed(1)}deg`,
                "--dist": `${dist.toFixed(1)}vmin`,
                "--delay": `${delay.toFixed(2)}s`,
                "--dur": `${dur.toFixed(2)}s`,
                "--size": `${size.toFixed(2)}rem`,
                "--drift": `${drift.toFixed(0)}px`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
