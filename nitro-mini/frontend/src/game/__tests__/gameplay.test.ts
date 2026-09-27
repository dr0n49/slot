import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { beforeEach, describe, expect, it } from 'vitest';

import { LADDER } from '../config';
import {
	featureOutroHold,
	isCelebrationTier,
	planBlast,
	planStep,
	planTick,
	tierForLevel,
	triggerText,
} from '../presentationPlan';
import { clearRoundContext, roundContext, startRoundContext, startSpinContext } from '../roundContext';
import { resolveBook } from '../roundResult';
import type { BookEvent } from '../typesBookEvent';

/**
 * W5 contract: the presentation replays what the book already decided, in the right order,
 * once each — and never works an outcome out for itself.
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

describe('K-4 blast plan', () => {
	it('walks every rung the book lists, in order, exactly once', () => {
		const blast = {
			rungs: [
				{ index: 1, multiplier: 2 },
				{ index: 2, multiplier: 3 },
				{ index: 3, multiplier: 5 },
			],
			multiplier: 10,
			fromIndex: 1,
			toIndex: 3,
			nextIndex: 4,
		};
		const breakdown = [
			{ index: 1, multiplier: 2, win: 20 },
			{ index: 2, multiplier: 3, win: 30 },
			{ index: 3, multiplier: 5, win: 50 },
		];
		const plan = planBlast(blast, breakdown);
		expect(plan.steps.map((s) => s.index)).toEqual([1, 2, 3]);
		expect(plan.steps.map((s) => s.multiplier)).toEqual([2, 3, 5]);
		expect(plan.steps.map((s) => s.win)).toEqual([20, 30, 50]);
		expect(plan.steps.map((s) => s.ordinal)).toEqual([1, 2, 3]);
		expect(plan.steps[0].first).toBe(true);
		expect(plan.steps[2].last).toBe(true);
		expect(plan.multiRung).toBe(true);
	});

	it('takes the total multiplier from the event and never sums it itself', () => {
		// a deliberately inconsistent event: the plan must report what the book says
		const plan = planBlast(
			{ rungs: [{ index: 0, multiplier: 1 }, { index: 1, multiplier: 2 }], multiplier: 99, fromIndex: 0, toIndex: 1, nextIndex: 2 },
			null,
		);
		expect(plan.totalMultiplier).toBe(99);
		expect(plan.nextIndex).toBe(2);
	});

	it('is safe with no breakdown and with a single rung', () => {
		const plan = planBlast(
			{ rungs: [{ index: 4, multiplier: 10 }], multiplier: 10, fromIndex: 4, toIndex: 4, nextIndex: 5 },
			null,
		);
		expect(plan.steps).toHaveLength(1);
		expect(plan.steps[0].win).toBe(0);
		expect(plan.multiRung).toBe(false);
		expect(plan.steps[0].first && plan.steps[0].last).toBe(true);
	});

	it('ticks get a rising pitch and never a negative hold', () => {
		const plan = planBlast(
			{
				rungs: [0, 1, 2, 3].map((i) => ({ index: i, multiplier: LADDER.basegame[i] })),
				multiplier: 11,
				fromIndex: 0,
				toIndex: 3,
				nextIndex: 4,
			},
			null,
		);
		const ticks = plan.steps.map((s) => planTick(s, plan.steps.length));
		expect(ticks.every((t) => t.hold > 0)).toBe(true);
		for (let i = 1; i < ticks.length; i++) expect(ticks[i].rate).toBeGreaterThan(ticks[i - 1].rate);
	});
});

describe('cascade pacing', () => {
	it('keeps an ordinary step short and gives a big one more room', () => {
		const ordinary = planStep(30, 0);
		const notable = planStep(300, 0);
		const huge = planStep(5000, 0);
		expect(ordinary.emphasis).toBe(0);
		expect(notable.hold).toBeGreaterThan(ordinary.hold);
		expect(huge.hold).toBeGreaterThan(notable.hold);
	});

	it('gives a deep rung emphasis even when the amount is small', () => {
		expect(planStep(10, 0).emphasis).toBe(0);
		expect(planStep(10, 5).emphasis).toBeGreaterThan(0);
		expect(planStep(10, 6).emphasis).toBeGreaterThanOrEqual(planStep(10, 5).emphasis);
	});
});

describe('win tiers', () => {
	it('maps the book win level onto a tier without reinterpreting the amount', () => {
		expect(tierForLevel(1)).toBe('normal');
		expect(tierForLevel(5)).toBe('normal');
		expect(tierForLevel(6)).toBe('big');
		expect(tierForLevel(7)).toBe('mega');
		expect(tierForLevel(8)).toBe('massive');
		expect(tierForLevel(10)).toBe('max');
		expect(isCelebrationTier(tierForLevel(5))).toBe(false);
		expect(isCelebrationTier(tierForLevel(6))).toBe(true);
	});
});

describe('feature wording', () => {
	it('spells out the one scatter count the frozen rules produce', () => {
		expect(triggerText(3, 10)).toEqual({ text: '3 SCATTERS', sub: '10 FREE SPINS' });
	});

	it('names no number for a count the rules cannot produce', () => {
		// defence in depth: the books never carry these, and if one ever did the banner
		// must not advertise a trigger the game does not have
		expect(triggerText(4, 14).text).toBe('SCATTERS');
		expect(triggerText(5, 18).text).toBe('SCATTERS');
		expect(triggerText(2, 10).text).toBe('SCATTERS');
	});

	it('still prints the book spin count verbatim', () => {
		expect(triggerText(4, 14).sub).toBe('14 FREE SPINS');
	});

	it('holds the feature outro longer after a celebrated win', () => {
		expect(featureOutroHold(5)).toBe(4200);
		expect(featureOutroHold(6)).toBeGreaterThan(featureOutroHold(5));
		expect(featureOutroHold(10)).toBeGreaterThan(featureOutroHold(5));
	});
});

describe('round context does not leak between phases', () => {
	beforeEach(() => startRoundContext(1));

	it('drops a held rung breakdown when a new spin starts', () => {
		const ctx = roundContext();
		ctx.pendingRungs = [{ index: 0, multiplier: 1, win: 10 }];
		startSpinContext(0);
		expect(ctx.pendingRungs).toBeNull();
	});

	it('drops a held rung breakdown on recovery', () => {
		roundContext().pendingRungs = [{ index: 2, multiplier: 3, win: 30 }];
		clearRoundContext();
		expect(roundContext().pendingRungs).toBeNull();
	});
});

describe.skipIf(!available)('against the published books', () => {
	const books = available ? load() : [];

	it('every kegBlast can be planned, and its walk matches the winInfo it pays for', () => {
		let checked = 0;
		for (const b of books) {
			let lastRungs: { index: number; multiplier: number; win: number }[] | null = null;
			for (const e of b.events) {
				if (e.type === 'winInfo') {
					lastRungs = e.ladder.rungs;
					// the breakdown always adds up to what the step paid
					expect(e.ladder.rungs.reduce((s, r) => s + r.win, 0)).toBe(e.totalWin);
					// and it is a contiguous run ending on the paying rung
					const idx = e.ladder.rungs.map((r) => r.index);
					expect(idx[0]).toBe(e.ladder.fromIndex);
					expect(idx[idx.length - 1]).toBe(e.ladder.index);
					for (let i = 1; i < idx.length; i++) expect(idx[i]).toBe(idx[i - 1] + 1);
				} else if (e.type === 'kegBlast') {
					const plan = planBlast(e, lastRungs);
					expect(plan.steps.length).toBe(e.rungs.length);
					expect(plan.steps.map((s) => s.index)).toEqual(e.rungs.map((r) => r.index));
					expect(plan.totalMultiplier).toBe(e.multiplier);
					// no rung is visited twice
					expect(new Set(plan.steps.map((s) => s.index)).size).toBe(plan.steps.length);
					// the amounts shown never exceed the step that is being paid
					const shown = plan.steps.reduce((s, x) => s + x.win, 0);
					if (lastRungs) expect(shown).toBe(lastRungs.reduce((s, r) => s + r.win, 0));
					checked++;
				}
			}
		}
		expect(checked).toBeGreaterThan(50);
	});

	it('never announces a scatter count or a spin count the frozen rules cannot produce', () => {
		const trigger = Object.entries(LADDER).length; // keeps the import honest
		expect(trigger).toBeGreaterThan(0);
		for (const b of books) {
			for (const e of b.events) {
				if (e.type === 'freeSpinTrigger') {
					expect(e.positions.length).toBe(3);
					expect(e.totalFs).toBe(10);
				} else if (e.type === 'freeSpinRetrigger') {
					expect(e.positions.length).toBe(3);
					expect(e.totalFs % 5).toBe(0);
				}
			}
		}
	});

	it('cascade events stay in the order the presentation depends on', () => {
		for (const b of books) {
			let awaitingTumble = false;
			for (const e of b.events) {
				if (e.type === 'winInfo') {
					expect(awaitingTumble).toBe(false); // no second win before the board tumbled
					awaitingTumble = true;
				} else if (e.type === 'kegBlast') {
					expect(awaitingTumble).toBe(true); // a blast always belongs to a win
				} else if (e.type === 'tumbleBoard') {
					awaitingTumble = false;
				}
			}
		}
	});

	it('the resolved result equals the final settlement of every book', () => {
		for (const b of books) {
			const r = resolveBook(b.events);
			expect(r.totalWin).toBe(b.payoutMultiplier);
			if (r.hasFeature) expect(r.featureSpins % 5).toBe(0);
		}
	});
});
