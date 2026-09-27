import type { BetType } from 'rgs-requests';

export type Pos = { reel: number; row: number };
export type BookSymbol = { name: string; wild?: boolean; scatter?: boolean; keg?: boolean };

export type BookEventReveal = {
	index: number;
	type: 'reveal';
	/** Padded board: [reel][row], row 0 and the last row are hidden padding symbols. */
	board: BookSymbol[][];
	paddingPositions: number[];
	gameType: 'basegame' | 'freegame';
	anticipation: number[];
};

export type WinLine = {
	symbol: string;
	kind: number;
	/** cents of the bet multiplier (x100) */
	win: number;
	positions: Pos[];
	meta: { ways: number; globalMult: number; winWithoutMult: number };
};

/** One rung a cascade step passed through (K-4): every rung pays exactly once. */
export type LadderRung = { index: number; multiplier: number; win: number };

export type BookEventWinInfo = {
	index: number;
	type: 'winInfo';
	totalWin: number;
	wins: WinLine[];
	/**
	 * The rungs this step walked, in order, and what each contributed. `multiplier` is their
	 * sum — the value the win was actually paid with. The UI replays this list; it never
	 * works out a multiplier or an amount itself.
	 */
	ladder: {
		index: number;
		fromIndex: number;
		nextIndex: number;
		multiplier: number;
		kegs: number;
		rungs: LadderRung[];
	};
};

export type BookEventKegBlast = {
	index: number;
	type: 'kegBlast';
	positions: Pos[];
	fromIndex: number;
	toIndex: number;
	nextIndex: number;
	multiplier: number;
	rungs: { index: number; multiplier: number }[];
};

export type BookEventUpdateTumbleWin = { index: number; type: 'updateTumbleWin'; amount: number };

export type BookEventTumbleBoard = {
	index: number;
	type: 'tumbleBoard';
	newSymbols: BookSymbol[][];
	explodingSymbols: Pos[];
};

export type BookEventUpdateLadder = {
	index: number;
	type: 'updateLadder';
	ladderIndex: number;
	multiplier: number;
	steps: number;
};

export type BookEventSetWin = { index: number; type: 'setWin'; amount: number; winLevel: number };
export type BookEventSetTotalWin = { index: number; type: 'setTotalWin'; amount: number };
export type BookEventWincap = { index: number; type: 'wincap'; amount: number };

export type BookEventFreeSpinTrigger = {
	index: number;
	type: 'freeSpinTrigger';
	totalFs: number;
	positions: Pos[];
};
export type BookEventFreeSpinRetrigger = {
	index: number;
	type: 'freeSpinRetrigger';
	totalFs: number;
	positions: Pos[];
};
export type BookEventUpdateFreeSpin = { index: number; type: 'updateFreeSpin'; amount: number; total: number };
export type BookEventFreeSpinEnd = { index: number; type: 'freeSpinEnd'; amount: number; winLevel: number };
export type BookEventFinalWin = { index: number; type: 'finalWin'; amount: number };

export type BookEvent =
	| BookEventReveal
	| BookEventWinInfo
	| BookEventKegBlast
	| BookEventUpdateTumbleWin
	| BookEventTumbleBoard
	| BookEventUpdateLadder
	| BookEventSetWin
	| BookEventSetTotalWin
	| BookEventWincap
	| BookEventFreeSpinTrigger
	| BookEventFreeSpinRetrigger
	| BookEventUpdateFreeSpin
	| BookEventFreeSpinEnd
	| BookEventFinalWin;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T extends BookEvent['type']> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
