import { stateBet } from 'state-shared';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import { normaliseActiveMode, resetBuyBetModeIfNeeded } from './betModes';
import { beginSpin, recoverFromError } from './roundFlow';
import { stateGameDerived } from './stateGame.svelte';
import type { Bet, BookEvent } from './typesBookEvent';
import { convertTorResumableBet, applyEventsInstant, playBet } from './utils';

const primaryMachines = createPrimaryMachines<Bet>({
	onResumeGameActive: (betToResume) => convertTorResumableBet(betToResume),
	onResumeGameInactive: (betToResume) => {
		applyEventsInstant(betToResume.state as BookEvent[]);
	},
	onNewGameStart: async () => {
		stateBet.winBookEventAmount = 0;
		stateGameDerived.resetRound();
		normaliseActiveMode();
		// reels start spinning right away; the RGS answer is awaited while they move
		void beginSpin();
	},
	onNewGameError: () => {
		// A rejected bonus buy must not leave the buy mode armed for the next spin.
		resetBuyBetModeIfNeeded();
		recoverFromError('The spin could not be placed. Please try again.');
	},
	onPlayGame: async (bet) => await playBet(bet),
	// FS rounds stay open until the end-round call that runs after the presentation (endGame).
	checkIsBonusGame: (bet) =>
		Boolean(bet.active) || bet.state?.some((e: BookEvent) => e.type === 'freeSpinTrigger'),
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);
