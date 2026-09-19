import cfg from "../mathConfig.json";

export type BonusKind = "bonus" | "job" | "flush";
export type BuyKind = BonusKind;
export type Mode = "base" | BonusKind;
export type Suit = "S" | "H" | "D" | "C";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";

export type Card = { rank: Rank; suit: Suit; golden?: boolean };

/** One paying line of the 5×5 board (debug/UI; never emitted to books). */
export type LineResult = {
  id: number;
  indices: number[];
  handIndex: number;
  handPay: number;
  multFactor: number;
  winX: number;
};

export type SpinResult = {
  mode: Mode;
  /** 25 board cards, index r*5+c (row-major) */
  cards: Card[];
  /** Best winning line's hand index (0 when the spin has no winning line) */
  handIndex: number;
  handName: string;
  handPay: number;
  /** Per-cell multiplier faces, length 25 (0 = no chip; golden cells never carry one) */
  multipliers: number[];
  bankAdd: number;
  multFactor: number;
  spinWinX: number;
  /** How many golden (scatter) cells on this deal */
  goldCount: number;
  /** Extra free spins awarded this spin (3 goldens during FS). */
  retriggerAdd?: number;
  isMaxWin: boolean;
  /** Union of all winning line cells (win outline FX) */
  winIndices: number[];
  /** Per-line breakdown for UI overlays */
  lines?: LineResult[];
};

export type RoundResult = {
  base: SpinResult;
  bonusKind: BonusKind | null;
  freeSpins: SpinResult[];
  bonusBank: number;
  roundWinX: number;
  cappedWinX: number;
  isMaxWin: boolean;
};

const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS: Suit[] = ["S", "H", "D", "C"];
const RANK_VAL: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(Date.now() % 1e9);

export function reseed(seed: number) {
  rng = mulberry32(seed);
}

function rand() {
  return rng();
}

function choiceWeighted<T>(values: T[], weights: number[]): T {
  const sum = weights.reduce((a, b) => a + b, 0);
  let u = rand() * sum;
  for (let i = 0; i < values.length; i++) {
    u -= weights[i];
    if (u <= 0) return values[i];
  }
  return values[values.length - 1];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck;
}

/** Evaluate a 5-card poker hand → paytable index (JoB rules for pairs). */
export function evaluateHand(cards: Card[]): number {
  if (cards.length !== 5) return 0;
  const vals = cards.map((c) => RANK_VAL[c.rank]).sort((a, b) => a - b);
  const suits = cards.map((c) => c.suit);
  const counts = new Map<number, number>();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  const byCount = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const isFlush = suits.every((s) => s === suits[0]);

  const uniq = [...new Set(vals)];
  let isStraight = false;
  if (uniq.length === 5) {
    if (vals[4] - vals[0] === 4) isStraight = true;
    // wheel A-2-3-4-5
    if (vals.join(",") === "2,3,4,5,14") isStraight = true;
  }

  if (isStraight && isFlush) {
    if (vals[0] === 10 && vals[4] === 14) return 9; // Royal
    return 8; // Straight Flush
  }
  if (byCount[0][1] === 4) return 7;
  if (byCount[0][1] === 3 && byCount[1]?.[1] === 2) return 6;
  if (isFlush) return 5;
  if (isStraight) return 4;
  if (byCount[0][1] === 3) return 3;
  if (byCount[0][1] === 2 && byCount[1]?.[1] === 2) return 2;
  if (byCount[0][1] === 2) {
    const pairRank = byCount[0][0];
    if (pairRank >= 11) return 1; // Jacks or Better
  }
  return 0;
}

// ---------------------------------------------------------------------------
// 5×5 board geometry — 25 cards, index r*5+c; exactly 7 paylines
// ---------------------------------------------------------------------------

/** The 7 paylines straight from mathConfig (5 horizontal rows + 2 long diagonals). */
export const LINES: number[][] = Object.values(cfg.lines) as number[][];
const N_CELLS = cfg.grid.rows * cfg.grid.cols;

