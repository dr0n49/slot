import { GAME, LADDER } from './config';
import type { BookEvent, BookSymbol, Pos } from './typesBookEvent';

/**
 * Pure board bookkeeping. Mirrors the math engine's tumble exactly:
 *
 *   new padded column = newSymbols[reel] ++ (old padded column without the exploded rows)
 *
 * Kept free of any Pixi / Svelte dependency so it can be unit-tested and used for instant
 * resume without an animation layer.
 */
export type Names = string[][];

export const namesFromReveal = (board: BookSymbol[][]): Names => board.map((col) => col.map((s) => s.name));

export const applyTumbleNames = (names: Names, newSymbols: BookSymbol[][], exploding: Pos[]): Names => {
	const next: Names = [];
	for (let reel = 0; reel < names.length; reel++) {
		const rows = new Set(exploding.filter((p) => p.reel === reel).map((p) => p.row));
		const incoming = (newSymbols[reel] ?? []).map((s) => s.name);
		const col = incoming.concat(names[reel].filter((_, row) => !rows.has(row)));
		if (col.length !== GAME.paddedRows) {
			throw new Error(`invalid tumble on reel ${reel}: ${col.length} rows`);
		}
		next.push(col);
	}
	return next;
};

/**
 * The ladder table of a game type. The book's `steps` is only a sanity check: the two tables
 * can be the same length, so the game type — not the length — decides which one is in play.
 */
export const ladderTableFor = (steps: number, gameType: 'basegame' | 'freegame'): number[] => {
	const table = LADDER[gameType];
	if (steps !== table.length) {
		const other = gameType === 'basegame' ? LADDER.freegame : LADDER.basegame;
		if (steps === other.length) {
			console.warn(`[nitro-vein] ladder of ${steps} rungs does not match ${gameType}`);
		}
	}
	return [...table];
};

/** Fold a list of events into the final padded board (used by instant resume and tests). */
export const foldBoard = (events: readonly BookEvent[]): Names | null => {
	let names: Names | null = null;
	for (const e of events) {
		if (e.type === 'reveal') names = namesFromReveal(e.board);
		else if (e.type === 'tumbleBoard' && names) names = applyTumbleNames(names, e.newSymbols, e.explodingSymbols);
	}
	return names;
};
