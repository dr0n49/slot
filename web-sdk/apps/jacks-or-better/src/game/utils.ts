import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';
import { PUBLIC_CHROMATIC } from 'envs';

import { eventEmitter } from './eventEmitter';
import type { Bet, BookEvent } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';
import { isHeld } from './constants';
import { stateGame } from './stateGame.svelte';

export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });

const applyEventInstant = (bookEvent: BookEvent) => {
	if (bookEvent.type === 'deal') {
		stateGame.cards = bookEvent.cards.map((c) => ({
			code: c.card,
			held: false,
			drawing: false,
		}));
		stateGame.roundState = 'initialDeal';
		return;
	}
	if (bookEvent.type === 'hold') {
		stateGame.holdMask = bookEvent.holdMask;
		stateGame.showHolds = true;
		stateGame.cards = stateGame.cards.map((card, index) => ({
			...card,
			held: isHeld(bookEvent.holdMask, index),
		}));
		stateGame.roundState = 'holdSelection';
		return;
	}
	if (bookEvent.type === 'draw') {
		stateGame.cards = bookEvent.finalHand.map((c, index) => ({
			code: c.card,
			held: isHeld(stateGame.holdMask, index),
			drawing: false,
		}));
		stateGame.roundState = 'draw';
		return;
	}
	if (bookEvent.type === 'handResult') {
		stateGame.handCategory = bookEvent.category;
		stateGame.handAmount = bookEvent.amount;
		stateGame.doubleUpSkipped = bookEvent.amount <= 0;
		stateGame.roundState = 'handResult';
		return;
	}
	if (bookEvent.type === 'doubleUp') {
		stateGame.doubleUpActive = true;
		stateGame.doubleUpSkipped = false;
		stateGame.doubleUpStep = bookEvent.step;
		stateGame.doubleUpCard = bookEvent.card;
		stateGame.doubleUpColour = bookEvent.colour;
		stateGame.doubleUpCorrect = bookEvent.correct;
		stateGame.doubleUpAmountAfter = bookEvent.amountAfter;
		stateGame.doubleUpAmountAtRisk = bookEvent.amountAfter;
		stateGame.doubleUpRevealed = true;
		stateGame.doubleUpRevealing = false;
		stateGame.roundState = 'doubleUpRound';
		return;
	}
	if (bookEvent.type === 'setTotalWin') {
		stateBet.winBookEventAmount = bookEvent.amount;
		return;
	}
	if (bookEvent.type === 'finalWin') {
		stateGame.roundState = 'settled';
	}
};

export const applyEventsInstant = (bookEvents: BookEvent[]) => {
	for (const bookEvent of bookEvents) applyEventInstant(bookEvent);
};

const payoutAsX = (locked: number, amountCents: number) => {
	const fromEventX = amountCents / 100;
	if (locked === amountCents) return fromEventX;
	if (locked > fromEventX * 10) return locked / 100;
	return locked;
};

const payoutMatchesLocked = (bet: Bet) => {
	const setTotal = [...bet.state].reverse().find((event) => event.type === 'setTotalWin');
	if (setTotal?.type === 'setTotalWin' && stateBet.winBookEventAmount !== setTotal.amount) {
		console.error('UI win amount diverged from setTotalWin', {
			ui: stateBet.winBookEventAmount,
			setTotalWin: setTotal.amount,
		});
	}
	const locked = bet.payoutMultiplier ?? 0;
	const uiX = payoutAsX(locked, stateBet.winBookEventAmount);
	const lockedX = payoutAsX(locked, setTotal?.type === 'setTotalWin' ? setTotal.amount : stateBet.winBookEventAmount);
	if (Math.abs(uiX - lockedX) > 1e-6) {
		console.error('Locked payoutMultiplier diverged from book / UI win', {
			payoutMultiplier: locked,
			uiWin: stateBet.winBookEventAmount,
			setTotalWin: setTotal?.type === 'setTotalWin' ? setTotal.amount : undefined,
		});
	}
};

export const toPlayableBet = (
	book: { id: number; payoutMultiplier: number; events: BookEvent[] },
	extra?: { event?: string; active?: boolean },
): Bet & { id: number } =>
	({
		id: book.id,
		payoutMultiplier: book.payoutMultiplier,
		state: book.events,
		active: extra?.active ?? book.payoutMultiplier > 0,
		event: extra?.event,
		mode: 'base',
	}) as Bet & { id: number };

export const playBet = async (bet: Bet & { id?: number }) => {
	stateGame.lockedPayoutMultiplier = bet.payoutMultiplier ?? 0;
	if (stateGame.roundState === 'idle' || stateGame.roundState === 'settled' || stateGame.roundState === 'error' || stateGame.roundState === 'timeout') {
		stateBet.winBookEventAmount = 0;
		stateGame.roundState = 'betPlaced';
	}
	if (PUBLIC_CHROMATIC) {
		const resumeNote = bet.event ? ` — resume /bet/event index ${bet.event}` : '';
		stateGame.sourceLabel = `Generated book${bet.id != null ? ` id ${bet.id}` : ''} — payoutMultiplier ${bet.payoutMultiplier} (not mocked)${resumeNote}`;
	}
	await playBookEvents(bet.state);
	payoutMatchesLocked(bet);
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
};

/**
 * Resume from `/bet/event` index only. Replays remaining events; does not change
 * payoutMultiplier or any book outcome. Events before the resume index are
 * applied instantly so the board matches the locked book.
 */
export const convertTorResumableBet = (betToResume: Bet) => {
	const resumingIndex = Number(betToResume.event);
	if (!betToResume.event || Number.isNaN(resumingIndex)) return betToResume;

	const bookEventsBeforeResume = betToResume.state.filter((_, eventIndex) => eventIndex < resumingIndex);
	const bookEventsAfterResume = betToResume.state.filter((_, eventIndex) => eventIndex >= resumingIndex);

	applyEventsInstant(bookEventsBeforeResume);

	return { ...betToResume, state: bookEventsAfterResume };
};
