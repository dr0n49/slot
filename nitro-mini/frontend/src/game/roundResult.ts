import { foldBoard, type Names } from './boardLogic';
import type { BookEvent } from './typesBookEvent';

/**
 * The outcome of a round, derived from the book **before anything is animated**.
 *
 * The book is the whole truth: the RGS has already decided and locked the payout, so every
 * number here is known the moment the response arrives. Presentation is a replay of a result
 * that already exists — if it stalls, crashes or is skipped, the round can be settled from
 * this object without asking anything else.
 */
export type RoundResult = {
	/** Final win in book units (multiples of the bet x100). */
	totalWin: number;
	/** Win level the book asks the UI to present (1..10). */
	winLevel: number;
	/** The round contains a free-spin feature. */
	hasFeature: boolean;
	/** The round hit the win cap. */
	hasWincap: boolean;
	/** Number of spins the feature awarded (0 when there is none). */
	featureSpins: number;
	/** Padded board after the last cascade, or null when the book cannot be folded. */
	board: Names | null;
	/** Number of book events, for diagnostics. */
	eventCount: number;
};

/**
 * Read a whole book and produce its result. Pure: no scene, no state, no side effects.
 * Never throws on a malformed book — callers decide what to do with a partial result.
 */
export const resolveBook = (events: readonly BookEvent[]): RoundResult => {
	let totalWin = 0;
	let winLevel = 1;
	let hasFeature = false;
	let hasWincap = false;
	let featureSpins = 0;

	for (const e of events) {
		switch (e.type) {
			case 'setTotalWin':
			case 'finalWin':
				totalWin = e.amount;
				break;
			case 'wincap':
				totalWin = e.amount;
				hasWincap = true;
				break;
			case 'setWin':
				winLevel = Math.max(winLevel, e.winLevel);
				break;
			case 'freeSpinTrigger':
				hasFeature = true;
				featureSpins = Math.max(featureSpins, e.totalFs);
				break;
			case 'freeSpinRetrigger':
				featureSpins = Math.max(featureSpins, e.totalFs);
				break;
			case 'freeSpinEnd':
				winLevel = Math.max(winLevel, e.winLevel);
				break;
		}
	}
	if (hasWincap) winLevel = 10;

	let board: Names | null = null;
	try {
		board = foldBoard(events);
	} catch (error) {
		// A book whose tumbles do not add up is a server problem; the caller falls back to
		// the last board it managed to render rather than showing a broken grid.
		console.error('[nitro-vein] could not fold the final board', error);
	}

	return { totalWin, winLevel, hasFeature, hasWincap, featureSpins, board, eventCount: events.length };
};
