import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateConfig, stateBet } from 'state-shared';

/** Fallback bet ladder when the RGS config carries none (dev / storybook). */
export const BET_AMOUNT_OPTIONS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100] as const;

export const resolvedBetAmountOptions = (): number[] =>
	stateConfig.betAmountOptions.length > 0 ? stateConfig.betAmountOptions : [...BET_AMOUNT_OPTIONS];

export const betAmountIndex = (amount: number, options = resolvedBetAmountOptions()) => {
	const exact = options.indexOf(amount);
	if (exact >= 0) return exact;
	for (let i = options.length - 1; i >= 0; i--) {
		if (options[i] <= amount) return i;
	}
	return 0;
};

const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyCompact = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 2-decimals amount ("1,234.50"). */
export const formatAmount = (amount: number) => (Number.isFinite(amount) ? money.format(amount) : '0.00');

/** "1", "1.5", "0.25" — used for bet labels. */
export const formatBetLabel = (amount: number) =>
	Number.isFinite(amount) ? moneyCompact.format(Math.round(amount * 100) / 100) : '0';

/** Book event amounts are multiples of the bet x100 (`BOOK_AMOUNT_MULTIPLIER`). */
export const bookToMultiplier = (bookAmount: number) => bookAmount / BOOK_AMOUNT_MULTIPLIER;
export const bookToMoney = (bookAmount: number, bet = stateBet.betAmount) =>
	(bookAmount / BOOK_AMOUNT_MULTIPLIER) * bet;
export const formatBookWin = (bookAmount: number, bet = stateBet.betAmount) =>
	formatAmount(bookToMoney(bookAmount, bet));
export const formatX = (mult: number) => `${Number.isInteger(mult) ? mult : mult.toFixed(2)}×`;