const LINE_PAY_SCALE = cfg.params.linePayScale ?? 1;
const FLOOR_REROLLS = cfg.params.floorRerolls ?? { job: 25, flush: 800, flush_package: 50 };
const MODE_SCALE = (cfg.params.modeScale ?? {}) as Record<string, number | undefined>;
const RETRIGGER_P = cfg.retrigger?.p ?? 1 / 80;
const RETRIGGER_FS = cfg.retrigger?.extraFs ?? 5;
const RETRIGGER_GOLD = cfg.retrigger?.goldens ?? 3;
const MAX_FS = cfg.retrigger?.maxFs ?? 50;

const JOB_MIN_IDX = 1; // Jacks or Better or better
const FLUSH_MIN_IDX = 5; // Flush or better

/** Part-level win scale — keeps displayed wins equal to paid (booked) wins. */
function modeScaleOf(scaleKey: string): number {
  return MODE_SCALE[scaleKey] ?? 1;
}

/** Books pay in 0.01× (cents of stake-multiple). Never round to a whole ×. */
export function roundStakeX(x: number): number {
  return Math.round((Number(x) || 0) * 100) / 100;
}

/** Face paytable × linePayScale — what one line actually pays before multipliers. */
export function linePayX(handIndex: number): number {
  return roundStakeX((cfg.hands.pays[handIndex] ?? 0) * LINE_PAY_SCALE);
}

/** Game Info paytable — declared hand pays (the rules players see).
    The books are calibrated to these within certification tolerance. */
const LINE_PAY_DECLARED: Record<number, string> = {
  9: "200×",
  8: "20×",
  7: "8×",
  6: "2×",
  5: "1.5×",
  4: "1×",
  3: "0.75×",
  2: "0.5×",
  1: "0.25×",
};

export function formatLinePay(handIndex: number): string {
  return LINE_PAY_DECLARED[handIndex] ?? "0×";
}

function dealBoard(): Card[] {
  return shuffle(fullDeck()).slice(0, N_CELLS);
}

/**
 * Evaluate the 7 lines. A joker (golden / bonus) cell is NOT a poker card:
 * any line that runs through one is dead (hand 0). Mirrors grid_math.eval_board.
 */
function evaluateBoard(cards: Card[], jokers?: ReadonlySet<number>): number[] {
  return LINES.map((line) =>
    line.some((i) => cards[i].golden || jokers?.has(i)) ? 0 : evaluateHand(line.map((i) => cards[i])),
  );
}

/** Golden cell count: 5=flush, 4=job, 3=standard bonus, else tease 0–2. */
export function sampleGoldCount(bonusKind: BonusKind | null): number {
  if (bonusKind === "flush") return 5;
  if (bonusKind === "job") return 4;
  if (bonusKind === "bonus") return 3;
  const u = rand();
  if (u < 0.72) return 0;
  if (u < 0.92) return 1;
  return 2;
}

/** During FS: 3 goldens retrigger, else tease 0–2. */
export function sampleFsGoldCount(): number {
  if (rand() < RETRIGGER_P) return RETRIGGER_GOLD;
  const u = rand();
  if (u < 0.72) return 0;
  if (u < 0.92) return 1;
  return 2;
}

function sampleBonusKind(): BonusKind | null {
  const u = rand();
  const flush = cfg.triggers.flush;
  const job = cfg.triggers.job;
  const bonus = cfg.triggers.bonus ?? 0;
  if (u < flush) return "flush";
  if (u < flush + job) return "job";
  if (u < flush + job + bonus) return "bonus";
  return null;
}

/** Pick N joker cells, at most one per column (rows uniform). */
function pickJokerCells(count: number): Set<number> {
  const n = Math.max(0, Math.min(cfg.grid.cols, Math.floor(count)));
  const set = new Set<number>();
  if (n <= 0) return set;
  const cols = shuffle([...Array(cfg.grid.cols).keys()]).slice(0, n);
  for (const c of cols) {
    const r = Math.floor(rand() * cfg.grid.rows);
    set.add(r * cfg.grid.cols + c);
  }
  return set;
}

