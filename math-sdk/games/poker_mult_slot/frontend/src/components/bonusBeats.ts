// Approved presentation durations only; engine awards and bankAdd stay immutable.
export const BONUS_BEATS = {
  intro: 850, introTurbo: 500, multiplier: 150, bank: 300,
  win: 450, noWin: 220, turboWin: 220, reduced: 80,
} as const;
