import { stateBet } from 'state-shared';

import { foldBoard, type Names } from './boardLogic';
import { getScene } from './engine/scene';
import { scheduler } from './engine/tween';
import { clearPopups, clearSkip, fastMode, releaseContinue, setWinInstant, syncTiming } from './presentation';
import { sfx } from './sfx';
import { clearRoundContext } from './roundContext';
import type { RoundResult } from './roundResult';
import { setPhase, stateGame, stateGameDerived } from './stateGame.svelte';
import type { BookEvent } from './typesBookEvent';

/** Reels start moving the instant the bet is placed (before the RGS answered). */
export const beginSpin = async () => {
	syncTiming();
	setPhase('SPINNING');
	clearPopups();
	sfx.unlock();
	sfx.play('spin_start');
	sfx.startLoop('spin_loop');
	const scene = getScene();
	if (!scene) return;
	scene.board.clearHighlights();
	await scene.board.startSpin(fastMode());
};

/** Round finished normally: settle the phase machine back to IDLE. */
export const endRound = async () => {
	sfx.stopAllLoops();
	clearSkip();
	// already back at IDLE (an error recovery got there first): nothing left to settle
	if (stateGame.phase === 'IDLE') return;
	setPhase('COMPLETE');
	await new Promise((r) => setTimeout(r, stateBet.isTurbo ? 0 : 120));
	setPhase('IDLE');
};

/** Put the board on screen without animating anything. */
const showBoard = (names: Names | null) => {
	const scene = getScene();
	if (!scene) return;
	try {
		if (names) {
			scene.board.setBoard(names.map((col) => col.map((name) => ({ name }))));
		} else if (scene.board.names.length) {
			// restore the last known board (a spin that never resolved must not leave blank reels)
			scene.board.setBoard(scene.board.names.map((col) => col.map((name) => ({ name }))));
		} else {
			scene.board.showIdle();
		}
	} catch (error) {
		console.error(error);
		scene.board.showIdle();
	}
};

/**
 * Jump straight to the round's known outcome.
 *
 * Used when the presentation could not finish (stalled, crashed, or was abandoned by the
 * watchdog). The result was read off the book before anything was drawn, so settling here
 * never invents a number: it shows the same board and the same win the animation would have
 * arrived at.
 */
export const settleToResult = (result: RoundResult) => {
	scheduler.cancelAll();
	// a gate still waiting on the player would otherwise hold the abandoned round open
	releaseContinue();
	sfx.stopAllLoops();
	clearRoundContext();
	showBoard(result.board);
	getScene()?.board.clearHighlights();
	stateGame.totalWin = result.totalWin;
	stateGame.spinWin = 0;
	stateBet.winBookEventAmount = result.totalWin;
	setWinInstant(result.totalWin);
	stateGame.bigWin = null;
	stateGame.featureIntro = null;
	stateGame.featureOutro = null;
	stateGame.awaitingContinue = false;
	stateGame.fsActive = false;
	stateGame.gameType = 'basegame';
	clearPopups();
	void getScene()?.setFeatureMode(false);
	syncTiming();
};

/**
 * Something went wrong (failed spin, invalid response, presentation crash). Never leaves the
 * game stuck: stop animations, restore a valid board and return to IDLE so the player can
 * spin again. The RGS round itself is closed by the engine's end-round call.
 */
export const recoverFromError = (message: string, events?: readonly BookEvent[]) => {
	console.error('[nitro-vein] recovering:', message);
	scheduler.cancelAll();
	releaseContinue();
	sfx.stopAllLoops();
	// The book's own outcome wins over anything half-drawn; fall back to folding the events
	// only when the round never got as far as resolving a result.
	const known = stateGame.roundResult;
	const names = known?.board ?? (events ? foldBoard(events) : null);
	showBoard(names);
	void getScene()?.setFeatureMode(false);
	if (known) {
		stateGame.totalWin = known.totalWin;
		stateBet.winBookEventAmount = known.totalWin;
	}
	stateGame.error = { message };
	stateGameDerived.recover();
	setWinInstant(known ? known.totalWin : stateGame.displayWin);
	syncTiming();
};