/** Paint N golden (joker) cells onto an already-dealt board — cosmetic only. */
export function paintGolden(cards: Card[], count: number): Card[] {
  const set = pickJokerCells(count);
  return cards.map((c, i) => ({ ...c, golden: set.has(i) }));
}

interface MultKnobs {
  chance: number;
  nProbs: number[];
  intensity: number;
}

function multKnobs(klass: string): MultKnobs {
  return {
    chance: cfg.multipliers.chance[klass as keyof typeof cfg.multipliers.chance] ?? 0,
    nProbs: (cfg.multipliers.nProbs[klass as keyof typeof cfg.multipliers.nProbs] as number[]) ?? [1],
    intensity: cfg.multipliers.intensity[klass as keyof typeof cfg.multipliers.intensity] ?? 1,
  };
}

/**
 * Place per-cell multipliers on non-golden cells.
 * Mirrors grid_math.place_multipliers: chance gate → count → faces → cells.
 */
function placeMultipliers(
  klass: string,
  goldenCells: number[],
): { cellMults: number[]; bankAdd: number } {
  const { chance, nProbs, intensity } = multKnobs(klass);
  const cellMults = new Array<number>(N_CELLS).fill(0);
  if (rand() >= chance) return { cellMults, bankAdd: 0 };
  const n = Math.min(1 + choiceWeighted([...Array(nProbs.length).keys()], nProbs), N_CELLS - goldenCells.length);
  if (n <= 0) return { cellMults, bankAdd: 0 };
  const forbidden = new Set(goldenCells);
  const pool = [...Array(N_CELLS).keys()].filter((i) => !forbidden.has(i));
  const chosen = shuffle(pool).slice(0, n);
  let total = 0;
  for (const cell of chosen) {
    const v = choiceWeighted(cfg.multipliers.values, cfg.multipliers.weights);
    cellMults[cell] = v;
    total += v;
  }
  return { cellMults, bankAdd: Math.round(intensity * total) };
}

/**
 * Deal with an optional bonus floor: redeal until ≥1 line reaches
 * `floorIdx` (capped rerolls — the cap is a calibration knob, the last
 * board is accepted as-is when it is exhausted).
 */
function dealWithFloor(
  floorIdx: number | null,
  kind: "job" | "flush",
  jokers?: ReadonlySet<number>,
): Card[] {
  let board = dealBoard();
  if (floorIdx == null) return board;
  const cap = kind === "job" ? FLOOR_REROLLS.job : FLOOR_REROLLS.flush;
  let rerolls = 0;
  while (!evaluateBoard(board, jokers).some((h) => h >= floorIdx) && rerolls < cap) {
    board = dealBoard();
    rerolls++;
  }
  return board;
}

/** Per-line pays/factors for a dealt board. */
function lineResults(
  cards: Card[],
  cellMults: number[],
  bankFactor: number,
): { results: LineResult[]; winX: number } {
  const handIdxs = evaluateBoard(cards);
  const results: LineResult[] = [];
  let winX = 0;
  LINES.forEach((indices, id) => {
    const handIndex = handIdxs[id];
    const handPay = (cfg.hands.pays[handIndex] ?? 0) * LINE_PAY_SCALE;
    if (handPay <= 0) return;
    const rawSum = indices.reduce((a, i) => a + (cellMults[i] || 0), 0);
    const multFactor = Math.max(1, rawSum);
    const lineWin = handPay * multFactor * bankFactor;
    winX += lineWin;
    results.push({ id, indices, handIndex, handPay, multFactor, winX: lineWin });
  });
  return { results, winX };
}

function bestLine(results: LineResult[]): LineResult | null {
  if (results.length === 0) return null;
  return results.reduce((best, r) =>
    r.winX > best.winX || (r.winX === best.winX && r.handIndex > best.handIndex) ? r : best,
  );
}

