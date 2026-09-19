<script lang="ts">
	import { EnablePixiExtension } from 'components-pixi';
	import { EnableHotkey } from 'components-shared';
	import { MainContainer } from 'components-layout';
	import { App, Text, REM } from 'pixi-svelte';
	import { UI, UiGameName } from 'components-ui-pixi';
	import { GameVersion, Modals } from 'components-ui-html';
	import { stateBet, stateModal } from 'state-shared';
	import { PUBLIC_CHROMATIC } from 'envs';

	import { getContext } from '../game/context';
	import { stateGame } from '../game/stateGame.svelte';
	import { formatMultiplier, CARD_WIDTH, CARD_HEIGHT, CARD_GAP, HAND_SIZE, liveHoldCardOriginY, LIVE_HOLD_OVERLAY_BOTTOM_PX, LIVE_HOLD_CARD_Y_RATIO, LIVE_HOLD_CARD_HALF_HEIGHT_PX } from '../game/constants';
	import { isCasinoShell, isLiveDevHudEnabled } from '../game/liveDevHud';
	import { submitLiveHold, submitLiveDoubleUpChoice } from '../game/liveWallet';
	import EnableGameActor from './EnableGameActor.svelte';
	import HoldSelection from './HoldSelection.svelte';
	import DoubleUp from './DoubleUp.svelte';
	import LiveBonusBuyBar from './LiveBonusBuyBar.svelte';
	import CasinoMachine from './casino/CasinoMachine.svelte';
	import ResumeBet from './ResumeBet.svelte';

	const context = getContext();
	const layout = $derived(context.stateLayoutDerived.mainLayout());
	const showLiveDevHud = $derived(isLiveDevHudEnabled());
	const casinoMode = $derived(isCasinoShell());
	const liveHandWidth = HAND_SIZE * CARD_WIDTH + (HAND_SIZE - 1) * CARD_GAP;
	const liveOriginX = $derived(layout.width * 0.5 - liveHandWidth / 2);
	const liveOriginY = $derived(
		stateGame.liveWalletEnabled
			? liveHoldCardOriginY(layout.height)
			: layout.height * 0.5 - CARD_HEIGHT / 2 - 40,
	);

	const toggleLiveHold = (index: number) => {
		if (!stateGame.liveHold || !stateGame.awaitingPlayerHold) return;
		const nextHeld = !stateGame.cards[index].held;
		stateGame.cards[index] = { ...stateGame.cards[index], held: nextHeld };
		stateGame.holdMask = stateGame.cards.reduce(
			(mask, card, i) => (card.held ? mask | (1 << i) : mask),
			0,
		);
		stateGame.showHolds = true;
	};

	const liveHoldRootStyle = $derived(
		stateGame.liveWalletEnabled
			? `--live-hold-overlay-bottom: ${LIVE_HOLD_OVERLAY_BOTTOM_PX}px; --live-hold-card-y-ratio: ${LIVE_HOLD_CARD_Y_RATIO}; --live-hold-card-half-height: ${LIVE_HOLD_CARD_HALF_HEIGHT_PX}px`
			: undefined,
	);

	$effect(() => {
		if (context.stateApp.loaded) {
			context.stateLayout.showLoadingScreen = false;
		}
	});

	$effect(() => {
		if (stateModal.modal?.name === 'error') {
			const raw = JSON.stringify(stateModal.modal.error ?? '');
			stateGame.roundState = /timeout|timed out|aborted|AbortError/i.test(raw)
				? 'timeout'
				: 'error';
		}
	});
</script>

