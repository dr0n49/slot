import { stateBet, stateBetDerived } from 'state-shared';
import { waitForTimeout } from 'utils-shared/wait';

import { casinoAudio } from './casinoAudio';
import { stateGame } from './stateGame.svelte';

/** Must match `.card { transition: transform 350ms }` in Card.svelte. */
export const CARD_FLIP_MS = 350;

/** Delay between starting each card's flip during a deal (point 2). */
export const DEAL_STAGGER_MS = 100;

/** Fade/slide-out before a replaced (non-held) card flips in (point 5). */
export const CARD_REPLACE_OUT_MS = 200;

/** Per-card cadence leftover for non-stagger waits; flip duration is authoritative. */
export const CARD_REVEAL_MS = 420;
/** Turbo inside autoplay: still quick, but readable. */
export const CARD_REVEAL_TURBO_AUTO_MS = 150;

export type RevealSpeed = 'normal' | 'turbo' | 'turboAuto';

export const revealSpeed = (): RevealSpeed => {
	if (!stateBet.isTurbo) return 'normal';
	return stateBetDerived.hasAutoBetCounter() ? 'turboAuto' : 'turbo';
};

/**
 * Flip/reveal one card slot.
 * 1) Plant the face code while still face-down (`drawing: true`) so the front mesh is ready.
 * 2) Clear `drawing` to trigger CSS rotateY(180deg).
 * 3) Wait for the flip transition (unless turbo/instant).
 */
export const revealCardSlot = async (
	index: number,
	code: string,
	held = false,
	speed: RevealSpeed = revealSpeed(),
	opts: { replace?: boolean } = {},
) => {
	const prev = stateGame.cards[index] ?? {
		code: '',
		held: false,
		drawing: false,
		instant: false,
		replacing: false,
		winGlow: false,
	};

	const isReplace =
		opts.replace ||
		(Boolean(prev.code) && !prev.drawing && prev.code !== code && !prev.held);

	if (isReplace && speed !== 'turbo') {
		stateGame.cards[index] = {
			...prev,
			replacing: true,
			instant: false,
			winGlow: false,
		};
		await waitForTimeout(CARD_REPLACE_OUT_MS);
	}

	// Face art ready, still showing the back.
	stateGame.cards[index] = {
		code,
		held,
		drawing: true,
		instant: false,
		replacing: false,
		winGlow: false,
	};
	if (speed !== 'turbo') casinoAudio.play('card_deal');

	if (speed === 'turbo') {
		stateGame.cards[index] = {
			code,
			held,
			drawing: false,
			instant: true,
			replacing: false,
			winGlow: false,
		};
		return;
	}

	await waitForTimeout(speed === 'turboAuto' ? 40 : 60);
	stateGame.cards[index] = {
		code,
		held,
		drawing: false,
		instant: false,
		replacing: false,
		winGlow: false,
	};
	await waitForTimeout(CARD_FLIP_MS);
};

/** Reveal every card in a deal with staggered flip starts. */
export const revealDealHand = async (
	cards: { card: string }[],
	speed: RevealSpeed = revealSpeed(),
) => {
	stateGame.cards = cards.map(() => ({
		code: '',
		held: false,
		drawing: false,
		instant: speed === 'turbo',
		replacing: false,
		winGlow: false,
	}));
	clearWinPresentation();

	if (speed === 'turbo') {
		stateGame.cards = cards.map((c) => ({
			code: c.card,
			held: false,
			drawing: false,
			instant: true,
			replacing: false,
			winGlow: false,
		}));
		casinoAudio.play('card_deal_turbo');
		return;
	}

	if (speed === 'normal') await waitForTimeout(120);

	const stagger = speed === 'turboAuto' ? Math.min(DEAL_STAGGER_MS, 70) : DEAL_STAGGER_MS;
	const tasks: Promise<void>[] = [];
	for (let i = 0; i < cards.length; i++) {
		tasks.push(revealCardSlot(i, cards[i].card, false, speed));
		if (i < cards.length - 1) await waitForTimeout(stagger);
	}
	await Promise.all(tasks);

	stateGame.cards = cards.map((c) => ({
		code: c.card,
		held: false,
		drawing: false,
		instant: false,
		replacing: false,
		winGlow: false,
	}));
};

