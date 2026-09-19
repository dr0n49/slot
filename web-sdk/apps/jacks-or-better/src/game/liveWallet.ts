/** Client for the local NON-ENGINE live-hold wallet. Not RGS-compliant. */

import { playBookEvents, playBookEvent } from './utils';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import { eventEmitter } from './eventEmitter';
import { isLiveDevHudEnabled } from './liveDevHud';
import type { BookEvent } from './typesBookEvent';
import { stateBet } from 'state-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';

export const LIVE_WALLET_URL = 'http://127.0.0.1:8787';

const HEALTH_POLL_MS = 250;
const HEALTH_TIMEOUT_MS = 30_000;

type LiveDebug = NonNullable<(typeof stateGame)['liveDebug']>;

type WalletBalance = { amount: number; currency?: string };

type HealthResponse = {
	status?: string;
	readyForPlay?: boolean;
	readyForDecision?: boolean;
	bonusBuySupported?: boolean;
	pid?: number;
	tablesReady?: boolean;
	tablesError?: string | null;
	devWallet?: boolean;
};

type DoubleUpOffer = {
	step: number;
	maxSteps: number;
	amountAtRisk: number;
	category?: string;
};

type LiveActionPayload = {
	payoutMultiplier: number;
	state: BookEvent[];
	awaitingHold?: boolean;
	awaitingDoubleUp?: boolean;
	doubleUpOffer?: DoubleUpOffer;
};

type PlayResponse = {
	error?: string;
	balance?: WalletBalance;
	round?: LiveActionPayload & {
		active?: boolean;
		mode?: string;
		bonusBuy?: string;
		charge?: number;
		awaitingHold?: boolean;
	};
	warning?: string;
};

type ActionResponse = {
	error?: string;
	balance?: WalletBalance;
	action?: LiveActionPayload;
	debug?: LiveDebug;
	warning?: string;
};

let walletReadyInFlight: Promise<HealthResponse> | null = null;

const applyWalletBalance = (balance?: WalletBalance) => {
	if (!balance) return;
	stateBet.balanceAmount = balance.amount / API_AMOUNT_MULTIPLIER;
	if (balance.currency) stateBet.currency = balance.currency;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchWalletHealth = async (): Promise<HealthResponse> => {
	const url = `${LIVE_WALLET_URL}/health`;
	let response: Response;
	try {
		response = await fetch(url, { method: 'GET' });
	} catch (err) {
		throw new Error(
			`live wallet unreachable at ${url} — start games/jacks_or_better/live_wallet/server.py (${err})`,
		);
	}
	if (!response.ok) {
		throw new Error(`live wallet /health HTTP ${response.status}`);
	}
	return response.json() as Promise<HealthResponse>;
};

const pollWalletReady = async (): Promise<HealthResponse> => {
	stateGame.liveWalletStatus = 'starting';
	const deadline = Date.now() + HEALTH_TIMEOUT_MS;
	let lastErr = 'unknown';
	while (Date.now() < deadline) {
		try {
			const health = await fetchWalletHealth();
			if (health.readyForPlay) {
				stateGame.liveWalletStatus = 'ready';
				stateGame.liveWalletPid = health.pid ?? null;
				return health;
			}
			lastErr = `status=${health.status ?? 'unknown'}`;
		} catch (err) {
			lastErr = String(err);
		}
		await sleep(HEALTH_POLL_MS);
	}
	stateGame.liveWalletStatus = 'error';
	throw new Error(`live wallet not ready within ${HEALTH_TIMEOUT_MS / 1000}s — ${lastErr}`);
};

/** Ensure wallet accepts /wallet/play. Reuses in-flight poll; fast-path when already ready. */
export const ensureWalletReady = async (): Promise<HealthResponse> => {
	if (walletReadyInFlight) return walletReadyInFlight;

	if (stateGame.liveWalletStatus === 'ready') {
		try {
			const health = await fetchWalletHealth();
			if (health.readyForPlay) {
				stateGame.liveWalletPid = health.pid ?? null;
				return health;
			}
		} catch {
			// fall through to poll
		}
	}

	walletReadyInFlight = pollWalletReady().finally(() => {
		walletReadyInFlight = null;
	});
	return walletReadyInFlight;
};

/** @deprecated use ensureWalletReady */
export const waitForWalletReady = ensureWalletReady;

const post = async <T>(path: string, body: object): Promise<T> => {
	const url = `${LIVE_WALLET_URL}${path}`;
	let response: Response;
	try {
		response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sessionID: 'storybook-live', ...body }),
		});
	} catch (err) {
		stateGame.liveWalletStatus = 'error';
		throw new Error(
			`live wallet unreachable at ${url} — is the process still running on :8787? (${err})`,
		);
	}
	if (!response.ok) {
		throw new Error(`live wallet ${path} HTTP ${response.status}`);
	}
	return response.json() as Promise<T>;
};

