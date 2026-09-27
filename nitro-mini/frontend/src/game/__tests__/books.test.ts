import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { foldBoard } from '../boardLogic';
import { GAME, SYMBOLS } from '../config';
import type { BookEvent } from '../typesBookEvent';

/**
 * Contract tests: every sampled math-SDK book must be something the frontend can play.
 * The books come from `math-sdk/games/nitro_vein/export_mock_books.py`; when that file has
 * not been generated yet the suite is skipped rather than failing.
 */
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../dev/mock-books.json.gz');
const available = fs.existsSync(file);
type Book = { id: number; payoutMultiplier: number; events: BookEvent[] };
const load = (): Book[] => {
	const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf-8'));
	const out: Book[] = [];
	for (const m of Object.values<{ natural: Book[]; qa: Record<string, Book[]> }>(data.modes)) {
		out.push(...m.natural, ...Object.values(m.qa).flat());
	}
	return out;
};

describe.skipIf(!available)('math-sdk books', () => {
	const books = available ? load() : [];
	const known = new Set<string>(SYMBOLS.all);

	it('has books to test', () => {
		expect(books.length).toBeGreaterThan(100);
	});

	it('opens with reveal, closes with finalWin, and finalWin equals the payout', () => {
		for (const b of books) {
			expect(b.events[0].type).toBe('reveal');
			const last = b.events[b.events.length - 1];
			expect(last.type).toBe('finalWin');
			expect((last as { amount: number }).amount).toBe(b.payoutMultiplier);
		}
	});

	it('pays in whole 0.01x steps and never above the wincap', () => {
		for (const b of books) {
			// payoutMultiplier is in hundredths of the bet: 0.01x is the payout resolution
			expect(Number.isInteger(b.payoutMultiplier)).toBe(true);
			expect(b.payoutMultiplier).toBeGreaterThanOrEqual(0);
			expect(b.payoutMultiplier).toBeLessThanOrEqual(GAME.wincap * 100);
		}
	});

	it('every board is 5 x 8 padded rows of known symbols, and tumbles fold cleanly', () => {
		const problems: string[] = [];
		for (const b of books) {
			let names: string[][] | null = null;
			try {
				names = foldBoard(b.events);
			} catch (error) {
				problems.push(`book ${b.id}: ${(error as Error).message}`);
				continue;
			}
			if (!names || names.length !== GAME.numReels) problems.push(`book ${b.id}: no board`);
			else if (names.some((col) => col.length !== GAME.paddedRows || col.some((n) => !known.has(n))))
				problems.push(`book ${b.id}: bad board`);
		}
		expect(problems).toEqual([]);
	}, 60_000);

	it('every tumble is preceded by a win and the running win never decreases', () => {
		for (const b of books) {
			let lastWin = -1;
			let sawWin = false;
			for (const e of b.events) {
				if (e.type === 'winInfo') sawWin = true;
				if (e.type === 'tumbleBoard') expect(sawWin).toBe(true);
				if (e.type === 'tumbleBoard') sawWin = false;
				if (e.type === 'setTotalWin') {
					expect(e.amount).toBeGreaterThanOrEqual(lastWin);
					lastWin = e.amount;
				}
			}
		}
	});

	it('free spin counters are 1-based and in range', () => {
		for (const b of books) {
			for (const e of b.events) {
				if (e.type === 'updateFreeSpin') {
					expect(e.amount).toBeGreaterThanOrEqual(1);
					expect(e.amount).toBeLessThanOrEqual(e.total);
				}
			}
		}
	});
});
