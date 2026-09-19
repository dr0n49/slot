import { describe, expect, it } from "vitest";

import { anticipationPlan, dealDelaysMs, reelSpinMs } from "../src/components/CardGrid";
import {
  buyBonusPrice,
  buyBonusPriceX,
  LINES,
  evaluateHand,
  formatLinePay,
  linePayX,
  mathConfig,
  paintGolden,
  playTriggerSpin,
  playBonusPackage,
  playGuaranteedSpin,
  playRound,
  playSpin,
  playUntilWinX,
  reseed,
  roundStakeX,
  scalePackageToWinX,
  type Card,
} from "../src/game/engine";

const rankVals: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, T: 10, J: 11, Q: 12, K: 13, A: 14,
};

/** Build a Card from rank char + suit char. */
function c(rank: string, suit: string): Card {
  return { rank: rank as Card["rank"], suit: suit as Card["suit"] };
}

function ids(cards: Card[]): number[] {
  const suitIdx: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
  return cards.map((x) => (rankVals[x.rank] - 2) * 4 + suitIdx[x.suit]);
}

const FIXTURE: Card[] = (() => {
  // Cells: royal spades on D0 (0,6,12,18,24), pair of aces on H1 (5..9).
  const board: Record<number, Card> = {
    0: c("A", "S"), 1: c("2", "C"), 2: c("3", "D"), 3: c("5", "H"), 4: c("6", "S"),
    5: c("A", "H"), 6: c("K", "S"), 7: c("A", "D"), 8: c("3", "C"), 9: c("8", "H"),
    10: c("4", "S"), 11: c("9", "H"), 12: c("Q", "S"), 13: c("T", "D"), 14: c("7", "C"),
    15: c("2", "D"), 16: c("6", "H"), 17: c("9", "C"), 18: c("J", "S"), 19: c("T", "H"),
    20: c("5", "C"), 21: c("2", "H"), 22: c("8", "D"), 23: c("9", "D"), 24: c("T", "S"),
  };
  return [...Array(25).keys()].map((i) => board[i]);
})();

describe("board geometry", () => {
  it("has exactly the 7 locked lines", () => {
    expect(LINES).toEqual([
      [0, 1, 2, 3, 4],
      [5, 6, 7, 8, 9],
      [10, 11, 12, 13, 14],
      [15, 16, 17, 18, 19],
      [20, 21, 22, 23, 24],
      [0, 6, 12, 18, 24],
      [4, 8, 12, 16, 20],
    ]);
  });
});

describe("published line pays", () => {
  it("is 0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 8 / 20 / 200", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(linePayX)).toEqual([
      0.25, 0.5, 0.75, 1, 1.5, 2, 8, 20, 200,
    ]);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(formatLinePay)).toEqual([
      "0.25×", "0.5×", "0.75×", "1×", "1.5×", "2×", "8×", "20×", "200×",
    ]);
  });
});

describe("evaluateHand", () => {
  it("rates every paytable category", () => {
    expect(evaluateHand([c("T", "S"), c("J", "S"), c("Q", "S"), c("K", "S"), c("A", "S")])).toBe(9);
    expect(evaluateHand([c("9", "H"), c("T", "H"), c("J", "H"), c("Q", "H"), c("K", "H")])).toBe(8);
    expect(evaluateHand([c("2", "H"), c("3", "D"), c("4", "S"), c("5", "C"), c("A", "S")])).toBe(4); // wheel
    expect(evaluateHand([c("5", "S"), c("5", "H"), c("5", "D"), c("5", "C"), c("9", "S")])).toBe(7);
    expect(evaluateHand([c("5", "S"), c("5", "H"), c("5", "D"), c("9", "C"), c("9", "S")])).toBe(6);
    expect(evaluateHand([c("2", "H"), c("4", "H"), c("6", "H"), c("8", "H"), c("K", "H")])).toBe(5);
    expect(evaluateHand([c("3", "S"), c("4", "D"), c("5", "S"), c("6", "H"), c("7", "C")])).toBe(4);
    expect(evaluateHand([c("8", "S"), c("8", "H"), c("8", "D"), c("2", "C"), c("9", "S")])).toBe(3);
    expect(evaluateHand([c("8", "S"), c("8", "H"), c("6", "D"), c("6", "C"), c("9", "S")])).toBe(2);
    expect(evaluateHand([c("J", "S"), c("J", "H"), c("2", "D"), c("5", "C"), c("9", "S")])).toBe(1);
    expect(evaluateHand([c("T", "S"), c("T", "H"), c("2", "D"), c("5", "C"), c("9", "S")])).toBe(0);
  });
});