const liveBetAmountApi = () => Math.round(stateBet.betAmount * API_AMOUNT_MULTIPLIER);

type PaytableRow = { name: string; multiplier: number };

const applyLivePaytable = (rows?: PaytableRow[]) => {
	if (rows?.length) stateGame.livePaytableRows = rows;
};

export const fetchLivePaytable = async (): Promise<PaytableRow[]> => {
	const response = await fetch(`${LIVE_WALLET_URL}/paytable`);
	if (!response.ok) throw new Error(`live wallet /paytable HTTP ${response.status}`);
	const data = (await response.json()) as { paytable?: PaytableRow[] };
	const rows = data.paytable ?? [];
	applyLivePaytable(rows);
	return rows;
};

export const enableLiveHoldMode = () => {
	stateGame.liveHold = true;
	stateGame.sourceLabel = 'LOCAL DEV WALLET — not Engine / not approval-ready';
};

/** Pixi dev HUD uses manual live-hold; casino shell keeps wallet flow without liveHold flag. */
export const enableWalletPlayMode = () => {
	if (isLiveDevHudEnabled()) {
		enableLiveHoldMode();
		return;
	}
	stateGame.liveHold = false;
	stateGame.sourceLabel = 'LOCAL DEV WALLET — not Engine / not approval-ready';
};

/** Authenticate against local wallet (or seed $1000 fallback) so Bet is enabled in Storybook. */
export const initLiveWalletBalance = async () => {
	try {
		await ensureWalletReady();
		await post<{ balance?: WalletBalance }>('/wallet/dev-reset', {});
		const auth = await post<{ balance?: WalletBalance; paytable?: PaytableRow[] }>(
			'/wallet/authenticate',
			{},
		);
		applyWalletBalance(auth.balance);
		applyLivePaytable(auth.paytable);
		if (!auth.paytable?.length) {
			try {
				await fetchLivePaytable();
			} catch {
				// paytable panel stays empty until wallet is reachable
			}
		}
		stateGame.roundState = 'idle';
	} catch {
		stateBet.balanceAmount = 1_000;
		stateBet.currency = 'USD';
		stateGame.liveWalletStatus = 'offline';
		stateGame.roundState = 'idle';
	}
};

const applyDoubleUpOffer = (offer?: DoubleUpOffer) => {
	if (!offer) return;
	stateGame.awaitingPlayerHold = false;
	stateGame.awaitingDoubleUpChoice = true;
	stateGame.doubleUpStep = offer.step;
	stateGame.doubleUpMaxSteps = offer.maxSteps;
	stateGame.doubleUpAmountAtRisk = offer.amountAtRisk;
	stateGame.doubleUpActive = true;
	stateGame.doubleUpSkipped = false;
	stateGame.doubleUpRevealed = false;
	stateGame.doubleUpRevealing = false;
	stateGame.doubleUpCard = '';
	stateGame.doubleUpColour = '';
	stateGame.doubleUpCorrect = null;
};

const playLiveEvents = async (events: BookEvent[], awaitingDoubleUp = false) => {
	const filtered = awaitingDoubleUp
		? events.filter((e) => e.type !== 'setTotalWin' && e.type !== 'finalWin')
		: events;
	await playBookEvents(filtered);
	stateGame.livePlayedEventCount = events.length;
};

export const isLiveRoundStartable = () =>
	stateGame.liveWalletEnabled &&
	!stateGame.liveBetRunning &&
	stateGame.liveWalletStatus !== 'offline' &&
	!stateGame.awaitingPlayerHold &&
	!stateGame.awaitingDoubleUpChoice &&
	!stateGame.awaitingCollect &&
	(stateGame.roundState === 'idle' ||
		stateGame.roundState === 'settled' ||
		stateGame.roundState === 'error' ||
		stateGame.roundState === 'timeout');

export const clearLiveBoard = () => {
	stateGame.cards = [];
	stateGame.holdMask = 0;
	stateGame.showHolds = false;
	stateGame.handCategory = '';
	stateGame.handAmount = 0;
	stateGame.awaitingPlayerHold = false;
	stateGame.liveHold = false;
	stateGame.doubleUpSkipped = false;
	stateGame.doubleUpActive = false;
	stateGame.awaitingDoubleUpChoice = false;
	stateGame.awaitingCollect = false;
	stateGame.continueCollect = null;
	stateGame.lockedPayoutMultiplier = 0;
	stateGame.liveDebug = null;
	stateGame.liveBonusBuy = null;
};

