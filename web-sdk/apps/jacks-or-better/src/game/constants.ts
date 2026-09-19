import type { CardCode, ParsedCard } from './types';

import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateConfig } from 'state-shared';

export const CARD_WIDTH = 140;
export const CARD_HEIGHT = 196;
export const CARD_GAP = 18;
export const HAND_SIZE = 5;
export const DOUBLE_UP_MAX_CHAIN = 2;

const SUIT_COLOUR: Record<string, 'red' | 'black'> = {
	C: 'black',
	S: 'black',
	D: 'red',
	H: 'red',
};

const SUIT_GLYPH: Record<string, string> = {
	C: '♣',
	D: '♦',
	H: '♥',
	S: '♠',
};

export const parseCard = (code: CardCode): ParsedCard => {
	const rank = code.slice(0, -1);
	const suit = code.slice(-1);
	return {
		code,
		rank,
		suit,
		colour: SUIT_COLOUR[suit] ?? 'black',
	};
};

export const suitGlyph = (suit: string) => SUIT_GLYPH[suit] ?? suit;

export const rankLabel = (rank: string) => (rank === 'T' ? '10' : rank);

export const isHeld = (holdMask: number, index: number) => (holdMask & (1 << index)) !== 0;

export const formatMultiplier = (cents: number) => {
	const x = cents / 100;
	return `${Number.isInteger(x) ? x.toFixed(0) : x.toFixed(2)}×`;
};

/** 7/5 JoB paytable — multipliers of 1× bet (matches frozen math). */
export const PAYTABLE_7_5_ROWS = [
	{ name: 'Royal Flush', multiplier: 800 },
	{ name: 'Straight Flush', multiplier: 50 },
	{ name: 'Four of a Kind', multiplier: 25 },
	{ name: 'Full House', multiplier: 7 },
	{ name: 'Flush', multiplier: 5 },
	{ name: 'Straight', multiplier: 4 },
	{ name: 'Three of a Kind', multiplier: 3 },
	{ name: 'Two Pair', multiplier: 2 },
	{ name: 'Jacks or Better', multiplier: 1 },
] as const;

/** Fixed USD bet amounts per spin (live wallet / casino UI). */
export const BET_AMOUNT_OPTIONS = [
	0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 10, 20, 50, 100, 200, 500,
] as const;
export type BetAmountOption = (typeof BET_AMOUNT_OPTIONS)[number];

/** @deprecated Legacy coin columns — frozen book mode only. */
export const COIN_LEVELS = [1, 2, 3, 4, 5] as const;
export type CoinLevel = (typeof COIN_LEVELS)[number];

/** @deprecated Legacy arcade denomination label. */
export const COIN_DENOMINATION_CENTS = 5;

export const resolvedBetAmountOptions = (): number[] =>
	stateConfig.betAmountOptions.length > 0
		? stateConfig.betAmountOptions
		: [...BET_AMOUNT_OPTIONS];

export const betAmountIndex = (amount: number, options = resolvedBetAmountOptions()) => {
	const exact = options.indexOf(amount);
	if (exact >= 0) return exact;
	for (let i = options.length - 1; i >= 0; i--) {
		if (options[i] <= amount) return i;
	}
	return 0;
};

export const snapBetAmount = (amount: number): number =>
	resolvedBetAmountOptions()[betAmountIndex(amount)];

/** Plain number: no currency symbol, no trailing ".00" (1 → "1", 1.5 → "1.5", 1.25 → "1.25"). */
export const formatPlainAmount = (amount: number) => {
	if (!Number.isFinite(amount)) return '0';
	const rounded = Math.round(amount * 100) / 100;
	if (Number.isInteger(rounded)) return `${rounded}`;
	return rounded.toFixed(2).replace(/0$/, '');
};

export const formatBetLabel = (amount: number) => formatPlainAmount(amount);

/** Paytable cell: multiplier × current bet, plain number. */
export const paytableBetPayout = (baseMultiplier: number, betAmount: number) =>
	formatPlainAmount(baseMultiplier * betAmount);

/** @deprecated Use paytableBetPayout with stateBet.betAmount. */
export const paytableCoinPayout = (baseMultiplier: number, coins: CoinLevel) =>
	baseMultiplier * coins;

/** @deprecated Use snapBetAmount / BET_AMOUNT_OPTIONS. */
export const coinLevelFromBet = (betAmount: number): CoinLevel => {
	const level = Math.max(1, Math.min(5, Math.round(betAmount)));
	return level as CoinLevel;
};

export const formatCoinDenom = () => `${COIN_DENOMINATION_CENTS}¢`;

/** Bonus buy activation cost multipliers (live wallet). */
export const LIVE_BONUS_COST = {
	job: 2,
	flush: 10,
} as const;

export const formatCredits = (amount: number) => formatPlainAmount(amount);

/** Book / live-wallet win events store payout as multiplier × BOOK_AMOUNT_MULTIPLIER. */
export const bookWinToPayout = (bookEventAmount: number, betAmount: number) =>
	(bookEventAmount / BOOK_AMOUNT_MULTIPLIER) * betAmount;

/** Display WIN payout for the active wager. */
export const formatBookWinPayout = (bookEventAmount: number, betAmount: number) => {
	const payout = bookWinToPayout(bookEventAmount, betAmount);
	return formatPlainAmount(payout);
};

export const LIVE_CARD_BACK = 0x1d4ed8;

/** Live-wallet layout only — frozen base mode keeps its own originY offsets. */
export const LIVE_HOLD_CARD_Y_RATIO = 0.5;
export const LIVE_HOLD_OVERLAY_BOTTOM_PX = 190;
export const LIVE_HOLD_CARD_HALF_HEIGHT_PX = CARD_HEIGHT / 2;

export const liveHoldCardOriginY = (layoutHeight: number) =>
	layoutHeight * LIVE_HOLD_CARD_Y_RATIO - CARD_HEIGHT / 2;
