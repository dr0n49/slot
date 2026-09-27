import { beforeEach, describe, expect, it, vi } from 'vitest';

import { scheduler, tween, wait } from '../engine/tween';
import { beat, clearSkip, releaseContinue, requestSkip, waitForContinue } from '../presentation';
import { endRound, recoverFromError, settleToResult } from '../roundFlow';
import { roundContext } from '../roundContext';
import type { RoundResult } from '../roundResult';
import { setPhase, stateGame, stateGameDerived, type Phase } from '../stateGame.svelte';

/**
 * W5 regression: a player who taps skip, or a presentation that dies, must always leave the
 * round on the outcome the book already fixed — never on a half-drawn one, never stuck.
 */

/** Drive the scheduler like the render loop does, until nothing is pending. */
const pump = async (frames = 200) => {
	for (let i = 0; i < frames && scheduler.pending; i++) {
		scheduler.step(16);
		await Promise.resolve();
	}
	await Promise.resolve();
};

const result = (over: Partial<RoundResult> = {}): RoundResult => ({
	totalWin: 1234,
	winLevel: 6,
	hasFeature: false,
	hasWincap: false,
	featureSpins: 0,
	board: null,
	eventCount: 12,
	...over,
});

const illegal = () => stateGame.illegalTransitions;

beforeEach(() => {
	scheduler.cancelAll();
	scheduler.skip = false;
	scheduler.speed = 1;
	stateGame.phase = 'IDLE';
	stateGame.illegalTransitions = 0;
	stateGameDerived.resetRound();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('skip never strands the presentation', () => {
	const phases: { name: string; phase: Phase; arrange: () => void }[] = [
		{
			name: 'ladder animation',
			phase: 'WIN_PRESENTATION',
			arrange: () => {
				stateGame.ladderTick = { index: 2, multiplier: 3, win: 300, ordinal: 2 };
			},
		},
		{
			name: 'a keg blast',
			phase: 'WIN_PRESENTATION',
			arrange: () => {
				roundContext().pendingRungs = [{ index: 0, multiplier: 1, win: 100 }];
				stateGame.ladderTick = { index: 0, multiplier: 1, win: 100, ordinal: 1 };
			},
		},
		{
			name: 'a cascade',
			phase: 'CASCADE',
			arrange: () => {
				roundContext().pendingLines = [{ pos: [{ reel: 0, row: 0 }], text: '1.00' }];
				roundContext().stepIndex = 3;
			},
		},
		{
			name: 'a feature transition',
			phase: 'FEATURE',
			arrange: () => {
				stateGame.fsActive = true;
				stateGame.fsCurrent = 1;
				stateGame.fsTotal = 10;
				stateGame.gameType = 'freegame';
			},
		},
	];

	for (const c of phases) {
		it(`during ${c.name}: every pending wait resolves and the round still closes`, async () => {
			setPhase('SPINNING');
			setPhase(c.phase === 'FEATURE' ? 'FEATURE' : 'RESOLVING');
			if (c.phase !== 'FEATURE') setPhase(c.phase);
			c.arrange();

			let finished = false;
			const presentation = (async () => {
				await beat(900);
				await wait(1200);
				await beat(700);
				finished = true;
			})();

			// one frame in, the player taps skip
			scheduler.step(16);
			requestSkip();
			expect(stateGame.skip).toBe(true);
			expect(scheduler.skip).toBe(true);

			await pump();
			await presentation;
			expect(finished).toBe(true);

			await endRound();
			expect(stateGame.phase).toBe('IDLE');
			expect(stateGame.skip).toBe(false);
			expect(scheduler.pending).toBe(0);
			expect(illegal()).toBe(0);
		});
	}

	it('is refused while a big win or a feature card owns the screen', () => {
		setPhase('SPINNING');
		setPhase('RESOLVING');
		stateGame.bigWin = { tier: 'big', level: 6, amount: 5000, shown: 0, done: false };
		requestSkip();
		expect(stateGame.skip).toBe(false);

		stateGame.bigWin = null;
		stateGame.featureIntro = { spins: 10, retrigger: false };
		requestSkip();
		expect(stateGame.skip).toBe(false);

		stateGame.featureIntro = null;
		requestSkip();
		expect(stateGame.skip).toBe(true);
		clearSkip();
	});

	it('is refused when the game is idle', () => {
		stateGame.phase = 'IDLE';
		requestSkip();
		expect(stateGame.skip).toBe(false);
	});
});

describe('recovery lands on the book result', () => {
	it('mid-feature: drops feature state and shows the known total', () => {
		setPhase('SPINNING');
		setPhase('FEATURE');
		const known = result({ totalWin: 4321, hasFeature: true, featureSpins: 10, winLevel: 5 });
		stateGame.roundResult = known;
		stateGame.gameType = 'freegame';
		stateGame.fsActive = true;
		stateGame.fsCurrent = 4;
		stateGame.fsTotal = 10;
		stateGame.displayWin = 999;
		stateGame.ladderTick = { index: 3, multiplier: 5, win: 500, ordinal: 1 };
		roundContext().pendingRungs = [{ index: 3, multiplier: 5, win: 500 }];

		recoverFromError('boom');

		expect(stateGame.phase).toBe('IDLE');
		expect(stateGame.totalWin).toBe(4321);
		expect(stateGame.displayWin).toBe(4321);
		expect(stateGame.ladderTick).toBeNull();
		expect(roundContext().pendingRungs).toBeNull();
		expect(stateGame.featureIntro).toBeNull();
		expect(stateGame.featureOutro).toBeNull();
		expect(stateGame.error?.message).toBe('boom');
		expect(stateGame.skip).toBe(false);
	});

	it('during a big win: tears the overlay down and keeps the real amount', () => {
		setPhase('SPINNING');
		setPhase('RESOLVING');
		const known = result({ totalWin: 250_000, winLevel: 8 });
		stateGame.roundResult = known;
		stateGame.bigWin = { tier: 'mega', level: 8, amount: 250_000, shown: 98_000, done: false };
		stateGame.awaitingContinue = true;
		stateGame.displayWin = 98_000;
		void wait(5000);

		recoverFromError('crash during big win');

		expect(stateGame.bigWin).toBeNull();
		expect(stateGame.awaitingContinue).toBe(false);
		// the partly counted amount never survives: the book's total does
		expect(stateGame.displayWin).toBe(250_000);
		expect(stateGame.totalWin).toBe(250_000);
		expect(scheduler.pending).toBe(0);
		expect(stateGame.phase).toBe('IDLE');
	});

	it('without a resolved result, keeps what is on screen rather than inventing a total', () => {
		setPhase('SPINNING');
		stateGame.roundResult = null;
		stateGame.displayWin = 777;
		recoverFromError('no result yet');
		expect(stateGame.displayWin).toBe(777);
		expect(stateGame.phase).toBe('IDLE');
	});
});

describe('forced settlement', () => {
	it('settles the watchdog outcome and lets the round close cleanly afterwards', async () => {
		setPhase('SPINNING');
		setPhase('RESOLVING');
		setPhase('CASCADE');
		const known = result({ totalWin: 8888, hasFeature: true, featureSpins: 10 });
		stateGame.roundResult = known;
		stateGame.gameType = 'freegame';
		stateGame.fsActive = true;
		stateGame.spinWin = 120;
		stateGame.ladderTick = { index: 1, multiplier: 2, win: 200, ordinal: 1 };
		roundContext().pendingLines = [{ pos: [{ reel: 1, row: 1 }], text: '2.00' }];
		void wait(9000);

		settleToResult(known);

		expect(stateGame.totalWin).toBe(8888);
		expect(stateGame.displayWin).toBe(8888);
		expect(stateGame.spinWin).toBe(0);
		expect(stateGame.fsActive).toBe(false);
		expect(stateGame.gameType).toBe('basegame');
		expect(roundContext().pendingLines).toBeNull();
		expect(scheduler.pending).toBe(0);

		await endRound();
		expect(stateGame.phase).toBe('IDLE');
		expect(illegal()).toBe(0);
	});

	it('closing a round twice is harmless', async () => {
		setPhase('SPINNING');
		await endRound();
		expect(stateGame.phase).toBe('IDLE');
		await endRound();
		expect(stateGame.phase).toBe('IDLE');
		expect(illegal()).toBe(0);
	});

	it('a recovery followed by the normal close does not re-enter COMPLETE', async () => {
		setPhase('SPINNING');
		setPhase('RESOLVING');
		recoverFromError('late failure');
		expect(stateGame.phase).toBe('IDLE');
		await endRound();
		expect(stateGame.phase).toBe('IDLE');
		expect(illegal()).toBe(0);
	});
});

describe('the continue gate never outlives its round', () => {
	it('resolves at once when the round is already being fast-forwarded', async () => {
		setPhase('SPINNING');
		setPhase('RESOLVING');
		stateGame.skip = true;
		let done = false;
		await waitForContinue(60_000).then(() => {
			done = true;
		});
		expect(done).toBe(true);
		expect(stateGame.awaitingContinue).toBe(false);
		clearSkip();
	});

	it('a skip releases a gate that is already waiting', async () => {
		setPhase('SPINNING');
		setPhase('RESOLVING');
		let done = false;
		const gate = waitForContinue(60_000).then(() => {
			done = true;
		});
		expect(stateGame.awaitingContinue).toBe(true);
		requestSkip();
		await gate;
		expect(done).toBe(true);
		clearSkip();
	});

	it('opening a new gate releases the previous one instead of stacking', async () => {
		setPhase('SPINNING');
		setPhase('RESOLVING');
		let first = false;
		const a = waitForContinue(60_000).then(() => {
			first = true;
		});
		const b = waitForContinue(60_000);
		await a;
		expect(first).toBe(true);
		releaseContinue();
		await b;
		expect(stateGame.awaitingContinue).toBe(false);
	});

	it('a forced settlement releases a gate waiting on the player', async () => {
		setPhase('SPINNING');
		setPhase('FEATURE');
		const known = result({ totalWin: 500 });
		stateGame.roundResult = known;
		let done = false;
		const gate = waitForContinue(60_000).then(() => {
			done = true;
		});
		settleToResult(known);
		await gate;
		expect(done).toBe(true);
		expect(stateGame.awaitingContinue).toBe(false);
	});

	it('a recovery releases a gate waiting on the player', async () => {
		setPhase('SPINNING');
		setPhase('FEATURE');
		stateGame.roundResult = result({ totalWin: 500 });
		let done = false;
		const gate = waitForContinue(60_000).then(() => {
			done = true;
		});
		recoverFromError('gate must not hold the round');
		await gate;
		expect(done).toBe(true);
		expect(stateGame.awaitingContinue).toBe(false);
	});
});

describe('a broken animation cannot strand the presentation', () => {
	it('drops the failing job and still resolves every other one', async () => {
		let good = false;
		let poisonedSettled = false;

		void scheduler
			.add(100, () => {
				throw new Error('destroyed sprite');
			})
			.then(() => {
				poisonedSettled = true;
			});
		const healthy = wait(100).then(() => {
			good = true;
		});

		await pump();
		await healthy;
		expect(good).toBe(true);
		expect(poisonedSettled).toBe(true);
		expect(scheduler.pending).toBe(0);
	});

	it('a tween whose target was destroyed mid-flight resolves instead of throwing', async () => {
		// PixiJS nulls `scale` on destroy; the tween must notice and stop quietly
		const sprite: Record<string, unknown> = { scale: { x: 1, set(v: number) { (this as { x: number }).x = v; } }, alpha: 1 };
		let settled = false;
		const t = tween(sprite as never, { scaleXY: 2 }, 200).then(() => {
			settled = true;
		});
		scheduler.step(16);
		sprite.scale = null; // destroyed underneath the running tween
		await pump();
		await t;
		expect(settled).toBe(true);
		expect(scheduler.pending).toBe(0);
	});
});

describe('phase table', () => {
	it('counts an impossible transition instead of silently taking it', () => {
		stateGame.phase = 'IDLE';
		setPhase('CASCADE'); // IDLE may only go to SPINNING or ERROR
		expect(illegal()).toBe(1);
	});

	it('accepts the transitions a real round makes', () => {
		stateGame.phase = 'IDLE';
		const round: Phase[] = [
			'SPINNING',
			'RESOLVING',
			'WIN_PRESENTATION',
			'CASCADE',
			'RESOLVING',
			'FEATURE',
			'SPINNING',
			'RESOLVING',
			'WIN_PRESENTATION',
			'COMPLETE',
			'IDLE',
		];
		for (const p of round) setPhase(p);
		expect(illegal()).toBe(0);
	});
});
