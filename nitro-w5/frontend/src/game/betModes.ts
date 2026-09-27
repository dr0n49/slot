import { stateBet, stateMeta } from 'state-shared';

import config, { BONUS_COST, GAME, MODES } from './config';

const emptyAssets = { icon: '', dialogImage: '', dialogVolatility: '', volatility: '', button: '' };
const emptyText = {
	title: '',
	dialog: '',
	button: '',
	betAmountLabel: '',
	tickerIdle: '',
	tickerSpin: '',
	bannerText: '',
};

export type EngineMode = (typeof MODES)[keyof typeof MODES];

/**
 * Register the bet modes + rules meta for Stake Engine / ACP. Replaces the shared sample-slot
 * defaults so nothing from another game is baked into the runtime meta.
 */
export const registerEngineBetModes = () => {
	const { base, bonus } = config.betModes;

	stateMeta.betModeMeta = {
		BASE: {
			mode: MODES.base,
			costMultiplier: base.cost,
			type: 'default',
			parent: '',
			children: '',
			assets: emptyAssets,
			text: { ...emptyText, title: GAME.name, tickerIdle: 'PLACE YOUR BET', tickerSpin: 'GOOD LUCK' },
			maxWin: base.max_win,
		},
		BONUS: {
			mode: MODES.bonus,
			costMultiplier: bonus.cost,
			type: 'buy',
			parent: '',
			children: '',
			assets: emptyAssets,
			text: {
				...emptyText,
				title: 'DEEP VEIN FREE SPINS',
				dialog: `Buy the Deep Vein bonus for ${BONUS_COST}× your bet.`,
				button: 'BUY',
				tickerSpin: 'BONUS BUY',
			},
			maxWin: bonus.max_win,
		},
	};

	stateMeta.gameRuleMeta = {
		gameRules: [],
		payTable: [],
		splashScreen: [],
	};

	normaliseActiveMode();
};

/** RGS mode keys are lowercase; the shared engine defaults to 'BASE'. */
export const normaliseActiveMode = () => {
	const key = String(stateBet.activeBetModeKey || '').toLowerCase();
	stateBet.activeBetModeKey = (key === MODES.bonus ? MODES.bonus : MODES.base) as never;
};

const activeMeta = () =>
	stateMeta.betModeMeta[String(stateBet.activeBetModeKey).toUpperCase()] ??
	stateMeta.betModeMeta[String(stateBet.activeBetModeKey).toLowerCase()];

export const resetBuyBetModeIfNeeded = () => {
	if (activeMeta()?.type === 'buy') stateBet.activeBetModeKey = MODES.base as never;
};
