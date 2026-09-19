import { stateBet } from 'state-shared';

export type CardView = {
	code: string;
	held: boolean;
	drawing: boolean;
	/** Skip CSS 3D flip transition (turbo / instant board). */
	instant?: boolean;
	/** Fade/slide-out before a replace flip (draw). */
	replacing?: boolean;
	/** Per-card win glow during the win sequence. */
	winGlow?: boolean;
};

export type DoubleUpColour = 'red' | 'black' | '';

export type RoundState =
	| 'idle'
	| 'betPlaced'
	| 'initialDeal'
	| 'holdSelection'
	| 'draw'
	| 'handResult'
	| 'doubleUpRound'
	| 'settled'
	| 'error'
	| 'timeout';

export const stateGame = $state({
	cards: [] as CardView[],
	holdMask: 0,
	showHolds: false,
	awaitingDraw: false,
	continueDraw: null as (() => void) | null,
	handCategory: '',
	handAmount: 0,
	doubleUpActive: false,
	doubleUpSkipped: false,
	doubleUpStep: 0,
	doubleUpCard: '',
	doubleUpColour: '' as DoubleUpColour,
	doubleUpCorrect: null as boolean | null,
	doubleUpAmountAtRisk: 0,
	doubleUpAmountAfter: 0,
	doubleUpRevealing: false,
	doubleUpRevealed: false,
	awaitingDoubleUpReveal: false,
	continueDoubleUpReveal: null as (() => void) | null,
	awaitingCollect: false,
	continueCollect: null as (() => void) | null,
	roundState: 'idle' as RoundState,
	lockedPayoutMultiplier: 0,
	sourceLabel: '',
	liveHold: false,
	liveWalletEnabled: false,
	/** HTML casino shell — default on for Stake Engine builds; Storybook live-wallet opts in separately. */
	casinoUiEnabled: true,
	awaitingPlayerHold: false,
	liveDebug: null as null | {
		playerHoldMask: number;
		playerCategory: string;
		playerPokerWin: number;
		optimalHoldMask: number;
		optimalCategorySameDeck: string;
		optimalPokerWinSameDeck: number;
		choiceChangedPokerWin: boolean;
	},
	liveWalletStatus: 'idle' as 'idle' | 'starting' | 'ready' | 'error' | 'offline',
	liveWalletPid: null as number | null,
	awaitingDoubleUpChoice: false,
	doubleUpMaxSteps: 2,
	liveRoundLocked: false,
	livePlayedEventCount: 0,
	continueLiveRound: null as (() => void) | null,
	liveBetRunning: false,
	livePaytableRows: [] as { name: string; multiplier: number }[],
	liveBonusBuy: null as null | 'job' | 'flush',
	/** Bumps to cancel an in-flight win presentation when a new deal starts. */
	winSequenceToken: 0,
	/** Animated WIN amount during count-up (book units). */
	winAnimAmount: 0,
	winAnimActive: false,
	/** Final pulse after win sequence. */
	winPulse: false,
});

const clearDoubleUp = () => {
	stateGame.continueDoubleUpReveal?.();
	stateGame.doubleUpActive = false;
	stateGame.doubleUpSkipped = false;
	stateGame.doubleUpStep = 0;
	stateGame.doubleUpCard = '';
	stateGame.doubleUpColour = '';
	stateGame.doubleUpCorrect = null;
	stateGame.doubleUpAmountAtRisk = 0;
	stateGame.doubleUpAmountAfter = 0;
	stateGame.doubleUpRevealing = false;
	stateGame.doubleUpRevealed = false;
	stateGame.awaitingDoubleUpReveal = false;
	stateGame.continueDoubleUpReveal = null;
};

export const stateGameDerived = {
	resetRound: () => {
		const keepLiveSession = stateGame.liveBetRunning;
		stateGame.continueDraw?.();
		stateGame.continueCollect?.();
		stateGame.cards = [];
		stateGame.holdMask = 0;
		stateGame.showHolds = false;
		stateGame.awaitingDraw = false;
		stateGame.continueDraw = null;
		stateGame.awaitingPlayerHold = false;
		stateGame.liveHold = false;
		stateGame.liveDebug = null;
		stateGame.liveBonusBuy = null;
		if (!keepLiveSession) {
			stateGame.liveWalletStatus = 'idle';
			stateGame.liveWalletPid = null;
			stateGame.liveBetRunning = false;
			stateGame.continueLiveRound?.();
			stateGame.continueLiveRound = null;
		}
		stateGame.awaitingDoubleUpChoice = false;
		stateGame.doubleUpMaxSteps = 2;
		stateGame.liveRoundLocked = false;
		stateGame.livePlayedEventCount = 0;
		stateGame.handCategory = '';
		stateGame.handAmount = 0;
		stateGame.awaitingCollect = false;
		stateGame.continueCollect = null;
		stateGame.roundState = 'idle';
		stateGame.lockedPayoutMultiplier = 0;
		clearDoubleUp();
		stateBet.winBookEventAmount = 0;
	},
};
