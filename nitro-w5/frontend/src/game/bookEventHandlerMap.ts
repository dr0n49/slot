import { recordBookEvent, type BookEventHandlerMap } from 'utils-book';
import { stateBet } from 'state-shared';

import { ladderTableFor } from './boardLogic';
import { bookToMoney, formatAmount } from './constants';
import { LADDER, SYMBOLS } from './config';
import { getScene } from './engine/scene';
import { scheduler } from './engine/tween';
import {
	addPopup,
	beat,
	clearPopups,
	countWinTo,
	fastMode,
	isBigWinLevel,
	presentBigWin,
	setWinInstant,
	syncTiming,
	waitForContinue,
	winBannerText,
} from './presentation';
import { roundContext, startSpinContext } from './roundContext';
import { featureOutroHold, planBlast, planStep, planTick, triggerText } from './presentationPlan';
import { beginSpin } from './roundFlow';
import { sfx } from './sfx';
import { hideBanner, setPhase, showBanner, stateGame } from './stateGame.svelte';
import type { BookEvent, BookEventContext, BookEventOfType, Pos } from './typesBookEvent';

/**
 * No module-level round state lives here: everything transient belongs to the round context
 * (see roundContext.ts), which is recreated for every round and therefore cannot survive a
 * round, a base/free switch or an error recovery.
 */

const uniquePositions = (lists: Pos[][]) => {
	const seen = new Set<string>();
	const out: Pos[] = [];
	for (const list of lists) {
		for (const p of list) {
			const key = `${p.reel}:${p.row}`;
			if (!seen.has(key)) {
				seen.add(key);
				out.push(p);
			}
		}
	}
	return out;
};

const showLinePopups = (lines: { pos: Pos[]; text: string }[]) => {
	const scene = getScene();
	if (!scene) return;
	for (const line of lines) {
		const c = scene.board.centroid(line.pos);
		const b = scene.layout.board;
		addPopup(b.x + b.pad + c.x, b.y + b.pad + c.y, line.text, 'win');
	}
};

/** Show any line amounts that were held back for a keg blast. */
const flushPendingLines = () => {
	const ctx = roundContext();
	if (!ctx.pendingLines) return;
	showLinePopups(ctx.pendingLines);
	ctx.pendingLines = null;
};

const guard =
	<T extends BookEvent>(fn: (e: T, ctx: BookEventContext) => Promise<void>) =>
	async (e: T, ctx: BookEventContext) => {
		try {
			syncTiming();
			await fn(e, ctx);
		} catch (error) {
			console.error(`[nitro-vein] presentation of "${e.type}" failed`, error);
			scheduler.finishAll();
		} finally {
			recordBookEvent({ bookEvent: e });
		}
	};

