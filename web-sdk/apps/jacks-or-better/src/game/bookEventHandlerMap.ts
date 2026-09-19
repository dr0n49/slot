import { recordBookEvent, type BookEventHandlerMap } from 'utils-book';
import { stateBet } from 'state-shared';
import { waitForTimeout, waitForResolve } from 'utils-shared/wait';

import {
	clearWinPresentation,
	playWinSequence,
	revealDealHand,
	revealSpeed,
	setDealHandInstant,
} from './cardReveal';
import { casinoAudio } from './casinoAudio';
import { eventEmitter } from './eventEmitter';
import { isCasinoShell } from './liveDevHud';
import { stateGame } from './stateGame.svelte';
import { isHeld } from './constants';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';

const useCardReveal = () => stateGame.liveHold || isCasinoShell();
const skipPlaybackGate = () => stateGame.liveHold || stateGame.liveWalletEnabled;

/**
 * Casino shell (Stake ACP) presentation: the book's hold/draw steps are
 * collapsed so the player sees one deal — the final hand — and its win.
 * There is no double-up in the math; the hand's paytable win is the payout.
 */
const casinoSingleDeal = () => isCasinoShell() && !stateGame.liveWalletEnabled;

const BIG_WIN_CATEGORIES = new Set([
	'Full House',
	'Four of a Kind',
	'Straight Flush',
	'Royal Flush',
]);

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	deal: async (bookEvent: BookEventOfType<'deal'>) => {
		stateGame.roundState = 'initialDeal';
		stateGame.handCategory = '';
		stateGame.handAmount = 0;
		stateGame.showHolds = false;
		stateGame.awaitingDraw = false;
		stateGame.holdMask = 0;
		stateGame.doubleUpSkipped = false;
		stateGame.doubleUpActive = false;
		clearWinPresentation();
		if (casinoSingleDeal()) {
			// Face-down hand; the visible deal happens on `draw` with the final hand.
			stateGame.cards = bookEvent.cards.map(() => ({
				code: '',
				held: false,
				drawing: true,
				instant: false,
				replacing: false,
				winGlow: false,
			}));
			recordBookEvent({ bookEvent });
			return;
		}
		if (useCardReveal()) {
			if (stateBet.isTurbo) {
				setDealHandInstant(bookEvent.cards);
			} else {
				await revealDealHand(bookEvent.cards);
			}
		} else {
			stateGame.cards = bookEvent.cards.map((c) => ({
				code: c.card,
				held: false,
				drawing: false,
			}));
		}
		if (
			stateGame.liveWalletEnabled &&
			stateGame.roundState === 'initialDeal' &&
			!stateGame.liveBonusBuy
		) {
			stateGame.roundState = 'holdSelection';
			stateGame.showHolds = true;
			stateGame.awaitingPlayerHold = true;
		}
		await eventEmitter.broadcastAsync({ type: 'holdSelectionDeal' });
		recordBookEvent({ bookEvent });
	},
	hold: async (bookEvent: BookEventOfType<'hold'>) => {
		stateGame.holdMask = bookEvent.holdMask;
		if (casinoSingleDeal()) {
			stateGame.showHolds = false;
			recordBookEvent({ bookEvent });
			return;
		}
		stateGame.roundState = 'holdSelection';
		stateGame.showHolds = true;
		stateGame.cards = stateGame.cards.map((card, index) => ({
			...card,
			held: isHeld(bookEvent.holdMask, index),
		}));
		if (skipPlaybackGate()) {
			recordBookEvent({ bookEvent });
			return;
		}
		stateGame.awaitingDraw = true;
		await waitForResolve((resolve) => {
			stateGame.continueDraw = resolve;
		});
		stateGame.continueDraw = null;
		stateGame.awaitingDraw = false;
		recordBookEvent({ bookEvent });
	},
	draw: async (bookEvent: BookEventOfType<'draw'>) => {
		stateGame.roundState = 'draw';
		if (casinoSingleDeal()) {
			stateGame.showHolds = false;
			const speed = revealSpeed();
			if (speed === 'turbo') {
				casinoAudio.play('card_deal_turbo');
				setDealHandInstant(bookEvent.finalHand);
			} else {
				await revealDealHand(bookEvent.finalHand, speed);
			}
			recordBookEvent({ bookEvent });
			return;
		}
		if (useCardReveal() && !stateBet.isTurbo) {
			await revealDealHand(bookEvent.finalHand);
		} else {
			setDealHandInstant(bookEvent.finalHand);
		}
		stateGame.cards = bookEvent.finalHand.map((c, index) => ({
			code: c.card,
			held: isHeld(stateGame.holdMask, index),
			drawing: false,
		}));
		await eventEmitter.broadcastAsync({ type: 'holdSelectionDrawDone' });
		recordBookEvent({ bookEvent });
	},
	handResult: async (bookEvent: BookEventOfType<'handResult'>, context) => {
		stateGame.roundState = 'handResult';
		stateGame.doubleUpActive = false;
		if (casinoSingleDeal()) {
			// Book units (100 = 1× bet). Prefer the book's settled total; fall back to the hand win.
			const setTotal = context.bookEvents.find((e) => e.type === 'setTotalWin');
			const finalWin = setTotal?.type === 'setTotalWin' ? setTotal.amount : bookEvent.amount;
			const speed = revealSpeed();
			if (finalWin > 0) {
				stateGame.handCategory = bookEvent.category;
				stateGame.handAmount = finalWin;
				stateBet.winBookEventAmount = finalWin;
				casinoAudio.play(BIG_WIN_CATEGORIES.has(bookEvent.category) ? 'win_big' : 'win_small');
				if (speed === 'turbo') {
					// Instant board: still run a short win beat so count-up isn't skipped entirely.
					stateGame.cards = stateGame.cards.map((c) => ({ ...c, winGlow: true }));
					stateGame.winAnimAmount = finalWin;
					stateGame.winPulse = true;
					await waitForTimeout(220);
				} else {
					// Stagger glow → count-up → pulse. Deal cancels via winSequenceToken.
					await playWinSequence(finalWin);
					if (speed === 'normal') await waitForTimeout(200);
					else if (speed === 'turboAuto') await waitForTimeout(120);
				}
			} else {
				stateGame.handCategory = '';
				stateGame.handAmount = 0;
				// Losing hand: still hold long enough that all five cards (esp. the last)
				// are readable before auto/turbo clears the board for the next deal.
				if (speed === 'normal') await waitForTimeout(550);
				else if (speed === 'turboAuto') await waitForTimeout(500);
				else await waitForTimeout(280);
			}
			stateGame.doubleUpSkipped = true;
			recordBookEvent({ bookEvent });
			return;
		}
		stateGame.handCategory = bookEvent.category;
		stateGame.handAmount = bookEvent.amount;
		if (bookEvent.amount > 0) {
			stateBet.winBookEventAmount = bookEvent.amount;
		}
		stateGame.doubleUpSkipped = bookEvent.amount <= 0;
		await eventEmitter.broadcastAsync({ type: 'holdSelectionHandResult' });
		if (bookEvent.amount > 0 && !stateBet.isTurbo) await waitForTimeout(700);
		recordBookEvent({ bookEvent });
	},
	doubleUp: async (bookEvent: BookEventOfType<'doubleUp'>) => {
		if (casinoSingleDeal()) {
			// Legacy books only (current math emits no doubleUp); never show risk-card UI.
			stateGame.doubleUpActive = false;
			stateGame.doubleUpRevealing = false;
			stateGame.doubleUpRevealed = false;
			stateGame.awaitingDoubleUpReveal = false;
			stateGame.awaitingDoubleUpChoice = false;
			stateGame.doubleUpAmountAfter = bookEvent.amountAfter;
			recordBookEvent({ bookEvent });
			return;
		}
		stateGame.roundState = 'doubleUpRound';
		const atRisk =
			stateGame.doubleUpAmountAfter > 0 ? stateGame.doubleUpAmountAfter : stateGame.handAmount;
		stateGame.doubleUpSkipped = false;
		stateGame.doubleUpActive = true;
		stateGame.doubleUpStep = bookEvent.step;
		stateGame.doubleUpCard = bookEvent.card;
		stateGame.doubleUpColour = bookEvent.colour;
		stateGame.doubleUpCorrect = bookEvent.correct;
		stateGame.doubleUpAmountAtRisk = atRisk;
		stateGame.doubleUpAmountAfter = bookEvent.amountAfter;
		stateGame.doubleUpRevealing = false;
		stateGame.doubleUpRevealed = false;

		if (skipPlaybackGate()) {
			stateGame.awaitingDoubleUpChoice = false;
			stateGame.doubleUpRevealing = true;
			await eventEmitter.broadcastAsync({ type: 'doubleUpRevealStart' });
			await waitForTimeout(220);
			stateGame.doubleUpRevealing = false;
			stateGame.doubleUpRevealed = true;
			if (bookEvent.correct) {
				stateGame.doubleUpAmountAtRisk = bookEvent.amountAfter;
			} else {
				stateGame.doubleUpAmountAtRisk = 0;
			}
			await eventEmitter.broadcastAsync({ type: 'doubleUpRevealDone' });
			await waitForTimeout(500);
			recordBookEvent({ bookEvent });
			return;
		}

		stateGame.awaitingDoubleUpReveal = true;
		await waitForResolve((resolve) => {
			stateGame.continueDoubleUpReveal = resolve;
		});
		stateGame.continueDoubleUpReveal = null;
		stateGame.awaitingDoubleUpReveal = false;
		stateGame.doubleUpRevealing = true;
		await eventEmitter.broadcastAsync({ type: 'doubleUpRevealStart' });
		await waitForTimeout(220);
		stateGame.doubleUpRevealing = false;
		stateGame.doubleUpRevealed = true;
		if (bookEvent.correct) {
			stateGame.doubleUpAmountAtRisk = bookEvent.amountAfter;
		} else {
			stateGame.doubleUpAmountAtRisk = 0;
		}
		await eventEmitter.broadcastAsync({ type: 'doubleUpRevealDone' });
		await waitForTimeout(500);
		recordBookEvent({ bookEvent });
	},
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
		recordBookEvent({ bookEvent });
	},
	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		const hasWin = bookEvent.amount > 0 || stateBet.winBookEventAmount > 0;
		if (casinoSingleDeal()) {
			// Auto-settle: no Collect click. Round end (and balance credit) follows immediately.
			const speed = revealSpeed();
			if (speed === 'normal') {
				if (hasWin) await waitForTimeout(600);
			} else if (speed === 'turboAuto') {
				// Keep autoplay readable — losses need the same beat so card 5 isn't cut off.
				await waitForTimeout(hasWin ? 450 : 400);
			} else if (!hasWin) {
				await waitForTimeout(200);
			}
			stateGame.roundState = 'settled';
			recordBookEvent({ bookEvent });
			return;
		}
		if (hasWin && !skipPlaybackGate()) {
			stateGame.awaitingCollect = true;
			await waitForResolve((resolve) => {
				stateGame.continueCollect = resolve;
			});
			stateGame.continueCollect = null;
			stateGame.awaitingCollect = false;
		}
		stateGame.roundState = 'settled';
		recordBookEvent({ bookEvent });
	},
};
