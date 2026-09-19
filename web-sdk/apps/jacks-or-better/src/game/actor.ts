import { stateBet } from 'state-shared';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import { resetBuyBetModeIfNeeded } from './betModes';
import type { Bet } from './typesBookEvent';
import { playBet, convertTorResumableBet, applyEventsInstant } from './utils';
import { stateGame, stateGameDerived } from './stateGame.svelte';

const primaryMachines = createPrimaryMachines<Bet>({
	onResumeGameActive: (betToResume) => convertTorResumableBet(betToResume),
	onResumeGameInactive: (betToResume) => {
		applyEventsInstant(betToResume.state);
	},
	onNewGameStart: async () => {
		stateBet.winBookEventAmount = 0;
		stateGameDerived.resetRound();
		stateGame.roundState = 'betPlaced';
	},
	onNewGameError: () => {
		// A rejected bonus buy must not leave the buy mode armed for the next DEAL.
		resetBuyBetModeIfNeeded();
		stateGameDerived.resetRound();
		stateGame.roundState = 'error';
	},
	onPlayGame: async (bet) => await playBet(bet),
	// auto_close_disabled: wins stay open until Collect, then /wallet/end-round in endGame (bonusWin).
	checkIsBonusGame: (bet) => Boolean(bet.active) || (bet.payoutMultiplier ?? 0) > 0,
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);
