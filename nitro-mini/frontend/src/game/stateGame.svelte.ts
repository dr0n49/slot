import { stateBet } from 'state-shared';

import { LADDER } from './config';
import { clearRoundContext, startRoundContext } from './roundContext';
import type { RoundResult } from './roundResult';

/**
 * UI-level round phases. This is the presentation state machine that sits on top of the
 * SDK's xstate bet machine (rendering → idle → bet/autoBet/resumeBet). It never decides an
 * outcome — it only tracks where the *presentation* of a book currently is.
 */
export type Phase =
	| 'IDLE'
	| 'SPINNING'
	| 'RESOLVING'
	| 'WIN_PRESENTATION'
	| 'CASCADE'
	| 'FEATURE'
	| 'COMPLETE'
	| 'ERROR';

const TRANSITIONS: Record<Phase, readonly Phase[]> = {
	IDLE: ['SPINNING', 'ERROR'],
	SPINNING: ['RESOLVING', 'FEATURE', 'IDLE', 'ERROR', 'COMPLETE'],
	RESOLVING: ['WIN_PRESENTATION', 'CASCADE', 'FEATURE', 'SPINNING', 'COMPLETE', 'ERROR'],
	WIN_PRESENTATION: ['CASCADE', 'RESOLVING', 'FEATURE', 'COMPLETE', 'ERROR'],
	CASCADE: ['RESOLVING', 'WIN_PRESENTATION', 'FEATURE', 'COMPLETE', 'ERROR'],
	FEATURE: ['SPINNING', 'RESOLVING', 'WIN_PRESENTATION', 'CASCADE', 'COMPLETE', 'ERROR'],
	COMPLETE: ['IDLE', 'SPINNING', 'ERROR'],
	ERROR: ['IDLE', 'SPINNING'],
};

export type GameType = 'basegame' | 'freegame';

export type WinPopup = {
	id: number;
	x: number;
	y: number;
	text: string;
	tone: 'win' | 'mult' | 'keg';
};

export type BannerKind = 'info' | 'feature' | 'win' | 'warn';

export type WinTierAlias = 'big' | 'mega' | 'massive' | 'max';

export const stateGame = $state({
	phase: 'IDLE' as Phase,
	gameType: 'basegame' as GameType,
	/** Set once assets are decoded and the scene is on screen. */
	sceneReady: false,
	/** Last transition that was rejected by the table (kept for diagnostics / tests). */
	illegalTransitions: 0,

	// --- ladder ----------------------------------------------------------
	ladderIndex: 0,
	ladderValues: [...LADDER.basegame] as number[],
	ladderPulse: 0, // bumps on every climb so the UI can retrigger its animation
	ladderBoost: 0, // extra rungs granted by kegs on the current step
	ladderPayMultiplier: 1, // multiplier paid by the step currently on screen
	/**
	 * The rung a K-4 blast is passing through right now, with what that rung paid. Set only
	 * from the book's rung list so the ladder can show the walk instead of jumping to the
	 * total. Cleared when the walk ends.
	 */
	ladderTick: null as null | { index: number; multiplier: number; win: number; ordinal: number },

	// --- free spins ------------------------------------------------------
	fsActive: false,
	fsCurrent: 0,
	fsTotal: 0,
	fsWin: 0, // running total of the feature, book units (x100)

	// --- wins (all in book units: multiples of bet x100) -----------------
	spinWin: 0,
	totalWin: 0,
	displayWin: 0, // what the WIN box shows (animated count-up)
	winCounting: false,

	// --- transient presentation -----------------------------------------
	popups: [] as WinPopup[],
	banner: null as null | { id: number; text: string; sub: string; kind: BannerKind },
	anticipating: [] as number[],
	kegsOnBoard: 0,

	// --- overlays --------------------------------------------------------
	bigWin: null as null | { tier: WinTierAlias; level: number; amount: number; shown: number; done: boolean },
	featureIntro: null as null | { spins: number; retrigger: boolean },
	featureOutro: null as null | { amount: number; spins: number; level: number },
	awaitingContinue: false,
	bigWinSkip: false,

	// --- control ---------------------------------------------------------
	skip: false,
	sourceLabel: '',
	lockedPayoutMultiplier: 0,
	error: null as null | { message: string; title?: string; detail?: string },
	/** Bumps whenever a round starts; stale presentation callbacks compare against it. */
	roundToken: 0,
	/**
	 * The round's outcome, read off the book the moment it arrives and before anything is
	 * animated. Presentation never writes it — it only replays it. If the presentation
	 * stalls or fails, the round is settled from here.
	 */
	roundResult: null as RoundResult | null,
});

let uid = 1;
export const nextId = () => uid++;

export const setPhase = (next: Phase) => {
	const prev = stateGame.phase;
	if (prev === next) return;
	if (!TRANSITIONS[prev].includes(next)) {
		stateGame.illegalTransitions++;
		console.warn(`[nitro-vein] unexpected phase transition ${prev} → ${next}`);
	}
	stateGame.phase = next;
};

export const isBusy = () => stateGame.phase !== 'IDLE';

const formatBannerId = () => nextId();

export const showBanner = (text: string, sub = '', kind: BannerKind = 'info') => {
	const id = formatBannerId();
	stateGame.banner = { id, text, sub, kind };
	return id;
};

export const hideBanner = (id?: number) => {
	if (id === undefined || stateGame.banner?.id === id) stateGame.banner = null;
};

export const stateGameDerived = {
	/** Fresh round: clears every transient piece of presentation state. */
	resetRound: () => {
		stateGame.roundToken++;
		startRoundContext(stateGame.roundToken);
		stateGame.roundResult = null;
		stateGame.skip = false;
		stateGame.spinWin = 0;
		stateGame.totalWin = 0;
		stateGame.displayWin = 0;
		stateGame.winCounting = false;
		stateGame.popups = [];
		stateGame.banner = null;
		stateGame.anticipating = [];
		stateGame.bigWin = null;
		stateGame.featureIntro = null;
		stateGame.featureOutro = null;
		stateGame.awaitingContinue = false;
		stateGame.error = null;
		stateGame.gameType = 'basegame';
		stateGame.fsActive = false;
		stateGame.fsCurrent = 0;
		stateGame.fsTotal = 0;
		stateGame.fsWin = 0;
		stateGame.ladderIndex = 0;
		stateGame.ladderBoost = 0;
		stateGame.ladderTick = null;
		stateGame.ladderPayMultiplier = 1;
		stateGame.ladderValues = [...LADDER.basegame];
		stateGame.lockedPayoutMultiplier = 0;
		stateBet.winBookEventAmount = 0;
	},
	/** Back to a clean, spin-ready state (after an error or an interrupted presentation). */
	recover: () => {
		clearRoundContext();
		stateGame.ladderTick = null;
		stateGame.skip = false;
		stateGame.popups = [];
		stateGame.banner = null;
		stateGame.anticipating = [];
		stateGame.bigWin = null;
		stateGame.featureIntro = null;
		stateGame.featureOutro = null;
		stateGame.awaitingContinue = false;
		stateGame.winCounting = false;
		stateGame.phase = 'IDLE';
	},
};
