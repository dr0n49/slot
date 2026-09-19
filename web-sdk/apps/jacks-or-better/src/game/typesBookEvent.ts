import type { BetType } from 'rgs-requests';

import type { CardPayload } from './types';

type BookEventDeal = {
	index: number;
	type: 'deal';
	cards: CardPayload[];
};

type BookEventHold = {
	index: number;
	type: 'hold';
	holdMask: number;
	held: CardPayload[];
};

type BookEventDraw = {
	index: number;
	type: 'draw';
	drawn: CardPayload[];
	finalHand: CardPayload[];
};

type BookEventHandResult = {
	index: number;
	type: 'handResult';
	category: string;
	amount: number;
};

type BookEventDoubleUp = {
	index: number;
	type: 'doubleUp';
	step: number;
	card: string;
	colour: 'red' | 'black';
	correct: boolean;
	amountAfter: number;
};

type BookEventSetTotalWin = {
	index: number;
	type: 'setTotalWin';
	amount: number;
};

type BookEventFinalWin = {
	index: number;
	type: 'finalWin';
	amount: number;
};

export type BookEvent =
	| BookEventDeal
	| BookEventHold
	| BookEventDraw
	| BookEventHandResult
	| BookEventDoubleUp
	| BookEventSetTotalWin
	| BookEventFinalWin;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