export const runLiveBetRound = async () => {
	if (stateGame.liveBetRunning) return;

	await ensureWalletReady();

	if (
		!isLiveRoundStartable() &&
		!(
			stateGame.roundState === 'idle' &&
			!stateGame.awaitingPlayerHold &&
			!stateGame.awaitingCollect &&
			!stateGame.awaitingDoubleUpChoice
		)
	) {
		return;
	}

	stateGame.liveBetRunning = true;
	let roundComplete = waitForLiveRoundComplete();
	try {
		await startLiveRound();
		await roundComplete;
	} catch (error) {
		roundComplete.cancel();
		clearLiveBoard();
		stateGame.roundState = 'idle';
		if (stateGame.liveWalletStatus !== 'offline') {
			stateGame.liveWalletStatus = 'ready';
		}
		throw error;
	} finally {
		stateGame.liveBetRunning = false;
	}
};

export const startLiveRound = async () => {
	stateGame.liveWalletEnabled = true;
	stateGameDerived.resetRound();
	enableWalletPlayMode();
	stateGame.sourceLabel = 'LOCAL DEV WALLET — not Engine / not approval-ready';
	stateGame.roundState = 'betPlaced';
	const data = await post<PlayResponse>('/wallet/play', {
		amount: liveBetAmountApi(),
		mode: 'liveHold',
	});
	if (data.error || !data.round?.state?.length) {
		stateGame.roundState = 'error';
		throw new Error(data.error || 'live wallet play failed');
	}
	applyWalletBalance(data.balance);
	stateGame.lockedPayoutMultiplier = 0;
	stateGame.liveRoundLocked = false;
	stateGame.livePlayedEventCount = 0;
	await playBookEvents(data.round.state);
	stateGame.livePlayedEventCount = data.round.state.length;
	stateGame.awaitingPlayerHold = true;
	stateGame.showHolds = true;
	stateGame.roundState = 'holdSelection';
};

export type LiveBonusKind = 'job' | 'flush';

const liveBonusMode = (kind: LiveBonusKind) =>
	kind === 'job' ? 'liveHoldBonus1' : 'liveHoldBonus2';

const liveBonusPriceMult = (kind: LiveBonusKind) => (kind === 'job' ? 2 : 10);

/** Fail fast when an outdated wallet process ignores bonus mode and deals normally. */
const assertBonusPlayResponse = (kind: LiveBonusKind, data: PlayResponse) => {
	const expectedMode = liveBonusMode(kind);
	const rnd = data.round;
	if (!rnd?.state?.length) {
		throw new Error('live wallet bonus play returned no round state');
	}
	if (rnd.mode !== expectedMode) {
		throw new Error(
			`Wallet ignored bonus mode "${expectedMode}" (got "${rnd.mode ?? 'none'}"). Restart games/jacks_or_better/live_wallet/server.py.`,
		);
	}
	if (!rnd.bonusBuy) {
		throw new Error(
			'Wallet returned a normal deal for bonus buy (missing bonusBuy). Restart live_wallet/server.py.',
		);
	}
	if (rnd.awaitingHold) {
		throw new Error(
			'Bonus buy must skip hold — wallet returned awaitingHold. Restart live_wallet/server.py.',
		);
	}
	if (!rnd.state.some((event) => event.type === 'handResult')) {
		throw new Error(
			'Bonus buy response missing handResult — wallet server is outdated. Restart live_wallet/server.py.',
		);
	}
	const expectedCharge = liveBetAmountApi() * liveBonusPriceMult(kind);
	if (rnd.charge != null && rnd.charge !== expectedCharge) {
		throw new Error(
			`Bonus buy charge mismatch: expected ${expectedCharge}, got ${rnd.charge}. Restart live_wallet/server.py.`,
		);
	}
};

export const runLiveBonusRound = async (kind: LiveBonusKind) => {
	if (stateGame.liveBetRunning) return;
	await ensureWalletReady();
	if (
		!isLiveRoundStartable() &&
		!(
			stateGame.roundState === 'idle' &&
			!stateGame.awaitingPlayerHold &&
			!stateGame.awaitingCollect &&
			!stateGame.awaitingDoubleUpChoice
		)
	) {
		return;
	}
	stateGame.liveBetRunning = true;
	const roundComplete = waitForLiveRoundComplete();
	try {
		await startLiveBonusRound(kind);
		await roundComplete;
	} catch (error) {
		roundComplete.cancel();
		clearLiveBoard();
		stateGame.roundState = 'idle';
		if (stateGame.liveWalletStatus !== 'offline') {
			stateGame.liveWalletStatus = 'ready';
		}
		throw error;
	} finally {
		stateGame.liveBetRunning = false;
	}
};

