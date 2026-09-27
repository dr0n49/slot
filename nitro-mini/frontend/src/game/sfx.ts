import { stateSoundDerived } from 'state-shared';

import { assetUrl } from './assets';

/**
 * Slot audio built on the same conventions as the previous game's casinoAudio: HTMLAudio pools,
 * unlocked on the first user gesture, volumes read from the engine's settings modal
 * (`stateSoundDerived.volumeMusic()/volumeSoundEffect()`), asset root derived from the bundle URL.
 * Sounds are grouped into categories so they can be balanced independently.
 */
type Category = 'music' | 'spin' | 'symbol' | 'win' | 'cascade' | 'multiplier' | 'feature' | 'bigwin' | 'ui';

const CATEGORY_GAIN: Record<Category, number> = {
	music: 0.5,
	spin: 0.85,
	symbol: 0.8,
	win: 0.85,
	cascade: 0.8,
	multiplier: 0.8,
	feature: 1,
	bigwin: 1,
	ui: 0.75,
};

type Def = { file: string; cat: Category; loop?: boolean };

const mp3 = (n: string, cat: Category): Def => ({ file: `assets/sounds/${n}.mp3`, cat });
const wav = (n: string, cat: Category, loop = false): Def => ({ file: `assets/sounds/${n}.wav`, cat, loop });

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const DEFS: Record<string, Def> = {
	ui_click: mp3('ui_click', 'ui'),
	ui_open: mp3('ui_open', 'ui'),
	ui_close: mp3('ui_close', 'ui'),
	ui_toggle: mp3('ui_toggle', 'ui'),
	bet_change: mp3('bet_change', 'ui'),
	error: mp3('error', 'ui'),
	buy_confirm: mp3('buy_confirm', 'feature'),

	spin_start: mp3('spin_start', 'spin'),
	spin_loop: wav('spin_loop', 'spin', true),
	anticipation: mp3('anticipation', 'spin'),
	symbol_land: mp3('symbol_land', 'symbol'),
	symbol_pop: mp3('symbol_pop', 'symbol'),

	cascade_drop: mp3('cascade_drop', 'cascade'),
	keg_blast: mp3('keg_blast', 'multiplier'),
	fuse: mp3('fuse', 'multiplier'),
	mult_tick: mp3('mult_tick', 'multiplier'),

	fs_trigger: mp3('fs_trigger', 'feature'),
	fs_retrigger: mp3('fs_retrigger', 'feature'),
	fs_intro: mp3('fs_intro', 'feature'),
	fs_outro: mp3('fs_outro', 'feature'),

	bigwin_big: mp3('bigwin_big', 'bigwin'),
	bigwin_mega: mp3('bigwin_mega', 'bigwin'),
	bigwin_massive: mp3('bigwin_massive', 'bigwin'),
	coin_loop: wav('coin_loop', 'bigwin', true),
	count_end: mp3('count_end', 'bigwin'),
	win_total: mp3('win_total', 'win'),

	bgm_base: wav('bgm_base', 'music', true),
	bgm_free: wav('bgm_free', 'music', true),
};
for (const i of range(6)) DEFS[`reel_stop_${i}`] = mp3(`reel_stop_${i}`, 'spin');
for (const i of range(5)) DEFS[`scatter_land_${i}`] = mp3(`scatter_land_${i}`, 'symbol');
for (const i of range(8)) DEFS[`win_${i}`] = mp3(`win_${i}`, 'win');
for (const i of range(6)) DEFS[`ladder_up_${i}`] = mp3(`ladder_up_${i}`, 'multiplier');

export type SoundName = keyof typeof DEFS | (string & {});

const canUseAudio = () => typeof window !== 'undefined' && typeof Audio !== 'undefined';

let unlocked = false;
let bgmWanted = false;
let bgmName: 'bgm_base' | 'bgm_free' = 'bgm_base';
const pools = new Map<string, HTMLAudioElement[]>();
const loops = new Map<string, HTMLAudioElement>();
let bgmEl: HTMLAudioElement | null = null;
let bgmFadeToken = 0;

const sfxVolume = () => Math.min(1, Math.max(0, stateSoundDerived.volumeSoundEffect()));
const musicVolume = () => Math.min(1, Math.max(0, stateSoundDerived.volumeMusic()));

const element = (name: string): HTMLAudioElement | null => {
	const def = DEFS[name];
	if (!def) return null;
	const el = new Audio(assetUrl(def.file));
	el.preload = 'auto';
	return el;
};

const bgmTarget = () => Math.min(1, CATEGORY_GAIN.music * musicVolume());

const startBgm = () => {
	if (!canUseAudio() || !unlocked || !bgmWanted) return;
	const def = DEFS[bgmName];
	if (!bgmEl || !bgmEl.src.endsWith(def.file)) {
		const old = bgmEl;
		const el = element(bgmName)!;
		el.loop = true;
		el.volume = 0;
		bgmEl = el;
		const token = ++bgmFadeToken;
		void el.play().catch(() => {});
		const t0 = performance.now();
		const step = () => {
			if (token !== bgmFadeToken) return;
			const k = Math.min(1, (performance.now() - t0) / 900);
			el.volume = Math.min(1, bgmTarget() * k);
			if (old) old.volume = Math.max(0, bgmTarget() * (1 - k));
			if (k < 1) requestAnimationFrame(step);
			else old?.pause();
		};
		requestAnimationFrame(step);
		return;
	}
	applyVolumes();
	if (bgmEl.paused && bgmTarget() > 0) void bgmEl.play().catch(() => {});
};

