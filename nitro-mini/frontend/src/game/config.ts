import math from './mathConfig.generated';

/**
 * Static game config. Everything numeric comes from the generated math export
 * (math-sdk/games/nitro_vein/export_frontend.py) — the frontend only DISPLAYS these values,
 * it never uses them to decide an outcome.
 */
export const GAME = {
	id: math.gameId,
	name: 'NITRO VEIN',
	rtp: math.rtp,
	wincap: math.wincap,
	numReels: math.numReels,
	numRows: math.numRows,
	/** Books carry a hidden padding symbol above and below every reel. */
	paddedRows: math.numRows + 2,
} as const;

/** RGS bet-mode keys — must match math-sdk `game_config.py` bet mode names. */
export const MODES = {
	base: 'base',
	bonus: 'bonus',
} as const;

export const BONUS_COST = math.bonusCost;

export const SYMBOLS = {
	paying: math.symbols.paying as readonly string[],
	wild: math.symbols.wild,
	scatter: math.symbols.scatter,
	keg: math.symbols.keg,
	rock: math.symbols.rock,
	all: [
		...math.symbols.paying,
		math.symbols.wild,
		math.symbols.scatter,
		math.symbols.keg,
		math.symbols.rock,
	] as readonly string[],
} as const;

export const PAYTABLE = math.paytable as Record<string, Record<string, number>>;
export const LADDER = math.ladder;
export const FREE_SPINS = math.freeSpins;
export const WIN_LEVELS = math.winLevels as Record<string, number>;

export default {
	providerName: 'sample_provider',
	gameName: GAME.name,
	gameID: GAME.id,
	rtp: GAME.rtp,
	betModes: {
		base: { cost: 1.0, feature: true, buyBonus: false, rtp: GAME.rtp, max_win: GAME.wincap },
		bonus: { cost: BONUS_COST, feature: false, buyBonus: true, rtp: GAME.rtp, max_win: GAME.wincap },
	},
};
