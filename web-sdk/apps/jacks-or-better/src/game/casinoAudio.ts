import { stateSoundDerived } from 'state-shared';

/** Files live in static/assets/sounds (16-bit PCM WAV — plays everywhere without codec issues). */
const SOUND_FILES = {
	background_music: 'assets/sounds/background_music.wav',
	button_click: 'assets/sounds/button_click.wav',
	card_deal: 'assets/sounds/card_deal.wav',
	card_deal_turbo: 'assets/sounds/card_deal_turbo.wav',
	win_small: 'assets/sounds/win_small.wav',
	win_big: 'assets/sounds/win_big.wav',
} as const;

export type CasinoSoundName = keyof typeof SOUND_FILES;

const BGM_GAIN = 0.5;
const SFX_GAIN = 0.9;

let bgm: HTMLAudioElement | null = null;
let unlocked = false;
let bgmWanted = false;
const sfxPool = new Map<CasinoSoundName, HTMLAudioElement[]>();

const canUseAudio = () => typeof window !== 'undefined' && typeof Audio !== 'undefined';

/**
 * Static assets sit next to index.html. The built bundle lives under
 * `<root>/_app/immutable/…`, so derive the root from this module's own URL —
 * that works regardless of how the host (Stake ACP iframe) addresses index.html
 * (with or without a trailing slash). Falls back to document.baseURI in dev.
 */
const assetRoot = (): string => {
	try {
		const self = import.meta.url;
		const idx = self.indexOf('/_app/');
		if (idx > 0) return self.slice(0, idx + 1);
	} catch {
		// import.meta.url unavailable — fall through.
	}
	if (typeof document !== 'undefined') {
		const base = document.baseURI;
		return base.endsWith('/') ? base : base.replace(/[^/]*$/, '');
	}
	return './';
};

const resolveUrl = (path: string) => new URL(path, assetRoot()).href;

const applyBgmVolume = () => {
	// Read the reactive volume first so a Svelte $effect tracks it even before BGM exists.
	const volume = Math.min(1, Math.max(0, BGM_GAIN * stateSoundDerived.volumeMusic()));
	if (!bgm) return;
	bgm.volume = volume;
	bgm.muted = volume <= 0;
	if (volume <= 0) {
		if (!bgm.paused) bgm.pause();
	} else if (unlocked && bgmWanted && bgm.paused) {
		void bgm.play().catch(() => {});
	}
};

const startBgm = () => {
	if (!canUseAudio() || !unlocked || !bgmWanted) return;
	if (!bgm) {
		bgm = new Audio(resolveUrl(SOUND_FILES.background_music));
		bgm.loop = true;
		bgm.preload = 'auto';
	}
	applyBgmVolume();
	if (bgm.paused && !bgm.muted) {
		void bgm.play().catch(() => {
			// Autoplay blocked until the next gesture — retried from unlock().
		});
	}
};

/** Browsers block audio until a user gesture; call from any click/keydown. */
const unlock = () => {
	if (!canUseAudio()) return;
	unlocked = true;
	startBgm();
};

const installUnlockListeners = () => {
	if (!canUseAudio()) return;
	const handler = () => {
		unlock();
		if (bgm && !bgm.paused) {
			window.removeEventListener('pointerdown', handler);
			window.removeEventListener('touchstart', handler);
			window.removeEventListener('keydown', handler);
		}
	};
	window.addEventListener('pointerdown', handler, { passive: true });
	window.addEventListener('touchstart', handler, { passive: true });
	window.addEventListener('keydown', handler);
};

const play = (name: Exclude<CasinoSoundName, 'background_music'>) => {
	if (!canUseAudio() || !unlocked) return;
	const volume = Math.min(1, Math.max(0, SFX_GAIN * stateSoundDerived.volumeSoundEffect()));
	if (volume <= 0) return;
	const pool = sfxPool.get(name) ?? [];
	let el = pool.find((a) => a.paused || a.ended);
	if (!el) {
		el = new Audio(resolveUrl(SOUND_FILES[name]));
		el.preload = 'auto';
		pool.push(el);
		sfxPool.set(name, pool);
	}
	el.volume = volume;
	el.currentTime = 0;
	void el.play().catch(() => {});
};

const enableBgm = () => {
	bgmWanted = true;
	installUnlockListeners();
	startBgm();
};

const disableBgm = () => {
	bgmWanted = false;
	bgm?.pause();
};

/** Diagnostics (also reachable as `window.__jobAudio.status()` in the console). */
const status = () => ({
	unlocked,
	bgmWanted,
	bgmSrc: bgm?.src ?? null,
	bgmPlaying: Boolean(bgm && !bgm.paused),
	bgmReadyState: bgm?.readyState ?? -1,
	bgmError: bgm?.error?.code ?? null,
	bgmVolume: bgm?.volume ?? null,
});

export const casinoAudio = {
	enableBgm,
	disableBgm,
	unlock,
	play,
	applyBgmVolume,
	status,
};

if (typeof window !== 'undefined') {
	(window as unknown as { __jobAudio?: typeof casinoAudio }).__jobAudio = casinoAudio;
}