function payingLineBankAdd(cellMults: number[], results: LineResult[], intensity: number): number {
  const cells = new Set<number>();
  for (const r of results) {
    for (const i of r.indices) {
      if ((cellMults[i] || 0) > 0) cells.add(i);
    }
  }
  let total = 0;
  for (const i of cells) total += cellMults[i];
  return Math.round(intensity * total);
}

function unionCells(results: LineResult[]): number[] {
  const set = new Set<number>();
  for (const r of results) for (const i of r.indices) set.add(i);
  return [...set];
}

interface BoardSpinOpts {
  /** Multiplier draw + intensity class (base / job / flush / ante_job / ante_flush) */
  klass: string;
  /** Bonus floor: redeal until ≥1 line reaches this hand index */
  floorIdx: number | null;
  floorKind: "job" | "flush";
  /** Pre-dealt board (package floors deal boards themselves) */
  board?: Card[];
  /** Golden cells for base spins */
  goldCount?: number;
  /** Accumulated bonus bank BEFORE this spin's own multipliers (FS only) */
  bankBefore?: number;
}

function spinBoard(opts: BoardSpinOpts): {
  cards: Card[];
  cellMults: number[];
  bankAdd: number;
  results: LineResult[];
  winX: number;
} {
  // Jokers are placed first: floors ("≥1 JoB+ / Flush line") count live lines only.
  const jokers = pickJokerCells(opts.goldCount ?? 0);
  const board = opts.board ?? dealWithFloor(opts.floorIdx, opts.floorKind, jokers);
  const cards = board.map((c, i) => ({ ...c, golden: jokers.has(i) }));
  const goldenCells = [...jokers];

  const { cellMults } = placeMultipliers(opts.klass, goldenCells);
  const { results, winX: rawWin } = lineResults(cards, cellMults, 1);
  const intensity = multKnobs(opts.klass).intensity;
  const bankAdd = payingLineBankAdd(cellMults, results, intensity);
  const bank = Math.max(1, (opts.bankBefore ?? 0) + bankAdd);
  const factor = opts.bankBefore != null ? bank : 1;
  if (factor !== 1) {
    for (const r of results) r.winX *= factor;
  }
  return { cards, cellMults, bankAdd, results, winX: rawWin * factor };
}

function buildSpinResult(
  scaleKey: string,
  spin: ReturnType<typeof spinBoard>,
  goldCount: number,
): SpinResult {
  const scale = modeScaleOf(scaleKey);
  const best = bestLine(spin.results);
  return {
    mode:
      scaleKey === "base"
        ? "base"
        : scaleKey === "bonus"
          ? "bonus"
          : scaleKey === "bonus_job"
            ? "job"
            : scaleKey === "bonus_flush"
              ? "flush"
              : "base",
    cards: spin.cards,
    handIndex: best?.handIndex ?? 0,
    handName: cfg.hands.names[best?.handIndex ?? 0],
    handPay: best?.handPay ?? 0,
    multipliers: spin.cellMults,
    bankAdd: spin.bankAdd,
    multFactor: best?.multFactor ?? 1,
    spinWinX: roundStakeX(spin.winX * scale),
    goldCount,
    retriggerAdd: 0,
    isMaxWin: false,
    winIndices: unionCells(spin.results),
    lines: spin.results,
  };
}

export function playSpin(mode: "base"): SpinResult;
export function playSpin(mode: BonusKind, bankBefore?: number): SpinResult;
export function playSpin(mode: Mode, bankBefore?: number): SpinResult {
  if (mode === "base") {
    const spin = spinBoard({ klass: "base", floorIdx: null, floorKind: "job" });
    return buildSpinResult("base", spin, 0);
  }
  if (mode === "bonus") {
    const spin = spinBoard({
      klass: "bonus",
      floorIdx: null,
      floorKind: "job",
      bankBefore: bankBefore ?? 0,
    });
    return buildSpinResult("bonus", spin, 0);
  }
  const spin = spinBoard({
    klass: mode,
    floorIdx: mode === "job" ? JOB_MIN_IDX : FLUSH_MIN_IDX,
    floorKind: mode,
    bankBefore: bankBefore ?? 0,
  });
  return buildSpinResult(`bonus_${mode}`, spin, 0);
}