describe("grid spins", () => {
  it("always deals 25 unique cards with 25-cell multiplier array", () => {
    reseed(42);
    for (let i = 0; i < 30; i++) {
      const spin = playSpin("base");
      expect(spin.cards).toHaveLength(25);
      expect(spin.multipliers).toHaveLength(25);
      const ids = idsOf(spin.cards);
      expect(new Set(ids).size).toBe(25);
    }
  });

  it("finds the known multi-line win on the fixture board (H1 + D0, shared cell 6)", () => {
    reseed(7);
    // Feed the fixture through evaluateHand on each line — union covers both wins.
    const handIdxs = LINES.map((line) => evaluateHand(line.map((i) => FIXTURE[i])));
    expect(handIdxs).toEqual([0, 1, 0, 0, 0, 9, 0]);
  });

  it("JOB FS guarantees a JoB+ line every spin; FLUSH FS guarantees Flush+ every spin", () => {
    reseed(1234);
    const jobPack = playBonusPackage("job");
    expect(jobPack.spins.length).toBeGreaterThanOrEqual(mathConfig.fsCount);
    expect(jobPack.spins.length).toBeLessThanOrEqual(mathConfig.retrigger.maxFs);
    const jobScale = mathConfig.params.modeScale.bonus_job;
    for (const spin of jobPack.spins) {
      expect((spin.lines ?? []).some((l) => l.handIndex >= 1)).toBe(true);
      expect(spin.spinWinX).toBeGreaterThanOrEqual(roundStakeX(0.25 * jobScale) - 1e-9);
    }
    const flushScale = mathConfig.params.modeScale.bonus_flush;
    for (let i = 0; i < 8; i++) {
      const flushPack = playBonusPackage("flush");
      expect(flushPack.spins.length).toBeGreaterThanOrEqual(mathConfig.fsCount);
      for (const spin of flushPack.spins) {
        expect((spin.lines ?? []).some((l) => l.handIndex >= 5)).toBe(true);
        expect(spin.spinWinX).toBeGreaterThanOrEqual(roundStakeX(1.5 * flushScale) - 1e-9);
      }
    }
  });

  it("standard BONUS is at least 10 FS with no hand floor", () => {
    reseed(2026);
    const pack = playBonusPackage("bonus");
    expect(pack.spins.length).toBeGreaterThanOrEqual(mathConfig.fsCount);
    expect(pack.spins.length).toBeLessThanOrEqual(mathConfig.retrigger.maxFs);
    expect(pack.spins.every((s) => s.mode === "bonus")).toBe(true);
  });

  it("3 goldens during FS retrigger +5 extra spins", () => {
    let found = false;
    for (let s = 0; s < 250; s++) {
      reseed(s * 97 + 3);
      const pack = playBonusPackage("bonus");
      const hit = pack.spins.find((x) => x.goldCount === 3);
      if (!hit) continue;
      expect(hit.retriggerAdd).toBe(5);
      expect(pack.spins.length).toBeGreaterThanOrEqual(mathConfig.fsCount + 5);
      found = true;
      break;
    }
    expect(found).toBe(true);
  });

    it("charges catalog buy/ante prices that are multiples of 5", () => {
    const prices = [
      mathConfig.bonusBuy.bonus.priceUiX,
      mathConfig.bonusBuy.job.priceUiX,
      mathConfig.bonusBuy.flush.priceUiX,
      mathConfig.anteSpin.job.priceUiX,
      mathConfig.anteSpin.flush.priceUiX,
    ];
    expect(prices).toEqual([25, 35, 190, 5, 15]);
    for (const p of prices) expect(p % 5).toBe(0);
    expect(buyBonusPriceX("bonus")).toBe(25);
    expect(buyBonusPrice("bonus", 2)).toBe(50);
  });

  it("paints at most one golden per column", () => {
    reseed(88);
    for (let n = 0; n <= 5; n++) {
      for (let i = 0; i < 40; i++) {
        const painted = paintGolden(playSpin("base").cards, n);
        const cols = painted.flatMap((c, idx) => (c.golden ? [idx % 5] : []));
        expect(cols).toHaveLength(n);
        expect(new Set(cols).size).toBe(n);
      }
    }
  });

  it("a joker is not a poker card: no paying line runs through a joker cell", () => {
    reseed(77);
    for (let n = 1; n <= 5; n++) {
      for (let k = 0; k < 150; k++) {
        const spin = playTriggerSpin(n);
        const jokers = new Set(spin.cards.flatMap((c, i) => (c.golden ? [i] : [])));
        expect(jokers.size).toBe(n);
        for (const line of spin.lines ?? []) {
          expect(line.indices.some((i) => jokers.has(i))).toBe(false);
        }
        for (const i of jokers) expect(spin.multipliers[i]).toBe(0);
      }
    }
  });

  it("columns stop left→right and the reels after the 2nd joker are held longer", () => {
    const blank = [...Array(25)].map(() => ({ rank: "A" as const, suit: "S" as const }));
    const goldOn = (cols: number[]) =>
      blank.map((c, i) => ({ ...c, golden: cols.includes(i % 5) && Math.floor(i / 5) === 0 }));

    const normal = dealDelaysMs(blank, false);
    expect(normal[0]).toBe(reelSpinMs(false));
    expect(normal[1]).toBeGreaterThan(normal[0]);
    expect(normal[1]).toBe(normal[21]); // a column freezes as one piece
    expect(anticipationPlan(blank, false).active).toBe(false);

    const plan = anticipationPlan(goldOn([0, 1]), false);
    expect(plan.active).toBe(true);
    expect(plan.hotCols).toEqual([2, 3, 4]);
    const slow = dealDelaysMs(goldOn([0, 1]), false);
    expect(slow[1]).toBe(normal[1]);
    expect(slow[2]).toBeGreaterThan(normal[2]);
    expect(slow[4] - slow[3]).toBeGreaterThan(normal[4] - normal[3]);

    // 2 jokers only after the last column → nothing left to wait for
    expect(anticipationPlan(goldOn([3, 4]), false).active).toBe(false);
  });

  it("ante spins guarantee their floor line", () => {
    reseed(99);
    for (let i = 0; i < 10; i++) {
      const job = playGuaranteedSpin("job");
      expect((job.lines ?? []).some((l) => l.handIndex >= 1)).toBe(true);
      const flush = playGuaranteedSpin("flush");
      expect((flush.lines ?? []).some((l) => l.handIndex >= 5)).toBe(true);
    }
  });

  it("round result caps at maxWin and reports bonus", () => {
    reseed(555);
    for (let i = 0; i < 40; i++) {
      const round = playRound({ maxWinX: 100 });
      expect(round.cappedWinX).toBeLessThanOrEqual(100);
      if (round.roundWinX > 100) expect(round.isMaxWin).toBe(true);
    }
  });

  it("keeps sub-1× line wins instead of rounding them to 0", () => {
    expect(roundStakeX(0.332)).toBe(0.33);
    expect(roundStakeX(0.11)).toBe(0.11);
    expect(linePayX(1)).toBe(0.25);
    expect(linePayX(1)).toBeLessThan(1);

    reseed(7);
    let fraction = 0;
    for (let i = 0; i < 80; i++) {
      const spin = playSpin("base");
      if (spin.spinWinX > 0 && spin.spinWinX < 1) {
        fraction = spin.spinWinX;
        break;
      }
    }
    expect(fraction).toBeGreaterThan(0);
    expect(fraction).toBe(roundStakeX(fraction));
  });

  it("can match a booked Jacks-or-Better winX on a later deal", () => {
    reseed(3);
    const matched = playUntilWinX(() => playSpin("base"), 0.25, 1500);
    expect(roundStakeX(matched.spinWinX)).toBe(0.25);
  });

  it("snaps a reconstructed bonus package onto the booked ×", () => {
    reseed(11);
    const raw = playBonusPackage("job");
    expect(raw.spins.length).toBeGreaterThan(0);
    const snapped = scalePackageToWinX(raw, 16);
    const sum = snapped.spins.reduce((a, s) => a + s.spinWinX, 0);
    expect(roundStakeX(sum)).toBe(16);
    expect(snapped.totalWinX).toBe(16);
  });
});

function idsOf(cards: Card[]): number[] {
  return ids(cards);
}