export const startLiveBonusRound = async (kind: LiveBonusKind) => {
	stateGame.liveWalletEnabled = true;
	stateGameDerived.resetRound();
	enableWalletPlayMode();
	stateGame.liveBonusBuy = kind;
	stateGame.roundState = 'betPlaced';
	const data = await post<PlayResponse>('/wallet/play', {
		amount: liveBetAmountApi(),
		mode: liveBonusMode(kind),
	});
	if (data.error || !data.round?.state?.length) {
		stateGame.roundState = 'error';
		stateGame.liveBonusBuy = null;
		throw new Error(data.error || 'live wallet bonus play failed');
	}
	assertBonusPlayResponse(kind, data);
	applyWalletBalance(data.balance);
	stateGame.lockedPayoutMultiplier = 0;
	stateGame.liveRoundLocked = false;
	stateGame.livePlayedEventCount = 0;
	await playBookEvents(data.round.state);
	stateGame.livePlayedEventCount = data.round.state.length;
	if (data.round.awaitingDoubleUp && data.round.doubleUpOffer) {
		applyDoubleUpOffer(data.round.doubleUpOffer);
		stateGame.roundState = 'doubleUpRound';
		return;
	}
	await finalizeLiveRound({
		payoutMultiplier: data.round.payoutMultiplier ?? 0,
		state: data.round.state,
	});
	stateGame.liveBonusBuy = null;
};

export const submitLiveHold = async () => {
	if (!stateGame.awaitingPlayerHold) return;
	if (!stateGame.liveHold && !stateGame.liveWalletEnabled) return;
	const holdMask = stateGame.cards.reduce((mask, card, index) => (card.held ? mask | (1 << index) : mask), 0);
	stateGame.awaitingPlayerHold = false;
	const data = await post<ActionResponse>('/bet/action', {
		action: 'DECISION',
		meta: { phase: 'hold', holdMask },
	});
	if (data.error || !data.action?.state) {
		stateGame.roundState = 'error';
		stateGame.awaitingPlayerHold = true;
		throw new Error(data.error || 'live wallet hold DECISION failed');
	}
	stateGame.liveDebug = data.debug ?? null;
	applyWalletBalance(data.balance);
	const events = data.action.state;
	const rest = events.slice(1).filter((e) => e.type !== 'deal');
	await playLiveEvents(rest, Boolean(data.action.awaitingDoubleUp));
	if (data.action.awaitingDoubleUp && data.action.doubleUpOffer) {
		applyDoubleUpOffer(data.action.doubleUpOffer);
		stateGame.roundState = 'doubleUpRound';
		return;
	}
	await finalizeLiveRound(data.action);
};

export const submitLiveDoubleUpChoice = async (choice: 'collect' | 'red' | 'black') => {
	if (!stateGame.awaitingDoubleUpChoice) return;
	if (!stateGame.liveHold && !stateGame.liveWalletEnabled) return;
	stateGame.awaitingDoubleUpChoice = false;
	const prevCount = stateGame.livePlayedEventCount;
	const data = await post<ActionResponse>('/bet/action', {
		action: 'DECISION',
		meta: { phase: 'doubleUp', choice },
	});
	if (data.error || !data.action?.state) {
		stateGame.awaitingDoubleUpChoice = true;
		stateGame.roundState = 'error';
		throw new Error(data.error || 'live wallet double-up DECISION failed');
	}
	applyWalletBalance(data.balance);
	const newEvents = data.action.state.slice(prevCount);
	for (const event of newEvents) {
		await playBookEvent(event);
	}
	stateGame.livePlayedEventCount = data.action.state.length;
	if (data.action.awaitingDoubleUp && data.action.doubleUpOffer) {
		applyDoubleUpOffer(data.action.doubleUpOffer);
		stateGame.roundState = 'doubleUpRound';
		return;
	}
	await finalizeLiveRound(data.action);
};

const finalizeLiveRound = async (action: LiveActionPayload) => {
	stateGame.lockedPayoutMultiplier = action.payoutMultiplier ?? 0;
	stateGame.liveRoundLocked = true;
	stateGame.awaitingDoubleUpChoice = false;
	stateGame.doubleUpActive = false;
	stateGame.liveHold = false;
	stateGame.liveBonusBuy = null;
	stateGame.roundState = 'settled';
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
	const end = await post<{ balance?: WalletBalance; error?: string }>('/wallet/end-round', {});
	if (end.error) {
		throw new Error(end.error);
	}
	applyWalletBalance(end.balance);
	stateGame.liveWalletStatus = 'ready';
	stateGame.roundState = 'idle';
	stateGame.continueLiveRound?.();
	stateGame.continueLiveRound = null;
};

type RoundCompleteHandle = Promise<void> & { cancel: () => void };

export const waitForLiveRoundComplete = (): RoundCompleteHandle => {
	let cancel = () => {};
	const promise = new Promise<void>((resolve) => {
		stateGame.continueLiveRound = resolve;
		cancel = () => {
			if (stateGame.continueLiveRound === resolve) {
				stateGame.continueLiveRound = null;
			}
			resolve();
		};
	}) as RoundCompleteHandle;
	promise.cancel = () => cancel();
	return promise;
};
