import { stateBet } from 'state-shared';

import { WIN_LEVELS } from './config';
import { getScene } from './engine/scene';
import { ease, scheduler, wait } from './engine/tween';
import { sfx } from './sfx';
import { bookToMultiplier, formatBookWin } from './constants';
import { tempo } from './presentationPlan';
import { nextId, stateGame, type WinTierAlias } from './stateGame.svelte';

/** True while visuals should be shortened (turbo setting or player fast-forward). */
export const fastMode = () => stateBet.isTurbo || stateGame.skip;

/** Push the turbo / skip state into the scheduler. Cheap, called before every step. */
export const syncTiming = () => {
	scheduler.speed = stateBet.isTurbo ? 1.8 : 1;
	scheduler.skip = stateGame.skip;
};

/**
 * Shorter waits in turbo, and progressively shorter as a round runs long (see `tempo`), so a
 * ten-spin feature cannot outlive the presentation watchdog while the player is not tapping.
 */
export const beat = (ms: number) => wait(fastMode() ? Math.min(ms * 0.3, 140) : ms * tempo());

export const requestSkip = () => {
	if (stateGame.phase === 'IDLE' || stateGame.bigWin || stateGame.featureIntro || stateGame.featureOutro) return;
	stateGame.skip = true;
	syncTiming();
	// a gate waiting on the player must not survive a fast-forward
	releaseContinue();
};

export const clearSkip = () => {
	stateGame.skip = false;
	syncTiming();
};

// ---------------------------------------------------------------------------- popups
export const addPopup = (x: number, y: number, text: string, tone: 'win' | 'mult' | 'keg' = 'win') => {
	const id = nextId();
	stateGame.popups = [...stateGame.popups.slice(-8), { id, x, y, text, tone }];
	setTimeout(() => {
		stateGame.popups = stateGame.popups.filter((p) => p.id !== id);
	}, 1500);
};

export const clearPopups = () => {
	stateGame.popups = [];
};

// ---------------------------------------------------------------------------- counters
let countToken = 0;

/** Animate the WIN box. Values are book units (bet multiple x100). */
export const countWinTo = (to: number, ms = 420) => {
	const token = ++countToken;
	const from = stateGame.displayWin;
	if (to === from) return Promise.resolve();
	stateGame.winCounting = true;
	return scheduler
		.add(ms, (p) => {
			if (token !== countToken) return;
			stateGame.displayWin = Math.round(from + (to - from) * ease.outCubic(p));
			if (p >= 1) stateGame.winCounting = false;
		})
		.then(() => {
			if (token === countToken) {
				stateGame.displayWin = to;
				stateGame.winCounting = false;
			}
		});
};

export const setWinInstant = (to: number) => {
	countToken++;
	stateGame.displayWin = to;
	stateGame.winCounting = false;
};

// ---------------------------------------------------------------------------- continue gate
let continueResolver: (() => void) | null = null;

/**
 * Resolves when the player taps continue, or after `autoMs` (autoplay / turbo / timeout).
 *
 * A gate never outlives its round: if the round is already being fast-forwarded it resolves at
 * once, and a gate left open by a previous round is released before a new one opens. Otherwise a
 * stale gate would hold the presentation until the watchdog abandoned the round.
 */
export const waitForContinue = (autoMs: number) => {
	// never stack gates: whatever was waiting belongs to a round that has moved on
	releaseContinue();
	if (stateGame.skip) return Promise.resolve();
	return new Promise<void>((resolve) => {
		const done = () => {
			if (!continueResolver) return;
			clearTimeout(timer);
			continueResolver = null;
			stateGame.awaitingContinue = false;
			resolve();
		};
		continueResolver = done;
		stateGame.awaitingContinue = true;
		const auto =
			stateBet.autoSpinsCounter > 0 || stateBet.isTurbo ? Math.min(autoMs, 1600) : Math.round(autoMs * tempo());
		const timer = setTimeout(done, auto);
	});
};

export const releaseContinue = () => continueResolver?.();

// ---------------------------------------------------------------------------- big win
const TIERS: { alias: WinTierAlias; level: number; sfx: string; label: string }[] = [
	{ alias: 'big', level: 6, sfx: 'bigwin_big', label: 'BIG WIN' },
	{ alias: 'mega', level: 7, sfx: 'bigwin_mega', label: 'MEGA WIN' },
	{ alias: 'massive', level: 8, sfx: 'bigwin_massive', label: 'MASSIVE WIN' },
	{ alias: 'max', level: 10, sfx: 'bigwin_massive', label: 'MAX WIN' },
];
export const TIER_LABEL: Record<WinTierAlias, string> = Object.fromEntries(TIERS.map((t) => [t.alias, t.label])) as never;