/** Trigger spin (base round that starts a bonus): `goldCount` jokers, dead lines honoured. */
export function playTriggerSpin(goldCount: number): SpinResult {
  const spin = spinBoard({ klass: "base", floorIdx: null, floorKind: "job", goldCount });
  return buildSpinResult("base", spin, goldCount);
}

/** One paid ante spin: guaranteed JoB+ (job) or Flush+ (flush) line, charged with multipliers. */
export function playGuaranteedSpin(kind: "job" | "flush"): SpinResult {
  const spin = spinBoard({
    klass: `ante_${kind}`,
    floorIdx: kind === "job" ? JOB_MIN_IDX : FLUSH_MIN_IDX,
    floorKind: kind,
  });
  return buildSpinResult(`ante_${kind}`, spin, 0);
}

/**
 * Standard BONUS: 10 FS, no hand floor, multipliers like base.
 * JOB: every spin floored to ≥1 Jacks-or-Better+ line (0.25×).
 * FLUSH: every spin floored to ≥1 Flush-or-better line (1.5×).
 * 3 goldens during any FS add +5 extra spins (capped at maxFs).
 */
export function playBonusPackage(kind: BonusKind): {
  spins: SpinResult[];
  totalWinX: number;
  finalBank: number;
} {
  const spins: SpinResult[] = [];
  let bank = 0;
  let totalWinX = 0;
  let remaining = cfg.fsCount;

  const scaleKey = kind === "bonus" ? "bonus" : `bonus_${kind}`;
  while (remaining > 0 && spins.length < MAX_FS) {
    remaining -= 1;
    const goldCount = sampleFsGoldCount();
    const spin = spinBoard({
      klass: kind === "bonus" ? "bonus" : kind,
      floorIdx: kind === "job" ? JOB_MIN_IDX : kind === "flush" ? FLUSH_MIN_IDX : null,
      floorKind: kind === "flush" ? "flush" : "job",
      goldCount,
      bankBefore: bank,
    });
    bank += spin.bankAdd;
    const extra =
      goldCount >= RETRIGGER_GOLD
        ? Math.min(RETRIGGER_FS, Math.max(0, MAX_FS - (spins.length + 1) - remaining))
        : 0;
    remaining += extra;
    const result = buildSpinResult(scaleKey, spin, goldCount);
    result.retriggerAdd = extra;
    spins.push(result);
    totalWinX += result.spinWinX;
  }
  return { spins, totalWinX, finalBank: bank };
}

/**
 * FLUSH / JOB free spins floor every spin — see spinBoard/dealWithFloor.
 */
export function playRound(opts?: { maxWinX?: number }): RoundResult {
  const cap = opts?.maxWinX ?? cfg.maxWin;
  const bonusKind = sampleBonusKind();
  const goldCount = sampleGoldCount(bonusKind);

  const baseSpin = spinBoard({
    klass: "base",
    floorIdx: null,
    floorKind: "job",
    goldCount,
  });
  const base = buildSpinResult("base", baseSpin, goldCount);

  let freeSpins: SpinResult[] = [];
  let bonusBank = 0;
  let bonusWin = 0;
  if (bonusKind) {
    const pack = playBonusPackage(bonusKind);
    freeSpins = pack.spins;
    bonusBank = pack.finalBank;
    bonusWin = pack.totalWinX;
  }

  const roundWinX = roundStakeX(base.spinWinX + bonusWin);
  const cappedWinX = Math.min(roundWinX, cap);
  return {
    base,
    bonusKind,
    freeSpins,
    bonusBank,
    roundWinX,
    cappedWinX,
    isMaxWin: cappedWinX >= cap - 1e-9,
  };
}

