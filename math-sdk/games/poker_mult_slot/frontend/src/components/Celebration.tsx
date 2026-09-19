import type { CSSProperties, ReactNode } from "react";
import { assetUrl } from "../game/assets";

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
export function CeleSparkField() {
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
      <img src={assetUrl("assets/ui/ink-plate.svg")} alt="" className="cele-splat-img" draggable={false} aria-hidden />
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