const threshold = (level: number) => WIN_LEVELS[String(level)] ?? Infinity;

/** Presentation tier for a given multiple of the bet (display only; the book supplies the level). */
export const tierForMultiplier = (mult: number): WinTierAlias | null => {
	let found: WinTierAlias | null = null;
	for (const t of TIERS) if (mult >= threshold(t.level)) found = t.alias;
	return found;
};

export const isBigWinLevel = (level: number) => level >= 6;

/**
 * Big win presentation: the counter climbs and the title escalates BIG → MEGA → MASSIVE (→ MAX)
 * as the running amount passes each tier threshold. The book's win level decides how far it
 * may climb; nothing here changes the amount that is paid.
 */
export const presentBigWin = async (amount: number, level: number, opts: { title?: string } = {}) => {
	const scene = getScene();
	const finalMult = bookToMultiplier(amount);
	const finalTier = tierForMultiplier(finalMult) ?? 'big';
	const tierIdx = TIERS.findIndex((t) => t.alias === finalTier);
	stateGame.skip = false;
	stateGame.bigWinSkip = false;
	syncTiming();
	stateGame.bigWin = { tier: 'big', level, amount, shown: 0, done: false };
	sfx.play(TIERS[0].sfx);
	sfx.startLoop('coin_loop');
	scene?.flash(0xffd27a, 0.45, 500);
	scene?.shake(7, 380);
	let rainAcc = 0;

	// One count-up segment per tier: the counter climbs 0 → MEGA threshold under "BIG WIN", then
	// → MASSIVE threshold under "MEGA WIN", ... so every title is on screen long enough to read.
	const stops = [0];
	for (let i = 1; i <= tierIdx; i++) stops.push(Math.min(amount, Math.round(threshold(TIERS[i].level) * 100)));
	stops.push(amount);

	for (let seg = 0; seg <= tierIdx; seg++) {
		if (!stateGame.bigWin) break;
		const tier = TIERS[seg];
		stateGame.bigWin.tier = tier.alias;
		if (seg > 0) {
			sfx.play(tier.sfx);
			scene?.shake(9 + seg * 2, 420);
			scene?.flash(0xffffff, 0.5, 420);
			for (let i = 0; i < 3; i++) scene?.fireworks(1);
		}
		const from = stops[seg];
		const to = stops[seg + 1];
		// the last segment lingers a little so the final amount lands with weight
		const dur = seg === tierIdx ? 2800 : 2200;
		if (stateGame.bigWinSkip) {
			stateGame.bigWin.shown = to;
			continue;
		}
		await scheduler.add(dur, (p) => {
			if (!stateGame.bigWin) return;
			if (stateGame.bigWinSkip) p = 1;
			stateGame.bigWin.shown = Math.round(from + (to - from) * ease.inOutQuad(p));
			rainAcc += 16;
			if (rainAcc > 240) {
				rainAcc = 0;
				scene?.coinRain(0.9 + seg * 0.35);
				if (seg >= 1 && Math.random() < 0.5) scene?.fireworks(0.8);
			}
		});
	}
	if (stateGame.bigWin) {
		stateGame.bigWin.shown = amount;
		stateGame.bigWin.tier = finalTier;
		stateGame.bigWin.done = true;
	}
	sfx.stopLoop('coin_loop');
	sfx.play('count_end');
	scene?.fireworks(1.2);
	await waitForContinue(opts.title ? 5200 : 4200);
	stateGame.bigWin = null;
};

// ---------------------------------------------------------------------------- small win banner
export const winBannerText = (level: number, amount: number) => {
	const money = formatBookWin(amount);
	if (level >= 5) return { text: 'GREAT WIN', sub: money };
	if (level >= 4) return { text: 'NICE WIN', sub: money };
	return null;
};

/** Tap while the big win counts → jump to the final amount; tap again → continue. */
export const tapBigWin = () => {
	if (!stateGame.bigWin) return;
	if (!stateGame.bigWin.done) stateGame.bigWinSkip = true;
	else releaseContinue();
};