const applyVolumes = () => {
	// read reactive volumes first so a Svelte $effect tracks them even before audio exists
	const music = bgmTarget();
	const sfx = sfxVolume();
	if (bgmEl) {
		bgmEl.volume = music;
		bgmEl.muted = music <= 0;
		if (music <= 0 && !bgmEl.paused) bgmEl.pause();
		else if (music > 0 && unlocked && bgmWanted && bgmEl.paused) void bgmEl.play().catch(() => {});
	}
	for (const [name, el] of loops) el.volume = Math.min(1, CATEGORY_GAIN[DEFS[name].cat] * sfx);
};

const unlock = () => {
	if (!canUseAudio() || unlocked) {
		startBgm();
		return;
	}
	unlocked = true;
	startBgm();
};

const installUnlockListeners = () => {
	if (!canUseAudio()) return;
	const handler = () => {
		unlock();
		if (bgmEl && !bgmEl.paused) {
			window.removeEventListener('pointerdown', handler);
			window.removeEventListener('touchstart', handler);
			window.removeEventListener('keydown', handler);
		}
	};
	window.addEventListener('pointerdown', handler, { passive: true });
	window.addEventListener('touchstart', handler, { passive: true });
	window.addEventListener('keydown', handler);
	document.addEventListener('visibilitychange', () => {
		if (!bgmEl) return;
		if (document.hidden) bgmEl.pause();
		else if (bgmWanted && unlocked && bgmTarget() > 0) void bgmEl.play().catch(() => {});
	});
};

const play = (name: SoundName, opts: { gain?: number; rate?: number } = {}) => {
	if (!canUseAudio() || !unlocked) return;
	const def = DEFS[name];
	if (!def) return;
	if (def.loop) return startLoop(name);
	const volume = Math.min(1, CATEGORY_GAIN[def.cat] * (opts.gain ?? 1) * sfxVolume());
	if (volume <= 0) return;
	const pool = pools.get(name) ?? [];
	let el = pool.find((a) => a.paused || a.ended);
	if (!el) {
		if (pool.length >= 5) el = pool[0];
		else {
			el = element(name)!;
			pool.push(el);
			pools.set(name, pool);
		}
	}
	el.volume = volume;
	el.playbackRate = opts.rate ?? 1;
	try {
		el.currentTime = 0;
	} catch {
		// not seekable yet
	}
	void el.play().catch(() => {});
};

const startLoop = (name: string) => {
	if (!canUseAudio() || !unlocked) return;
	const def = DEFS[name];
	if (!def) return;
	let el = loops.get(name);
	if (!el) {
		el = element(name)!;
		el.loop = true;
		loops.set(name, el);
	}
	el.volume = Math.min(1, CATEGORY_GAIN[def.cat] * sfxVolume());
	if (el.volume <= 0) return;
	if (el.paused) {
		try {
			el.currentTime = 0;
		} catch {
			// ignore
		}
		void el.play().catch(() => {});
	}
};

const stopLoop = (name: string) => {
	const el = loops.get(name);
	if (!el) return;
	el.pause();
};

const enableBgm = () => {
	bgmWanted = true;
	installUnlockListeners();
	startBgm();
};

const disableBgm = () => {
	bgmWanted = false;
	bgmEl?.pause();
};

const setMusic = (which: 'base' | 'free') => {
	const next = which === 'free' ? 'bgm_free' : 'bgm_base';
	if (next === bgmName) return;
	bgmName = next;
	startBgm();
};

/** Diagnostics (also reachable as `window.__nitroAudio.status()` in the console). */
const status = () => ({
	unlocked,
	bgmWanted,
	bgm: bgmName,
	bgmPlaying: Boolean(bgmEl && !bgmEl.paused),
	bgmVolume: bgmEl?.volume ?? null,
	loops: [...loops.entries()].filter(([, el]) => !el.paused).map(([n]) => n),
});

export const sfx = {
	enableBgm,
	disableBgm,
	unlock,
	play,
	startLoop,
	stopLoop,
	stopAllLoops: () => [...loops.keys()].forEach(stopLoop),
	setMusic,
	applyVolumes,
	status,
	/** ascending pitch per reel */
	reelStop: (col: number) => play(`reel_stop_${Math.min(col, 5)}`),
	scatterLand: (idx: number) => play(`scatter_land_${Math.min(idx, 4)}`),
	winStep: (step: number) => play(`win_${Math.min(step, 7)}`),
	ladderUp: (step: number) => play(`ladder_up_${Math.min(Math.floor(step / 2), 5)}`),
	click: () => {
		unlock();
		play('ui_click');
	},
};

if (typeof window !== 'undefined') {
	(window as unknown as { __nitroAudio?: typeof sfx }).__nitroAudio = sfx;
}
