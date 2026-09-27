import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';
import { PUBLIC_CHROMATIC } from 'envs';

import { foldBoard } from './boardLogic';
import { requestSkip } from './presentation';
import { startRoundTempo } from './presentationPlan';
import { bookEventHandlerMap } from './bookEventHandlerMap';
import { getScene } from './engine/scene';
import { eventEmitter } from './eventEmitter';
import { endRound, recoverFromError, settleToResult } from './roundFlow';
import { resolveBook } from './roundResult';
import { stateGame } from './stateGame.svelte';
import type { Bet, BookEvent } from './typesBookEvent';

export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });

/**
 * A book must open with a reveal and close with a finalWin. Anything else is an invalid
 * response — we refuse to animate a half book (that would show a fake / partial outcome).
 */
export const validateBook = (events: unknown): events is BookEvent[] => {
	if (!Array.isArray(events) || events.length === 0) return false;
	const first = events[0] as BookEvent;
	const last = events[events.length - 1] as BookEvent;
	return first?.type === 'reveal' && last?.type === 'finalWin';
};

/** Instant application of already-played events (resume of a finished / partly played round). */
export const applyEventsInstant = (events: BookEvent[]) => {
	const names = foldBoard(events);
	let total = 0;
	for (const e of events) {
		if (e.type === 'setTotalWin' || e.type === 'finalWin' || e.type === 'wincap') total = e.amount;
	}
	stateBet.winBookEventAmount = total;
	stateGame.totalWin = total;
	stateGame.displayWin = total;
	const apply = () => {
		const scene = getScene();
		if (scene && names) scene.board.setBoard(names.map((col) => col.map((name) => ({ name }))));
	};
	if (getScene()) apply();
	else {
		// scene still loading — apply as soon as it is there
		const timer = setInterval(() => {
			if (getScene()) {
				clearInterval(timer);
				apply();
			}
		}, 100);
		setTimeout(() => clearInterval(timer), 15000);
	}
};

const payoutMatchesLocked = (bet: Bet) => {
	const locked = bet.payoutMultiplier ?? 0;
	const uiX = stateBet.winBookEventAmount / 100;
	if (locked > 0 && Math.abs(uiX - locked) > 0.011 && Math.abs(uiX - locked / 100) > 0.011) {
		console.error('[nitro-vein] displayed win diverged from the locked payout', { uiX, locked });
	}
};

/**
 * How long a whole round may spend on screen before the presentation is considered stuck.
 * First the animation is fast-forwarded; if that does not finish it either, the round is
 * settled straight from the already-known result. The maths never waits for any of this.
 *
 * The bound clears the longest legitimate round by a wide margin: the worst feature in the
 * published library is ~115 events (ten free spins with cascades), which is well inside 90 s on
 * real hardware even when the player never taps and every continue gate waits out its timeout.
 */
const PRESENTATION_SKIP_AFTER_MS = 90_000;
const PRESENTATION_ABANDON_AFTER_MS = 120_000;

/** Run the presentation, but never let it hold the round open forever. */
const presentWithWatchdog = async (events: BookEvent[]) => {
	startRoundTempo();
	let skipTimer: ReturnType<typeof setTimeout> | undefined;
	let abandonTimer: ReturnType<typeof setTimeout> | undefined;
	const token = stateGame.roundToken;
	const abandoned = new Promise<'abandoned'>((resolve) => {
		skipTimer = setTimeout(() => {
			if (stateGame.roundToken !== token) return;
			console.warn('[nitro-vein] presentation is slow — fast-forwarding');
			requestSkip();
		}, PRESENTATION_SKIP_AFTER_MS);
		abandonTimer = setTimeout(() => {
			if (stateGame.roundToken !== token) return;
			console.error('[nitro-vein] presentation abandoned — settling from the book result');
			resolve('abandoned');
		}, PRESENTATION_ABANDON_AFTER_MS);
	});
	try {
		return await Promise.race([playBookEvents(events).then(() => 'played' as const), abandoned]);
	} finally {
		clearTimeout(skipTimer);
		clearTimeout(abandonTimer);
	}
};

export const playBet = async (bet: Bet & { id?: number }) => {
	stateGame.lockedPayoutMultiplier = bet.payoutMultiplier ?? 0;
	if (PUBLIC_CHROMATIC) {
		stateGame.sourceLabel = `Generated book${bet.id != null ? ` id ${bet.id}` : ''} — payoutMultiplier ${bet.payoutMultiplier}`;
	}
	if (!validateBook(bet.state)) {
		// Nothing sensible can be shown: recover, then let the engine close the round (end-round).
		recoverFromError('Invalid round data received from the server.');
		await endRound();
		eventEmitter.broadcast({ type: 'stopButtonEnable' });
		return;
	}
	// The outcome is read off the book here, before a single frame is drawn. From this point
	// the round is decided; everything below is replay.
	const result = resolveBook(bet.state);
	stateGame.roundResult = result;

	try {
		const how = await presentWithWatchdog(bet.state);
		if (how === 'abandoned') settleToResult(result);
		payoutMatchesLocked(bet);
	} catch (error) {
		recoverFromError('The round could not be displayed.', bet.state);
		console.error(error);
	}
	await endRound();
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
};

/**
 * Resume from `/bet/event` index only. Replays the remaining events; never changes the payout
 * or any book outcome. Events before the resume index are applied instantly.
 */
export const convertTorResumableBet = (betToResume: Bet) => {
	const resumingIndex = Number(betToResume.event);
	if (!betToResume.event || Number.isNaN(resumingIndex)) return betToResume;
	const before = betToResume.state.filter((_, i) => i < resumingIndex);
	const after = betToResume.state.filter((_, i) => i >= resumingIndex);
	applyEventsInstant(before);
	return { ...betToResume, state: after };
};