/** Reveal only non-held slots on draw, preserving held cards. */
export const revealDrawnCards = async (
	drawn: { card: string }[],
	finalHand: { card: string }[],
	holdMask: number,
) => {
	const isHeld = (mask: number, index: number) => Boolean(mask & (1 << index));
	let drawCursor = 0;
	const tasks: Promise<void>[] = [];
	let started = 0;
	for (let i = 0; i < stateGame.cards.length; i++) {
		if (isHeld(holdMask, i)) continue;
		const next = drawn[drawCursor++];
		const code = next?.card ?? finalHand[i]?.card ?? stateGame.cards[i].code;
		if (started > 0) await waitForTimeout(DEAL_STAGGER_MS);
		tasks.push(revealCardSlot(i, code, false, revealSpeed(), { replace: true }));
		started += 1;
	}
	await Promise.all(tasks);
	stateGame.cards = finalHand.map((c, index) => ({
		code: c.card,
		held: isHeld(holdMask, index),
		drawing: false,
		instant: false,
		replacing: false,
		winGlow: false,
	}));
};

/** Instant final board — same semantics as applyEventInstant in utils.ts. */
export const setDealHandInstant = (cards: { card: string }[]) => {
	clearWinPresentation();
	stateGame.cards = cards.map((c) => ({
		code: c.card,
		held: false,
		drawing: false,
		instant: true,
		replacing: false,
		winGlow: false,
	}));
};

export const setDrawHandInstant = (finalHand: { card: string }[], holdMask: number) => {
	const isHeld = (mask: number, index: number) => Boolean(mask & (1 << index));
	stateGame.cards = finalHand.map((c, index) => ({
		code: c.card,
		held: isHeld(holdMask, index),
		drawing: false,
		instant: true,
		replacing: false,
		winGlow: false,
	}));
};

export const clearWinPresentation = () => {
	stateGame.winSequenceToken += 1;
	stateGame.winAnimAmount = 0;
	stateGame.winAnimActive = false;
	stateGame.winPulse = false;
	stateGame.cards = stateGame.cards.map((c) => ({ ...c, winGlow: false }));
};

/** Staggered win glow → count-up → pulse. Non-blocking for the next Deal (token cancelled). */
export const playWinSequence = async (finalBookAmount: number) => {
	const token = ++stateGame.winSequenceToken;
	stateGame.winAnimActive = true;
	stateGame.winAnimAmount = 0;
	stateGame.winPulse = false;
	stateGame.cards = stateGame.cards.map((c) => ({ ...c, winGlow: false }));

	const n = stateGame.cards.length;
	for (let i = 0; i < n; i++) {
		if (token !== stateGame.winSequenceToken) return;
		stateGame.cards = stateGame.cards.map((c, idx) =>
			idx === i ? { ...c, winGlow: true } : c,
		);
		await waitForTimeout(150);
	}
	if (token !== stateGame.winSequenceToken) return;

	const duration = 650;
	const start = performance.now();
	await new Promise<void>((resolve) => {
		const tick = (now: number) => {
			if (token !== stateGame.winSequenceToken) {
				resolve();
				return;
			}
			const t = Math.min(1, (now - start) / duration);
			const eased = 1 - (1 - t) ** 3; // easeOut cubic
			stateGame.winAnimAmount = Math.round(finalBookAmount * eased);
			if (t < 1) {
				requestAnimationFrame(tick);
			} else {
				stateGame.winAnimAmount = finalBookAmount;
				resolve();
			}
		};
		requestAnimationFrame(tick);
	});

	if (token !== stateGame.winSequenceToken) return;
	stateGame.winPulse = true;
	stateGame.winAnimActive = false;
};