export function buyBonusPrice(kind: BuyKind, bet: number): number {
  return Math.round(cfg.bonusBuy[kind].priceUiX * bet * 100) / 100;
}

export function buyBonusPriceX(kind: BuyKind): number {
  return cfg.bonusBuy[kind].priceUiX;
}

/** Single guaranteed-line spin: priceUiX from mathConfig (JOB 5×, Flush 15×). */
export function guaranteedSpinPriceX(kind: "job" | "flush"): number {
  return cfg.anteSpin[kind].priceUiX;
}

/**
 * Exposure soft-cap for UI max-win display (not a buy lock).
 * Max-bet-cost gates are intentionally NOT applied in FE — Stake configures
 * per-currency limits; buy price is always priceUiX × bet in wallet units.
 */
export const MAX_EXPOSURE = 150_000;

/** Absolute fantasy cap from math; shrinks with stake so Exposure stays legal. */
export function effectiveMaxWinX(bet: number, absMax = cfg.maxWin): number {
  if (!(bet > 0)) return absMax;
  const byExposure = Math.floor(MAX_EXPOSURE / bet);
  return Math.max(1, Math.min(absMax, byExposure));
}

/** @deprecated No FE max-bet-cost gate — always allowed. */
export function isBuyAllowedAtBet(_kind: BuyKind, _bet: number): boolean {
  return true;
}

/** @deprecated No FE max-bet-cost gate — always allowed. */
export function isAnteAllowedAtBet(_kind: "job" | "flush", _bet: number): boolean {
  return true;
}

export function guaranteedSpinPrice(kind: "job" | "flush", bet: number): number {
  return Math.round(guaranteedSpinPriceX(kind) * bet * 100) / 100;
}

/** Deal until the paid × matches a booked RGS result (visuals follow the wallet). */
export function playUntilWinX(deal: () => SpinResult, targetX: number, attempts = 600): SpinResult {
  const t = roundStakeX(targetX);
  let best = deal();
  let bestD = Math.abs(roundStakeX(best.spinWinX) - t);
  if (bestD < 1e-9) return best;
  for (let i = 0; i < attempts; i++) {
    const s = deal();
    const d = Math.abs(roundStakeX(s.spinWinX) - t);
    if (d < 1e-9) return s;
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export type BonusPackage = {
  spins: SpinResult[];
  totalWinX: number;
  finalBank: number;
};

/** Stretch a reconstructed package so its × equals the booked RGS total. */
export function scalePackageToWinX(pack: BonusPackage, targetX: number): BonusPackage {
  const t = roundStakeX(Math.max(0, targetX));
  if (pack.spins.length === 0) return { ...pack, totalWinX: t };
  const sum = pack.totalWinX;
  const k = sum > 0 ? t / sum : 0;
  const spins = pack.spins.map((s) => ({
    ...s,
    spinWinX: roundStakeX(s.spinWinX * k),
    lines: s.lines?.map((l) => ({ ...l, winX: roundStakeX(l.winX * k) })),
  }));
  let acc = 0;
  for (let i = 0; i < spins.length; i++) {
    if (i === spins.length - 1) {
      spins[i] = { ...spins[i], spinWinX: roundStakeX(Math.max(0, t - acc)) };
    } else {
      acc = roundStakeX(acc + spins[i].spinWinX);
    }
  }
  return { ...pack, spins, totalWinX: t };
}

/** Rebuild free-spin packages until the booked × is hit, then snap leftover cents. */
export function playUntilPackageWinX(
  kind: BonusKind,
  targetX: number,
  attempts = 80,
): BonusPackage {
  const t = roundStakeX(targetX);
  let best = playBonusPackage(kind);
  let bestD = Math.abs(roundStakeX(best.totalWinX) - t);
  if (bestD < 1e-9) return best;
  for (let i = 0; i < attempts; i++) {
    const p = playBonusPackage(kind);
    const d = Math.abs(roundStakeX(p.totalWinX) - t);
    if (d < 1e-9) return p;
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return scalePackageToWinX(best, t);
}

export { cfg as mathConfig };