<div class="game-root" style={liveHoldRootStyle} class:casino-mode={casinoMode}>
	{#if casinoMode}
		<CasinoMachine />
		<EnableHotkey />
	{/if}

	<div class="pixi-layer" class:hidden={casinoMode}>
	<App>
		{#if !casinoMode}
			<EnableHotkey />
		{/if}
		<EnableGameActor />
		<EnablePixiExtension />

		<ResumeBet />

		<MainContainer>
			<HoldSelection />
			<DoubleUp />
		</MainContainer>

		<UI hideBuyBonus={casinoMode} hideAutoSpin={casinoMode} hideUI={casinoMode}>
			{#snippet gameName()}
				<UiGameName
					name={casinoMode
						? 'JACKS OR BETTER'
						: stateGame.liveHold
							? 'JOB LIVE-HOLD (DEV)'
							: 'JACKS OR BETTER'}
				/>
			{/snippet}
			{#snippet logo()}
				<Text
					anchor={{ x: 1, y: 0 }}
					text="7 / 5"
					style={{
						fontFamily: 'proxima-nova',
						fontSize: REM * 1.5,
						fontWeight: '600',
						lineHeight: REM * 2,
						fill: 0xffffff,
					}}
				/>
			{/snippet}
		</UI>
	</App>
	</div>

	<Modals>
		{#snippet version()}
			<GameVersion version="0.0.0" />
		{/snippet}
	</Modals>

	{#if stateGame.liveWalletEnabled && showLiveDevHud}
		<div class="top-right-hud">
			<div class="dev-badge">JOB LIVE-HOLD (DEV) · 7/5</div>
			{#if stateGame.sourceLabel}
				<div class="source-label">{stateGame.sourceLabel}</div>
			{/if}
			<div class="round-hud" data-round-state={stateGame.roundState}>
				{#if stateGame.liveWalletStatus === 'offline'}
					wallet offline — start live_wallet/server.py on :8787
				{:else}
					{stateGame.roundState}{#if stateGame.liveWalletStatus === 'starting'}
						{' '}· wallet starting up…{/if}{#if stateGame.liveWalletStatus === 'ready' && stateGame.liveWalletPid}
						{' '}· wallet pid {stateGame.liveWalletPid}{/if}{#if stateGame.awaitingPlayerHold}
						{' '}· holdMask {stateGame.holdMask}{/if}{#if stateGame.roundState !== 'idle'}
						{' '}· locked {formatMultiplier(stateGame.lockedPayoutMultiplier)}{/if}{#if stateGame.awaitingCollect || stateGame.roundState === 'settled'}
						{' '}· ui {formatMultiplier(stateBet.winBookEventAmount)}{/if}{#if stateGame.liveDebug}
						{' '}· player poker {stateGame.liveDebug.playerPokerWin}× vs optimal-same-deck {stateGame.liveDebug.optimalPokerWinSameDeck}×{/if}
				{/if}
			</div>
		</div>
	{:else if PUBLIC_CHROMATIC || stateGame.liveHold}
		<div class="top-right-hud">
			<div class="round-hud" data-round-state={stateGame.roundState}>{stateGame.roundState}</div>
		</div>
	{/if}

	{#if !casinoMode}
		<LiveBonusBuyBar />
	{/if}

	{#if !casinoMode}
		{#if stateGame.liveWalletEnabled && stateGame.liveWalletStatus === 'starting'}
			<div class="draw-overlay">
				<p class="hint">Wallet starting up…</p>
			</div>
		{:else if stateGame.liveHold && stateGame.awaitingDoubleUpChoice}
			<div class="draw-overlay">
				<p class="hint">
					Double-up stage {stateGame.doubleUpStep} of {stateGame.doubleUpMaxSteps} — at risk
					{formatMultiplier(stateGame.doubleUpAmountAtRisk)}. Pick a colour or collect now.
				</p>
				<div class="du-actions">
					<button
						class="draw collect"
						onclick={() => {
							void submitLiveDoubleUpChoice('collect');
						}}
					>
						Collect {formatMultiplier(stateGame.doubleUpAmountAtRisk)}
					</button>
					<button
						class="draw red"
						onclick={() => {
							void submitLiveDoubleUpChoice('red');
						}}
					>
						Pick Red
					</button>
					<button
						class="draw black"
						onclick={() => {
							void submitLiveDoubleUpChoice('black');
						}}
					>
						Pick Black
					</button>
				</div>
			</div>
		{:else if stateGame.liveHold && stateGame.awaitingPlayerHold}
			<div class="card-hits">
				{#each stateGame.cards as card, index (index)}
					<button
						class="card-hit"
						class:held={card.held}
						style="left: {(liveOriginX + index * (CARD_WIDTH + CARD_GAP)) / layout.width * 100}%; top: {liveOriginY / layout.height * 100}%; width: {CARD_WIDTH / layout.width * 100}%; height: {CARD_HEIGHT / layout.height * 100}%;"
						aria-label={card.held ? `Unhold card ${index + 1}` : `Hold card ${index + 1}`}
						onclick={() => toggleLiveHold(index)}
					></button>
				{/each}
			</div>
			<div class="draw-overlay">
				<p class="hint">Click cards to hold, then Draw.</p>
				<button
					class="draw"
					onclick={() => {
						void submitLiveHold();
					}}
				>
					Draw
				</button>
			</div>
		{:else if stateGame.awaitingDraw}
			<div class="draw-overlay">
				<p class="hint">Playback only — Draw continues the book. Holds cannot be changed.</p>
				<button
					class="draw"
					onclick={() => {
						stateGame.continueDraw?.();
					}}
				>
					Continue playback — Draw
				</button>
			</div>
		{:else if stateGame.awaitingDoubleUpReveal}
			<div class="draw-overlay">
				<p class="hint">Playback only — Reveal continues the book. Colour is not a player choice.</p>
				<button
					class="draw"
					onclick={() => {
						stateGame.continueDoubleUpReveal?.();
					}}
				>
					Continue playback — Reveal
				</button>
			</div>
		{:else if stateGame.awaitingCollect && !stateGame.liveHold}
			<div class="draw-overlay">
				<p class="hint">
					{stateGame.liveHold
						? `Live-hold payout locked at ${formatMultiplier(stateGame.lockedPayoutMultiplier)} after DECISION. Collect credits the local wallet.`
						: `Book payout is locked at ${formatMultiplier(stateGame.lockedPayoutMultiplier)}. Collect settles the round — it does not change the outcome.`}
				</p>
				<button
					class="draw"
					onclick={() => {
						stateGame.continueCollect?.();
					}}
				>
					Collect
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.game-root {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.game-root.casino-mode {
		width: 100%;
		height: 100%;
		max-height: 100%;
		overflow: hidden;
	}
	:global(html:has(.game-root.casino-mode)),
	:global(body:has(.game-root.casino-mode)) {
		height: 100%;
		max-height: 100%;
		overflow: hidden;
		padding: 0;
		margin: 0;
		display: block;
	}
	:global(body:has(.game-root.casino-mode) > div) {
		height: 100%;
		max-height: 100%;
		overflow: hidden;
	}
	.pixi-layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.pixi-layer.hidden {
		opacity: 0;
		pointer-events: none;
		z-index: -1;
		overflow: hidden;
	}
	.round-hud {
		margin: 0;
		padding: 4px 10px;
		border-radius: 6px;
		background: rgba(15, 23, 42, 0.82);
		color: #f8fafc;
		font-family: proxima-nova, sans-serif;
		font-size: 12px;
		pointer-events: none;
		max-width: 420px;
		text-align: right;
	}
	.top-right-hud {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 21;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
		pointer-events: none;
	}
	.dev-badge {
		padding: 4px 10px;
		border-radius: 6px;
		background: rgba(15, 23, 42, 0.9);
		color: #f8fafc;
		font-family: proxima-nova, sans-serif;
		font-size: 14px;
		font-weight: 700;
	}
	.source-label {
		padding: 4px 10px;
		border-radius: 6px;
		background: rgba(120, 53, 15, 0.85);
		color: #fbbf24;
		font-family: proxima-nova, sans-serif;
		font-size: 11px;
		max-width: 420px;
		text-align: right;
	}
	.card-hits {
		position: absolute;
		inset: 0;
		z-index: 19;
		pointer-events: none;
	}
	.card-hit {
		position: absolute;
		pointer-events: auto;
		padding: 0;
		border: 2px solid transparent;
		border-radius: 12px;
		background: transparent;
		cursor: pointer;
	}
	.card-hit.held {
		border-color: rgba(212, 160, 23, 0.35);
	}
	.draw-overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: var(--live-hold-overlay-bottom, 140px);
		z-index: 20;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		pointer-events: none;
	}
	.hint {
		margin: 0;
		color: #e2e8f0;
		font-family: proxima-nova, sans-serif;
		font-size: 14px;
		text-align: center;
		max-width: 640px;
	}
	.draw {
		pointer-events: auto;
		border: none;
		border-radius: 8px;
		padding: 12px 28px;
		background: #d4a017;
		color: #111827;
		font-family: proxima-nova, sans-serif;
		font-size: 18px;
		font-weight: 700;
		cursor: pointer;
	}
	.du-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		justify-content: center;
		pointer-events: auto;
	}
	.draw.collect {
		background: #22c55e;
		color: #052e16;
	}
	.draw.red {
		background: #dc2626;
		color: #fef2f2;
	}
	.draw.black {
		background: #1e293b;
		color: #f8fafc;
	}
</style>
