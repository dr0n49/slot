import { describe, expect, it } from 'vitest';

import { applyTumbleNames, foldBoard, ladderTableFor, namesFromReveal } from '../boardLogic';
import { GAME, LADDER } from '../config';
import type { BookEvent, BookSymbol } from '../typesBookEvent';

const sym = (name: string): BookSymbol => ({ name });
const column = (...names: string[]) => names.map(sym);
const pad = (...names: string[]) => {
	if (names.length !== GAME.paddedRows) throw new Error('test column must have paddedRows symbols');
	return names;
};

describe('applyTumbleNames', () => {
	it('drops exploded rows and prepends the new symbols (SDK tumble rule)', () => {
		const before = [
			pad('L1', 'L2', 'L3', 'L4', 'L5', 'H1', 'H2', 'H3'),
			...Array.from({ length: GAME.numReels - 1 }, () => pad('R', 'R', 'R', 'R', 'R', 'R', 'R', 'R')),
		];
		const after = applyTumbleNames(
			before,
			[column('W', 'K'), ...Array.from({ length: GAME.numReels - 1 }, () => [])],
			[
				{ reel: 0, row: 2 },
				{ reel: 0, row: 5 },
			],
		);
		expect(after[0]).toEqual(['W', 'K', 'L1', 'L2', 'L4', 'L5', 'H2', 'H3']);
		expect(after[1]).toEqual(before[1]);
	});

	it('rejects a tumble that does not keep every column at paddedRows', () => {
		const before = Array.from({ length: GAME.numReels }, () => pad('L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1'));
		expect(() =>
			applyTumbleNames(before, before.map(() => []), [{ reel: 0, row: 0 }]),
		).toThrow(/invalid tumble/);
	});
});

describe('ladderTableFor', () => {
	it('picks the table by game type, not by rung count', () => {
		// both tables are the same length, so only the game type can decide
		expect(ladderTableFor(LADDER.basegame.length, 'basegame')).toEqual(LADDER.basegame);
		expect(ladderTableFor(LADDER.freegame.length, 'freegame')).toEqual(LADDER.freegame);
		expect(ladderTableFor(LADDER.freegame.length, 'basegame')).toEqual(LADDER.basegame);
		expect(ladderTableFor(3, 'freegame')).toEqual(LADDER.freegame);
	});
});

describe('foldBoard', () => {
	it('folds reveal + tumbles into the final padded board', () => {
		const rock = Array.from({ length: GAME.numReels }, () => column(...pad('R', 'R', 'R', 'R', 'R', 'R', 'R', 'R')));
		const events = [
			{ type: 'reveal', board: rock, paddingPositions: [], gameType: 'basegame', anticipation: [] },
			{
				type: 'tumbleBoard',
				newSymbols: rock.map(() => column('L1')),
				explodingSymbols: rock.map((_, reel) => ({ reel, row: 7 })),
			},
		] as unknown as BookEvent[];
		const names = foldBoard(events)!;
		expect(names).toHaveLength(GAME.numReels);
		expect(names[0]).toEqual(['L1', 'R', 'R', 'R', 'R', 'R', 'R', 'R']);
		expect(namesFromReveal(rock)[0]).toHaveLength(GAME.paddedRows);
	});

	it('returns null when there is nothing to fold', () => {
		expect(foldBoard([])).toBeNull();
	});
});
