/** Stake-multiple grading for line-win FX (glow / sparks / shake). */
export type WinGrade = "soft" | "mid" | "big";

export function winGrade(spinWinX: number): WinGrade | null {
  if (!(spinWinX > 0)) return null;
  if (spinWinX < 1) return "soft";
  if (spinWinX < 10) return "mid";
  return "big";
}

/**
 * Continuous win-line stroke weight from log of stake multiple.
 * Maps ~0.25× → bold (~3.2), ~1× → ~4.4, ~10×+ → heavy (~6.6). Noir skin: the
 * payline has to read at a glance on a dark board and on a phone.
 */
export function beamStrokePx(spinWinX: number, tileW: number): number {
  const x = Math.max(0.25, Number(spinWinX) || 0.25);
  // log10(0.25)≈-0.6 → 0; log10(10)=1 → 1; clamp
  const t = Math.min(1, Math.max(0, (Math.log10(x) + 0.6) / 1.6));
  const px = 3.2 + t * 3.4;
  return Math.max(2.6, Math.min(tileW * 0.115, px));
}

/** Dark outline extra width (CSS px) — thin contour, not a heavy rim. */
export function beamOutlineExtraPx(spinWinX: number): number {
  const x = Math.max(0.25, Number(spinWinX) || 0.25);
  const t = Math.min(1, Math.max(0, (Math.log10(x) + 0.6) / 1.6));
  return 2.4 + t * 2;
}

/**
 * Smooth beam/outline weight from log stake-multiple (no hard steps).
 * Returns ~0 at tiny pays → ~1 around x10+.
 */
export function winBeamWeight(spinWinX: number): number {
  if (!(spinWinX > 0)) return 0;
  const t = Math.log10(1 + spinWinX) / Math.log10(1 + 25);
  return Math.max(0, Math.min(1, t));
}
