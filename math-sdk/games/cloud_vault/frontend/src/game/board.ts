/**
 * Board model mirroring the SDK tumble (src/calculations/tumble.py) with padding:
 * each reel is [top padding, row0..row4, bottom padding]. Book positions in reveal /
 * winInfo / tumbleBoard / freeSpinTrigger are PADDED rows (1..5); game events
 * (rowsBanked, haloExtraSpins) use visible rows 0..4.
 */

export type Cell = { id: number; sym: string; drop: number; win?: boolean; pop?: boolean };
export type Reel = { top: string; cells: Cell[]; bottom: string };

let nextId = 1;
const cell = (sym: string, drop: number): Cell => ({ id: nextId++, sym, drop });

type SymJson = { name: string };

export function fromReveal(board: SymJson[][], stagger = true): Reel[] {
  return board.map((col, r) => ({
    top: col[0].name,
    bottom: col[col.length - 1].name,
    cells: col.slice(1, -1).map((s) => cell(s.name, stagger ? 6 + r * 0.6 : 0)),
  }));
}

export function markWins(reels: Reel[], positions: { reel: number; row: number }[]): Reel[] {
  const hit = new Set(positions.map((p) => `${p.reel}:${p.row - 1}`));
  return reels.map((reel, r) => ({
    ...reel,
    cells: reel.cells.map((c, w) => (hit.has(`${r}:${w}`) ? { ...c, win: true } : { ...c, win: false })),
  }));
}

export function popWins(reels: Reel[], exploding: { reel: number; row: number }[]): Reel[] {
  const hit = new Set(exploding.map((p) => `${p.reel}:${p.row - 1}`));
  return reels.map((reel, r) => ({
    ...reel,
    cells: reel.cells.map((c, w) => (hit.has(`${r}:${w}`) ? { ...c, pop: true } : c)),
  }));
}

/**
 * Apply a tumbleBoard event. For a reel with k exploding cells the SDK emits
 * newSymbols = [new top padding, n_(k-1) … n_1]; the column becomes
 * [n_(k-1) … n_1, old top padding, survivors…].
 */
export function applyTumble(
  reels: Reel[],
  exploding: { reel: number; row: number }[],
  newSymbols: SymJson[][],
): Reel[] {
  return reels.map((reel, r) => {
    const gone = new Set(exploding.filter((p) => p.reel === r).map((p) => p.row - 1));
    if (!gone.size) return { ...reel, cells: reel.cells.map((c) => ({ ...c, win: false, drop: 0 })) };
    const fresh = newSymbols[r] ?? [];
    const k = gone.size;
    const survivors: Cell[] = [];
    reel.cells.forEach((c, w) => {
      if (gone.has(w)) return;
      // Survivors fall by the number of gaps below them.
      const fall = [...gone].filter((g) => g > w).length;
      survivors.push({ ...c, win: false, pop: false, drop: fall });
    });
    const incoming = [...fresh.slice(1).map((s) => s.name), reel.top].map((sym) => cell(sym, k));
    return { top: fresh[0]?.name ?? reel.top, bottom: reel.bottom, cells: [...incoming, ...survivors] };
  });
}

export const settle = (reels: Reel[]): Reel[] =>
  reels.map((reel) => ({ ...reel, cells: reel.cells.map((c) => ({ ...c, drop: 0, win: false, pop: false })) }));
