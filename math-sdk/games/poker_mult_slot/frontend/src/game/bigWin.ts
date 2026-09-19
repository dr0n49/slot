/**
 * Big Win tiers — locked product table (do not add tiers).
 * Thresholds are on the spin's own win in stake-multiples (spinWinX),
 * not on the bonus running total.
 */

export type BigWinTier = "nice" | "super" | "sensational" | "max";

export const BIG_WIN_MIN = 20;

export const BIG_WIN_ORDER: BigWinTier[] = ["nice", "super", "sensational", "max"];

/** Floor (stake ×) where each tier first unlocks. */
export const BIG_WIN_FLOOR: Record<BigWinTier, number> = {
  nice: 20,
  super: 50,
  sensational: 100,
  max: 500,
};

/** ≥20 & ≤50 NICE · >50 & ≤100 SUPER · >100 & ≤500 SENSATIONAL · >500 (or round cap) MAX.
 * Exact boundary values stay on the lower tier (50→nice, 100→super, 500→sensational). */
export function bigWinTier(spinWinX: number, isMaxWin = false): BigWinTier | null {
  if (isMaxWin || spinWinX > 500) return "max";
  if (spinWinX > 100) return "sensational";
  if (spinWinX > 50) return "super";
  if (spinWinX >= BIG_WIN_MIN) return "nice";
  return null;
}

/** Ladder from NICE up to the final tier (inclusive). */
export function bigWinLadder(final: BigWinTier): BigWinTier[] {
  const i = BIG_WIN_ORDER.indexOf(final);
  if (i < 0) return ["nice"];
  return BIG_WIN_ORDER.slice(0, i + 1);
}

/**
 * Cash target for a ladder step. Intermediate steps land on the next
 * tier's floor (in stake×), scaled to the final cash; the last step is
 * the true win amount.
 */
export function bigWinStepCash(
  step: BigWinTier,
  final: BigWinTier,
  spinWinX: number,
  amount: number,
): number {
  if (step === final || spinWinX <= 0) return amount;
  const i = BIG_WIN_ORDER.indexOf(step);
  const next = BIG_WIN_ORDER[i + 1];
  if (!next) return amount;
  const capX = Math.min(spinWinX, BIG_WIN_FLOOR[next]);
  return Math.round(amount * (capX / spinWinX) * 100) / 100;
}

/** Hold on the finished number after each step's count-up (ms). Grows with tier. */
export const BIG_WIN_HOLD_MS: Record<BigWinTier, number> = {
  nice: 700,
  super: 1100,
  sensational: 1700,
  max: 2000,
};

/** Count-up duration per step (ms). Final rung is slowest / heaviest. */
export const BIG_WIN_COUNT_MS: Record<BigWinTier, number> = {
  nice: 800,
  super: 1050,
  sensational: 1500,
  max: 2400,
};

/** Beat before SUPER / SENSATIONAL / MAX word punch (ms). */
export const BIG_WIN_ANTICIPATION_MS = 200;
