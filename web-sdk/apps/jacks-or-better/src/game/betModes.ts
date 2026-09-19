import { stateBet, stateMeta } from 'state-shared';

import config from './config';

const emptyAssets = {
	icon: '',
	dialogImage: '',
	dialogVolatility: '',
	volatility: '',
	button: '',
};

const emptyText = {
	title: '',
	dialog: '',
	button: '',
	betAmountLabel: '',
	tickerIdle: '',
	tickerSpin: '',
	bannerText: '',
};

/** RGS mode keys — must match math-sdk `game_config.py` bet_modes names. */
export const ENGINE_BET_MODES = {
	base: 'base',
	bonusJob: 'bonus_job',
	bonusFlush: 'bonus_flush',
} as const;

export type EngineBonusKind = 'job' | 'flush';

export const engineBonusModeKey = (kind: EngineBonusKind) =>
	kind === 'job' ? ENGINE_BET_MODES.bonusJob : ENGINE_BET_MODES.bonusFlush;

/**
 * Register JoB bet modes + game rules for Stake Engine / ACP.
 * Replaces the shared sample-slot defaults (ANTE / SUPER BONUS / Wild / Free Spins)
 * so they are not baked into the runtime meta / rules modal.
 */
export const registerEngineBetModes = () => {
	const { base, bonus_job: bonusJob, bonus_flush: bonusFlush } = config.betModes;

	stateMeta.betModeMeta = {
		BASE: {
			mode: ENGINE_BET_MODES.base,
			costMultiplier: base.cost,
			type: 'default',
			parent: '',
			children: '',
			assets: emptyAssets,
			text: {
				...emptyText,
				title: 'VIDEO POKER',
				tickerIdle: 'PLACE YOUR BET',
				tickerSpin: 'GOOD LUCK',
			},
			maxWin: base.max_win,
		},
		BONUS_JOB: {
			mode: ENGINE_BET_MODES.bonusJob,
			costMultiplier: bonusJob.cost,
			type: 'buy',
			parent: '',
			children: '',
			assets: emptyAssets,
			text: {
				...emptyText,
				title: 'MIN WIN: JoB+',
				dialog: 'Guaranteed win of at least Jacks or Better for 2× bet.',
				button: 'BUY',
				tickerSpin: 'JoB+ BONUS BUY',
			},
			maxWin: bonusJob.max_win,
		},
		BONUS_FLUSH: {
			mode: ENGINE_BET_MODES.bonusFlush,
			costMultiplier: bonusFlush.cost,
			type: 'buy',
			parent: '',
			children: '',
			assets: emptyAssets,
			text: {
				...emptyText,
				title: 'MIN WIN: Flush+',
				dialog: 'Guaranteed win of at least a Flush for 10× bet.',
				button: 'BUY',
				tickerSpin: 'FLUSH+ BONUS BUY',
			},
			maxWin: bonusFlush.max_win,
		},
	};

	stateMeta.gameRuleMeta = {
		gameRules: [
			{
				title: 'HOW TO PLAY',
				rows: 1,
				columns: 1,
				containers: [
					{
						title: 'VIDEO POKER',
						text:
							'Choose a bet and press DEAL. Five cards are dealt. Wins pay from the classic 7/5 Jacks or Better paytable (pair of Jacks or better). There is no double-up / gamble. Use TURBO for faster deals and AUTO for continuous play. JoB+ (2×) and Flush+ (10×) buy a guaranteed minimum hand.',
						image: '',
						row: 0,
						column: 0,
						imagePosition: 'top',
					},
				],
			},
		],
		payTable: [
			{
				title: 'PAYTABLE',
				rows: 1,
				columns: 1,
				containers: [
					{
						title: '7/5 JACKS OR BETTER',
						text:
							'Royal Flush 800 · Straight Flush 50 · Four of a Kind 25 · Full House 7 · Flush 5 · Straight 4 · Three of a Kind 3 · Two Pair 2 · Jacks or Better 1. Max win 800×. RTP ≈ 96.15%.',
						image: '',
						row: 0,
						column: 0,
						imagePosition: 'top',
					},
				],
			},
		],
		splashScreen: [],
	};

	if (stateBet.activeBetModeKey === 'BASE') {
		stateBet.activeBetModeKey = ENGINE_BET_MODES.base;
	}
};

export const resetBuyBetModeIfNeeded = () => {
	const mode = stateMeta.betModeMeta[stateBet.activeBetModeKey.toUpperCase()]
		?? stateMeta.betModeMeta[stateBet.activeBetModeKey.toLowerCase()];
	if (mode?.type === 'buy') {
		stateBet.activeBetModeKey = ENGINE_BET_MODES.base;
	}
};
