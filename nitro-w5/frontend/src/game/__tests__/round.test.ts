import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { beforeEach, describe, expect, it } from 'vitest';

import { GAME } from '../config';
import { clearRoundContext, roundContext, startRoundContext, startSpinContext } from '../roundContext';
import { resolveBook } from '../roundResult';
import type { BookEvent } from '../typesBookEvent';

/**
 * W2 contract: the maths of a round is known before anything is animated, and no
 * presentation state survives a round.
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

describe('round context', () => {
	beforeEach(() => startRoundContext(1));

	it('starts every round from a clean slate', () => {
		const ctx = roundContext();
		ctx.stepIndex = 7;
		ctx.spinBase = 500;
		ctx.pendingLines = [{ pos: [{ reel: 0, row: 0 }], text: '+1.00' }];

		startRoundContext(2);
		const next = roundContext();
		expect(next.token).toBe(2);
		expect(next.stepIndex).toBe(0);
		expect(next.spinBase).toBe(0);
		expect(next.pendingLines).toBeNull();
	});

	it('resets the per-spin scratch when a new spin starts inside the same round', () => {
		const ctx = roundContext();
		ctx.stepIndex = 4;
		ctx.pendingLines = [{ pos: [], text: '+0.50' }];

		startSpinContext(1200);
		expect(ctx.token).toBe(1); // still the same round
		expect(ctx.stepIndex).toBe(0);
		expect(ctx.pendingLines).toBeNull();
		expect(ctx.spinBase).toBe(1200);
	});

	it('leaves nothing behind after a recovery', () => {
		const ctx = roundContext();
		ctx.stepIndex = 3;
		ctx.pendingLines = [{ pos: [], text: '+9.99' }];
		clearRoundContext();
		expect(roundContext().stepIndex).toBe(0);
		expect(roundContext().pendingLines).toBeNull();
	});
});

describe('resolveBook', () => {
	it('never throws and returns a usable result for an empty book', () => {
		const r = resolveBook([]);
		expect(r.totalWin).toBe(0);
		expect(r.hasFeature).toBe(false);
		expect(r.board).toBeNull();
		expect(r.eventCount).toBe(0);
	});

	it('reads the win level and the feature out of the events', () => {
		const events = [
			{ index: 0, type: 'setWin', amount: 500, winLevel: 6 },
			{ index: 1, type: 'freeSpinTrigger', totalFs: 10, positions: [] },
			{ index: 2, type: 'freeSpinRetrigger', totalFs: 15, positions: [] },
			{ index: 3, type: 'setTotalWin', amount: 4200 },
			{ index: 4, type: 'finalWin', amount: 4200 },
		] as unknown as BookEvent[];
		const r = resolveBook(events);
		expect(r.totalWin).toBe(4200);
		expect(r.winLevel).toBe(6);
		expect(r.hasFeature).toBe(true);
		expect(r.featureSpins).toBe(15);
		expect(r.hasWincap).toBe(false);
	});

	it('flags a win cap and forces the top presentation level', () => {
		const events = [
			{ index: 0, type: 'setWin', amount: 10, winLevel: 3 },
			{ index: 1, type: 'wincap', amount: 1_000_000 },
			{ index: 2, type: 'finalWin', amount: 1_000_000 },
		] as unknown as BookEvent[];
		const r = resolveBook(events);
		expect(r.hasWincap).toBe(true);
		expect(r.winLevel).toBe(10);
		expect(r.totalWin).toBe(1_000_000);
	});

	describe.skipIf(!available)('against real math-SDK books', () => {
		const books = available ? load() : [];

		it('agrees with the locked payout of every sampled book', () => {
			for (const b of books) {
				const r = resolveBook(b.events);
				expect(r.totalWin).toBe(b.payoutMultiplier);
			}
		});

		it('folds a complete board of the right geometry for every book', () => {
			for (const b of books) {
				const r = resolveBook(b.events);
				expect(r.board).not.toBeNull();
				expect(r.board).toHaveLength(GAME.numReels);
				for (const col of r.board!) expect(col).toHaveLength(GAME.paddedRows);
			}
		});

		it('sees a feature exactly when the book contains one', () => {
			for (const b of books) {
				const r = resolveBook(b.events);
				const hasTrigger = b.events.some((e) => e.type === 'freeSpinTrigger');
				expect(r.hasFeature).toBe(hasTrigger);
			}
		});

		it('resolves a book without needing a scene, in a fraction of the presentation time', () => {
			const start = performance.now();
			for (const b of books) resolveBook(b.events);
			// the whole library resolves in well under a second: the maths of a round never
			// waits on rendering
			expect(performance.now() - start).toBeLessThan(5000);
		});
	});
});