const setLadder = (index: number, steps?: number) => {
	if (steps !== undefined) stateGame.ladderValues = ladderTableFor(steps, stateGame.gameType);
	const prev = stateGame.ladderIndex;
	stateGame.ladderIndex = Math.min(index, stateGame.ladderValues.length - 1);
	if (stateGame.ladderIndex > prev) {
		stateGame.ladderPulse++;
		sfx.ladderUp(stateGame.ladderIndex);
	}
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: guard(async (e: BookEventOfType<'reveal'>) => {
		const scene = getScene();
		startSpinContext(stateGame.totalWin);
		stateGame.gameType = e.gameType;
		if (e.gameType === 'basegame') {
			stateGame.ladderValues = [...LADDER.basegame];
			stateGame.ladderIndex = 0;
			stateGame.ladderBoost = 0;
			stateGame.ladderPayMultiplier = 1;
			stateGame.spinWin = 0;
		}
		if (scene) {
			if (!scene.board.isSpinning) await beginSpin();
			stateGame.anticipating = e.anticipation.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
			await scene.board.reveal(e.board, e.anticipation, { fast: fastMode(), minSpinMs: fastMode() ? 0 : 650 });
			stateGame.kegsOnBoard = scene.board.countSymbol(SYMBOLS.keg);
		}
		stateGame.anticipating = [];
		sfx.stopLoop('spin_loop');
		setPhase('RESOLVING');
	}),

	winInfo: guard(async (e: BookEventOfType<'winInfo'>) => {
		const scene = getScene();
		setPhase('WIN_PRESENTATION');
		stateGame.ladderPayMultiplier = e.ladder.multiplier;
		stateGame.ladderBoost = e.ladder.kegs;
		// the step pays on every rung it passed; the ladder sits on the first of them until
		// the keg blast walks it up
		setLadder(e.ladder.fromIndex);
		const all = uniquePositions(e.wins.map((w) => w.positions));
		scene?.board.highlight(all);
		const ctx = roundContext();
		sfx.winStep(ctx.stepIndex++);
		const lines = e.wins.map((w) => ({
			pos: w.positions,
			text: `+${formatAmount(bookToMoney(w.win))}`,
		}));
		// the blast that follows shows what each rung contributed; the breakdown is the
		// book's, never recomputed here
		ctx.pendingRungs = e.ladder.rungs ?? null;
		const pacing = planStep(e.totalWin, e.ladder.index);
		if (e.ladder.kegs > 0) {
			ctx.pendingLines = lines;
			await beat(320);
			return;
		}
		showLinePopups(lines);
		if (scene && pacing.emphasis > 0) {
			scene.shake(4 + pacing.emphasis * 7, 260 + pacing.emphasis * 200);
			void scene.flash(0xffc46a, 0.14 + pacing.emphasis * 0.2, 260);
		}
		await beat(pacing.hold);
	}),

	/**
	 * K-4: the step walks the rungs the book lists, one tick each, and every one of them is
	 * a real state on screen. The rung list, its multipliers and the total are all taken from
	 * the event — nothing here computes a multiplier or an amount.
	 */
	kegBlast: guard(async (e: BookEventOfType<'kegBlast'>) => {
		const scene = getScene();
		stateGame.ladderBoost = e.toIndex - e.fromIndex;
		sfx.play('fuse');
		if (scene) {
			for (const v of scene.board.positionsToViews(e.positions)) void v.flash();
			await beat(260);
			sfx.play('keg_blast');
			scene.shake(10, 460);
			void scene.flash(0xffa030, 0.42, 420);
			for (const p of e.positions) {
				const s = scene.cellToStage(p.reel, p.row - 1);
				scene.stageParticles.shockwave(s.x, s.y, 1.5, 0xffb060, 640);
				addPopup(s.x, s.y - 26, `×${e.multiplier}`, 'keg');
			}
		}
		// One tick per rung the step passed through, in the order the book gives them, each
		// showing what that rung contributed. Both the rungs and the amounts come from the
		// book events (kegBlast.rungs + winInfo.ladder.rungs) — nothing is derived here.
		const plan = planBlast(e, roundContext().pendingRungs);
		for (const step of plan.steps) {
			setLadder(step.index);
			stateGame.ladderTick = {
				index: step.index,
				multiplier: step.multiplier,
				win: step.win,
				ordinal: step.ordinal,
			};
			const tick = planTick(step, plan.steps.length);
			if (!step.first) sfx.play('mult_tick', { rate: tick.rate });
			await beat(tick.hold);
		}
		stateGame.ladderIndex = e.toIndex;
		stateGame.ladderPayMultiplier = plan.totalMultiplier;
		// the summed multiplier, once the walk has shown how it was reached
		if (plan.multiRung) await beat(240);
		stateGame.ladderTick = null;
		flushPendingLines();
		await beat(plan.multiRung ? 560 : 440);
	}),

	updateTumbleWin: guard(async (e: BookEventOfType<'updateTumbleWin'>) => {
		flushPendingLines();
		stateGame.spinWin = e.amount;
		await countWinTo(roundContext().spinBase + e.amount, fastMode() ? 120 : 420);
	}),

	tumbleBoard: guard(async (e: BookEventOfType<'tumbleBoard'>) => {
		const scene = getScene();
		setPhase('CASCADE');
		stateGame.ladderTick = null;
		clearPopups();
		if (scene) {
			scene.board.clearHighlights();
			await scene.board.explode(e.explodingSymbols, { fast: fastMode() });
			await scene.board.tumble(e.newSymbols, e.explodingSymbols, { fast: fastMode() });
			stateGame.kegsOnBoard = scene.board.countSymbol(SYMBOLS.keg);
		}
		setPhase('RESOLVING');
	}),

	updateLadder: guard(async (e: BookEventOfType<'updateLadder'>) => {
		// The table belongs to the game type, not to the rung count (both tables are the same
		// length), so it is refreshed from the game type and the index is set outright.
		stateGame.ladderValues = ladderTableFor(e.steps, stateGame.gameType);
		stateGame.ladderIndex = Math.min(e.ladderIndex, stateGame.ladderValues.length - 1);
		stateGame.ladderPayMultiplier = e.multiplier;
		stateGame.ladderBoost = 0;
		stateGame.ladderTick = null;
		await beat(140);
	}),

	setWin: guard(async (e: BookEventOfType<'setWin'>) => {
		stateGame.spinWin = e.amount;
		if (stateGame.gameType === 'basegame') {
			await countWinTo(roundContext().spinBase + e.amount, 250);
			if (isBigWinLevel(e.winLevel)) {
				await presentBigWin(e.amount, e.winLevel);
			} else {
				const banner = winBannerText(e.winLevel, e.amount);
				if (banner) {
					const id = showBanner(banner.text, banner.sub, 'win');
					sfx.play('win_total');
					await beat(1100);
					hideBanner(id);
				}
			}
		} else {
			const banner = winBannerText(e.winLevel, e.amount);
			if (banner && !fastMode()) {
				const id = showBanner(banner.text, banner.sub, 'win');
				await beat(800);
				hideBanner(id);
			}
		}
	}),

	setTotalWin: guard(async (e: BookEventOfType<'setTotalWin'>) => {
		stateGame.totalWin = e.amount;
		stateBet.winBookEventAmount = e.amount;
		await countWinTo(e.amount, 250);
		if (stateGame.fsActive) stateGame.fsWin = e.amount;
	}),

	wincap: guard(async (e: BookEventOfType<'wincap'>) => {
		stateGame.totalWin = e.amount;
		stateBet.winBookEventAmount = e.amount;
		await countWinTo(e.amount, 250);
		const scene = getScene();
		scene?.board.clearHighlights();
		await presentBigWin(e.amount, 10);
	}),

	freeSpinTrigger: guard(async (e: BookEventOfType<'freeSpinTrigger'>) => {
		const scene = getScene();
		setPhase('FEATURE');
		sfx.play('fs_trigger');
		scene?.board.highlight(e.positions);
		if (scene) {
			void scene.board.pulseSymbols(SYMBOLS.scatter);
			scene.shake(8, 420);
			void scene.flash(0xffd27a, 0.5, 500);
		}
		const trigger = triggerText(e.positions.length, e.totalFs);
		const id = showBanner(trigger.text, trigger.sub, 'feature');
		await beat(1600);
		hideBanner(id);
		scene?.board.clearHighlights();
		stateGame.featureIntro = { spins: e.totalFs, retrigger: false };
		sfx.play('fs_intro');
		await waitForContinue(4200);
		stateGame.featureIntro = null;
		stateGame.fsActive = true;
		stateGame.fsCurrent = 0;
		stateGame.fsTotal = e.totalFs;
		stateGame.fsWin = stateGame.totalWin;
		stateGame.gameType = 'freegame';
		stateGame.ladderValues = [...LADDER.freegame];
		stateGame.ladderIndex = 0;
		sfx.setMusic('free');
		await scene?.setFeatureMode(true);
	}),

	updateFreeSpin: guard(async (e: BookEventOfType<'updateFreeSpin'>) => {
		setPhase('FEATURE');
		stateGame.fsCurrent = e.amount;
		stateGame.fsTotal = e.total;
		stateGame.gameType = 'freegame';
		clearPopups();
		getScene()?.board.clearHighlights();
		await beat(300);
		if (!getScene()?.board.isSpinning) await beginSpin();
	}),

	freeSpinRetrigger: guard(async (e: BookEventOfType<'freeSpinRetrigger'>) => {
		const scene = getScene();
		const added = e.totalFs - stateGame.fsTotal;
		sfx.play('fs_retrigger');
		scene?.board.highlight(e.positions);
		if (scene) {
			void scene.board.pulseSymbols(SYMBOLS.scatter);
			void scene.flash(0xffd27a, 0.4, 420);
		}
		stateGame.fsTotal = e.totalFs;
		const id = showBanner(`+${added} FREE SPINS`, `${e.totalFs} IN TOTAL`, 'feature');
		await beat(1500);
		hideBanner(id);
		scene?.board.clearHighlights();
	}),

	freeSpinEnd: guard(async (e: BookEventOfType<'freeSpinEnd'>) => {
		const scene = getScene();
		setPhase('FEATURE');
		sfx.stopAllLoops();
		stateGame.fsWin = e.amount;
		await countWinTo(stateGame.totalWin, 300);
		if (isBigWinLevel(e.winLevel)) {
			await presentBigWin(e.amount, e.winLevel, { title: 'FREE SPINS' });
		}
		stateGame.featureOutro = { amount: e.amount, spins: stateGame.fsTotal, level: e.winLevel };
		sfx.play('fs_outro');
		// a feature that ended big stays up a little longer before the player is sent back
		await waitForContinue(featureOutroHold(e.winLevel));
		stateGame.featureOutro = null;
		stateGame.fsActive = false;
		stateGame.gameType = 'basegame';
		stateGame.ladderValues = [...LADDER.basegame];
		stateGame.ladderIndex = 0;
		sfx.setMusic('base');
		await scene?.setFeatureMode(false);
	}),

	finalWin: guard(async (e: BookEventOfType<'finalWin'>) => {
		stateBet.winBookEventAmount = e.amount;
		stateGame.totalWin = e.amount;
		setWinInstant(e.amount);
		setPhase('COMPLETE');
	}),
};

