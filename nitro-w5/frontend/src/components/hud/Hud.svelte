<script lang="ts">
	import { stateBet, stateBetDerived, stateModal, stateSound } from 'state-shared';
	import { OnHotkey } from 'components-shared';

	import { getContext } from '../../game/context';
	import { betAmountIndex, formatAmount, formatBookWin, resolvedBetAmountOptions } from '../../game/constants';
	import { releaseContinue, requestSkip, tapBigWin } from '../../game/presentation';
	import { sfx } from '../../game/sfx';
	import { hideBanner, showBanner, stateGame } from '../../game/stateGame.svelte';
	import { uiState } from '../../game/uiState.svelte';
	import { ICONS } from './icons';

	/**
	 * The one and only HUD. Layout, proportions and styling follow the Muerta Poker bottom bar:
	 * [info · sound · BONUS · balance] … [win] … [bet ± · SPIN · turbo · auto].
	 */
	type Props = { height: number };
	const { height }: Props = $props();

	const context = getContext();

	const xIdle = $derived(context.stateXstateDerived.isIdle());
	const isAuto = $derived(context.stateXstateDerived.isAutoBetting());
	const autoStopping = $derived(isAuto && stateBet.autoSpinsCounter === 0);
	const dialogOpen = $derived(stateModal.modal !== null || uiState.infoOpen || uiState.buyOpen);
	const roundRunning = $derived(stateGame.phase !== 'IDLE');

	const canSpin = $derived(stateGame.sceneReady && xIdle && stateGame.phase === 'IDLE' && !isAuto);
	const canChangeBet = $derived(stateGame.sceneReady && xIdle && stateGame.phase === 'IDLE' && !isAuto);
	const canToggleAuto = $derived(stateGame.sceneReady && (isAuto || (xIdle && stateGame.phase === 'IDLE')));
	const canBuy = $derived(canChangeBet);
	const hasOverlay = $derived(
		Boolean(stateGame.bigWin || stateGame.featureIntro || stateGame.featureOutro || stateGame.awaitingContinue),
	);
	const canSkip = $derived(roundRunning && !hasOverlay && !stateGame.skip);

	const spinLabel = $derived(
		isAuto ? (autoStopping ? 'Stopping' : 'Stop auto play') : hasOverlay ? 'Continue' : roundRunning ? 'Skip' : 'Spin',
	);
	const spinIcon = $derived(isAuto ? ICONS.stop : hasOverlay || roundRunning ? ICONS.ffwd : null);
	const autoCount = $derived(
		isAuto && Number.isFinite(stateBet.autoSpinsCounter) && stateBet.autoSpinsCounter > 0
			? String(stateBet.autoSpinsCounter)
			: '',
	);

	// ---- readouts -----------------------------------------------------------------------------
	const winDisplay = $derived(formatBookWin(stateGame.displayWin));
	const showWin = $derived(stateGame.displayWin > 0);
	const balance = $derived(formatAmount(stateBet.balanceAmount));
	const betText = $derived(formatAmount(stateBet.betAmount));

	// ---- bet ---------------------------------------------------------------------------------
	const betOptions = $derived(resolvedBetAmountOptions());
	const betIdx = $derived(betAmountIndex(stateBet.betAmount, betOptions));
	const atMin = $derived(betIdx <= 0);
	const atMax = $derived(betIdx >= betOptions.length - 1);
	const setBet = (amount: number) => {
		sfx.unlock();
		sfx.play('bet_change');
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateBetDerived.setBetAmount(amount);
	};
	const stepUp = () => {
		if (!canChangeBet || atMax) return;
		setBet(betOptions[betIdx + 1]);
	};
	const stepDown = () => {
		if (!canChangeBet || atMin) return;
		setBet(betOptions[betIdx - 1]);
	};

	// ---- sound -------------------------------------------------------------------------------
	const volume = $derived(stateSound.volumeValueMaster);
	const muted = $derived(volume === 0);
	let volumeOpen = $state(false);
	let lastVolume = 75;
	const setMaster = (value: number) => {
		stateSound.volumeValueMaster = Math.max(0, Math.min(100, Math.round(value)));
		sfx.applyVolumes();
	};
	const toggleMute = () => {
		sfx.unlock();
		if (stateSound.volumeValueMaster > 0) {
			lastVolume = stateSound.volumeValueMaster;
			setMaster(0);
		} else {
			setMaster(lastVolume || 75);
		}
		sfx.play('ui_toggle');
	};
	const toggleVolumePanel = () => {
		sfx.unlock();
		sfx.play('ui_click');
		volumeOpen = !volumeOpen;
	};
	const onSlider = (event: Event) => setMaster(Number((event.currentTarget as HTMLInputElement).value));
	const onWindowClick = (event: MouseEvent) => {
		if (!(event.target as HTMLElement).closest('.hud-sound-wrap')) volumeOpen = false;
	};
	const onWindowKey = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && volumeOpen) volumeOpen = false;
	};
	$effect(() => {
		// follow the settings-modal sliders too
		void stateSound.volumeValueMaster;
		void stateSound.volumeValueMusic;
		void stateSound.volumeValueSoundEffect;
		sfx.applyVolumes();
	});

	// ---- actions -----------------------------------------------------------------------------
	const tone = (name: 'ui_click' | 'ui_open' | 'ui_toggle') => {
		sfx.unlock();
		sfx.play(name);
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
	};
	const toggleTurbo = () => {
		tone('ui_toggle');
		stateBetDerived.updateIsTurbo(!stateBet.isTurbo, { persistent: true });
	};
	const openInfo = () => {
		tone('ui_open');
		uiState.infoOpen = true;
	};
	const openBuy = () => {
		if (!canBuy) return;
		tone('ui_open');
		uiState.buyOpen = true;
	};
	const toggleAuto = () => {
		if (!canToggleAuto) return;
		tone('ui_click');
		if (isAuto) {
			// finishes the running round, then the auto loop ends
			stateBet.autoSpinsCounter = 0;
			return;
		}
		stateModal.modal = { name: 'autoSpin' };
	};

	let insufficientTimer: ReturnType<typeof setTimeout> | undefined;
	const onSpin = () => {
		sfx.unlock();
		if (stateGame.bigWin) return tapBigWin();
		if (stateGame.awaitingContinue) return releaseContinue();
		if (isAuto) return toggleAuto();
		if (canSpin) {
			if (!stateBetDerived.isBetCostAvailable()) {
				sfx.play('error');
				const id = showBanner('INSUFFICIENT BALANCE', 'Lower your bet or add funds', 'warn');
				clearTimeout(insufficientTimer);
				insufficientTimer = setTimeout(() => hideBanner(id), 2200);
				return;
			}
			sfx.play('ui_click');
			context.eventEmitter.broadcast({ type: 'soundPressBet' });
			context.eventEmitter.broadcast({ type: 'bet' });
			return;
		}
		if (canSkip) requestSkip();
	};
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKey} />
<OnHotkey hotkey="Space" disabled={dialogOpen || !stateGame.sceneReady} onpress={onSpin} />

<div class="hud-root" style="height: {height}px">
	<div class="hud-bar">
		<div class="hud-inner">
			<div class="hud-left">
				<div class="hud-tools">
					<button type="button" class="hud-chip-btn info" aria-label="Game info and paytable" onclick={openInfo}>
						<svg viewBox="0 0 24 24" class="ico-info" aria-hidden="true">
							<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="2" />
							<path fill="currentColor" d="M11.05 10.2h1.9V17.4h-1.9z" />
							<circle cx="12" cy="7.35" r="1.15" fill="currentColor" />
						</svg>
					</button>

					<div class="hud-sound-wrap">
						<button
							type="button"
							class="hud-chip-btn snd"
							class:is-muted={muted}
							aria-label="Sound"
							aria-expanded={volumeOpen}
							onclick={toggleVolumePanel}
						>
							<svg viewBox="0 0 24 24" class="ico-sound" aria-hidden="true">
								<path
									fill="currentColor"
									d="M3.4 8.6h3.15L10.9 4.8v14.4L6.55 15.4H3.4c-.7 0-1.15-.48-1.15-1.18V9.78c0-.7.45-1.18 1.15-1.18Z"
								/>
								{#if muted}
									<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14.4 9.4l5.6 5.2M20 9.4l-5.6 5.2" />
								{:else}
									<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14.15 9.2a3.15 3.15 0 0 1 0 5.6" />
									<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16.85 6.85a6.05 6.05 0 0 1 0 10.3" />
								{/if}
							</svg>
						</button>
						{#if volumeOpen}
							<div class="hud-vol-pop" role="group" aria-label="Volume">
								<button type="button" class="hud-vol-pop-btn" aria-label={muted ? 'Unmute' : 'Mute'} onclick={toggleMute}>
									<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
										<path
											fill="currentColor"
											d="M3.4 8.6h3.15L10.9 4.8v14.4L6.55 15.4H3.4c-.7 0-1.15-.48-1.15-1.18V9.78c0-.7.45-1.18 1.15-1.18Z"
										/>
										{#if muted}
											<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14.4 9.4l5.6 5.2M20 9.4l-5.6 5.2" />
										{:else}
											<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14.15 9.2a3.15 3.15 0 0 1 0 5.6" />
										{/if}
									</svg>
								</button>
								<input
									type="range"
									class="hud-vol-slider"
									min="0"
									max="100"
									step="1"
									value={volume}
									aria-label="Master volume"
									style="--hud-vol: {volume}%"
									oninput={onSlider}
								/>
								<span class="hud-vol-num">{volume}</span>
							</div>
						{/if}
					</div>

					<button
						type="button"
						class="hud-bonus-btn"
						disabled={!canBuy}
						onclick={openBuy}
						aria-label="Buy bonus"
						data-testid="buy"
					>
						BONUS
					</button>
				</div>

				<div class="hud-meter left">
					<div class="hud-meter-label">Balance</div>
					<div class="hud-meter-value" data-testid="balance-value">{balance}</div>
				</div>
			</div>

			<div class="hud-win" class:on={showWin} class:count={stateGame.winCounting} aria-live="polite">
				<div class="hud-win-copy">
					<span class="hud-win-label">Win</span>
					<span class="hud-win-amount" data-testid="win-value">{winDisplay}</span>
				</div>
			</div>

			<div class="hud-right">
				<div class="hud-stake">
					<div class="hud-meter right">
						<div class="hud-meter-label">Bet</div>
						<div class="hud-meter-value" data-testid="bet-value">{betText}</div>
					</div>
					<div class="hud-bet-col">
						<button
							type="button"
							class="hud-icon-btn"
							aria-label="Increase bet"
							disabled={!canChangeBet || atMax}
							onclick={stepUp}
						>
							<svg viewBox="0 0 24 24" class="ico-step" aria-hidden="true"><path fill="currentColor" d="M10.4 4.5h3.2v15h-3.2zM4.5 10.4h15v3.2h-15z" /></svg>
						</button>
						<button
							type="button"
							class="hud-icon-btn"
							aria-label="Decrease bet"
							disabled={!canChangeBet || atMin}
							onclick={stepDown}
						>
							<svg viewBox="0 0 24 24" class="ico-step" aria-hidden="true"><rect x="4.5" y="10.4" width="15" height="3.2" rx="0.6" fill="currentColor" /></svg>
						</button>
					</div>
				</div>

				<div class="hud-spin-slot">
					<button
						type="button"
						class="respin-btn hud-spin"
						class:auto={isAuto}
						disabled={!canSpin && !canSkip && !isAuto && !hasOverlay}
						onclick={onSpin}
						aria-label={spinLabel}
						data-testid="spin"
					>
						{#if spinIcon}
							<svg viewBox="0 0 24 24" class="spin-glyph" aria-hidden="true"><path fill="currentColor" d={spinIcon} /></svg>
						{:else}
							<svg viewBox="0 0 24 24" class="spin-arrow" aria-hidden="true">
								<path fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" d="M20.29 12.29A8.3 8.3 0 0 1 6.55 18.26" />
								<path fill="currentColor" stroke="currentColor" stroke-width="0.7" stroke-linejoin="round" d="M2.53 14.57 7.94 15.62 3.84 19.65z" />
								<path fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" d="M3.71 11.71A8.3 8.3 0 0 1 17.45 5.74" />
								<path fill="currentColor" stroke="currentColor" stroke-width="0.7" stroke-linejoin="round" d="M21.47 9.43 16.06 8.38 20.16 4.35z" />
							</svg>
						{/if}
					</button>
				</div>

				<div class="hud-fx-row">
					<button
						type="button"
						class="hud-sq-btn"
						class:is-on={stateBet.isTurbo}
						aria-pressed={stateBet.isTurbo}
						aria-label="Turbo"
						title="Turbo"
						onclick={toggleTurbo}
						data-testid="turbo"
					>
						<svg viewBox="0 0 24 24" class="ico-bolt" aria-hidden="true"><path fill="currentColor" d="M13.4 1.6 5.2 13.4h5.4L8.3 22.4 19.1 9.5h-5.6L13.4 1.6z" /></svg>
					</button>
					<button
						type="button"
						class="hud-sq-btn"
						class:is-on={isAuto}
						aria-pressed={isAuto}
						aria-label={isAuto ? 'Stop auto play' : 'Auto play'}
						title="Auto"
						disabled={!canToggleAuto}
						onclick={toggleAuto}
						data-testid="auto"
					>
						<svg viewBox="0 0 24 24" class="ico-loop" aria-hidden="true">
							<path fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" d="M20.29 12.29A8.3 8.3 0 0 1 6.55 18.26" />
							<path fill="currentColor" stroke="currentColor" stroke-width="0.7" stroke-linejoin="round" d="M2.53 14.57 7.94 15.62 3.84 19.65z" />
							<path fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" d="M3.71 11.71A8.3 8.3 0 0 1 17.45 5.74" />
							<path fill="currentColor" stroke="currentColor" stroke-width="0.7" stroke-linejoin="round" d="M21.47 9.43 16.06 8.38 20.16 4.35z" />
						</svg>
						{#if autoCount}<span class="auto-count">{autoCount}</span>{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* ---- Muerta Poker palette, scoped to the HUD ------------------------------------------- */
	.hud-root {
		--ink: #0a0607;
		--bone: #f1e6cc;
		--bone-dim: #b7a98a;
		--blood: #c8102e;
		--blood-hi: #ff3b4e;
		--blood-deep: #7d0a1a;
		--gold: #e2b04a;
		--gold-hi: #ffd97a;
		--gold-dk: #8f6318;
		--f-display: 'Pirata One', 'Palatino Linotype', Georgia, serif;
		--f-ui: 'Oswald', system-ui, sans-serif;

		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 20;
		pointer-events: auto;
		box-sizing: border-box;
		font-family: var(--f-ui);
		overflow: visible;
	}
	.hud-root :global(*) {
		box-sizing: border-box;
	}
	.hud-bar {
		display: flex;
		align-items: center;
		width: 100%;
		height: 100%;
		background: #000;
		box-shadow: 0 -14px 30px rgba(0, 0, 0, 0.7);
		overflow: visible;
	}
	.hud-inner {
		position: relative;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		width: 100%;
		gap: 12px;
		padding: 11px 24px 14px;
		overflow: visible;
	}

	/* ---- left --------------------------------------------------------------------------------- */
	.hud-left {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.hud-tools {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* shared square-ish buttons */
	.hud-chip-btn,
	.hud-icon-btn,
	.hud-sq-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		padding: 0;
		color: var(--bone);
		background: linear-gradient(180deg, #2a2a2e, #0a0a0c);
		border: 2px solid var(--ink);
		box-shadow:
			0 0 0 1.5px var(--bone-dim),
			0 3px 0 1.5px var(--ink);
		cursor: pointer;
		transition:
			transform 0.14s ease-out,
			box-shadow 0.14s ease-out;
	}
	.hud-chip-btn:not(:disabled):hover,
	.hud-icon-btn:not(:disabled):hover,
	.hud-sq-btn:not(:disabled):hover {
		transform: translateY(-1px);
		box-shadow:
			0 0 0 1.5px var(--gold),
			0 4px 0 1.5px var(--ink),
			0 0 14px rgba(226, 176, 74, 0.35);
	}
	.hud-chip-btn:not(:disabled):active,
	.hud-icon-btn:not(:disabled):active,
	.hud-sq-btn:not(:disabled):active {
		transition-duration: 80ms;
		transform: translateY(2px);
		box-shadow:
			0 0 0 1.5px var(--gold),
			0 1px 0 1.5px var(--ink);
	}
	.hud-chip-btn:disabled,
	.hud-icon-btn:disabled,
	.hud-sq-btn:disabled,
	.hud-bonus-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.hud-chip-btn:focus-visible,
	.hud-icon-btn:focus-visible,
	.hud-sq-btn:focus-visible,
	.hud-bonus-btn:focus-visible,
	.respin-btn:focus-visible {
		outline: 3px solid var(--gold-hi);
		outline-offset: 3px;
	}
	.hud-chip-btn {
		width: 30px;
		height: 30px;
		border-radius: 6px;
	}
	.hud-chip-btn svg {
		width: 72%;
		height: 72%;
	}

	.hud-bonus-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
		padding: 7px 14px;
		font-family: var(--f-display);
		font-size: 13px;
		font-weight: 400;
		letter-spacing: 0.1em;
		color: var(--gold-hi);
		background: linear-gradient(180deg, #e01b3a, var(--blood) 50%, var(--blood-deep));
		border: 2px solid var(--ink);
		border-radius: 8px;
		box-shadow:
			0 0 0 1.5px var(--gold-dk),
			inset 0 1px rgba(255, 255, 255, 0.28),
			0 3px 0 1.5px var(--ink);
		text-shadow: 0 2px 0 var(--ink);
		cursor: pointer;
		transition:
			transform 0.14s ease-out,
			filter 0.14s ease-out;
	}
	.hud-bonus-btn:not(:disabled):hover {
		filter: brightness(1.12);
		transform: translateY(-2px);
	}
	.hud-bonus-btn:not(:disabled):active {
		transition-duration: 80ms;
		transform: scale(0.97);
	}

	/* meters */
	.hud-meter-label {
		font-family: var(--f-ui);
		font-weight: 500;
		font-size: 12.8px;
		letter-spacing: 0.22em;
		line-height: 1;
		text-transform: uppercase;
		color: var(--bone-dim);
	}
	.hud-meter-value {
		margin-top: 2px;
		font-family: var(--f-ui);
		font-weight: 600;
		font-size: 21px;
		line-height: 1.1;
		letter-spacing: 0.03em;
		color: var(--bone);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.hud-meter.left {
		text-align: left;
		min-width: 0;
	}
	.hud-meter.right {
		text-align: right;
	}

	/* ---- centre: win --------------------------------------------------------------------------- */
	.hud-win {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		padding: 0 8px;
		pointer-events: none;
		visibility: hidden;
	}
	.hud-win.on {
		visibility: visible;
	}
	.hud-win-copy {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
	}
	.hud-win-label {
		font-family: var(--f-ui);
		font-weight: 500;
		font-size: 12.8px;
		letter-spacing: 0.22em;
		line-height: 1;
		text-transform: uppercase;
		color: var(--bone-dim);
	}
	.hud-win-amount {
		font-family: var(--f-ui);
		font-weight: 600;
		font-size: 21px;
		line-height: 1.15;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--bone);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.hud-win.count .hud-win-amount {
		color: var(--gold-hi);
	}

	/* ---- right ---------------------------------------------------------------------------------- */
	.hud-right {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		margin-left: auto;
		flex-shrink: 0;
	}
	.hud-stake {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.hud-bet-col {
		display: flex;
		flex-direction: column;
		gap: 4.5px;
		flex-shrink: 0;
	}
	.hud-icon-btn {
		width: 27px;
		height: 24px;
		border-radius: 5px;
	}
	.ico-step {
		width: 14px;
		height: 14px;
	}

	.hud-spin-slot {
		position: relative;
		flex-shrink: 0;
		width: 92px;
		height: 54px;
	}
	.respin-btn {
		position: absolute;
		bottom: 2px;
		left: 50%;
		z-index: 40;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 78px;
		height: 78px;
		margin: 0;
		padding: 0;
		color: var(--bone);
		background: radial-gradient(circle at 36% 28%, #ff5566 0, var(--blood) 42%, var(--blood-deep) 100%);
		border: 5px solid var(--ink);
		border-radius: 9999px;
		box-shadow:
			0 0 0 3px var(--bone),
			0 0 0 6px var(--ink),
			0 7px 0 6px #000,
			0 0 26px rgba(200, 16, 46, 0.55);
		overflow: hidden;
		cursor: pointer;
		transform: translate(-50%);
		transition:
			transform 0.14s ease-out,
			box-shadow 0.14s ease-out;
		animation: noir-spin-breathe 2.6s ease-in-out infinite;
	}
	.respin-btn:not(:disabled):hover {
		background: radial-gradient(circle at 36% 28%, #ff6677 0, #d8142f 42%, var(--blood-deep) 100%);
		box-shadow:
			0 0 0 3px var(--gold-hi),
			0 0 0 6px var(--ink),
			0 7px 0 6px #000,
			0 0 34px rgba(255, 59, 78, 0.75);
		transform: translate(-50%) translateY(-2px);
	}
	.respin-btn:not(:disabled):active {
		transition-duration: 80ms;
		transform: translate(-50%) translateY(4px) scale(0.98);
	}
	.respin-btn:disabled {
		animation: none;
		opacity: 0.6;
		filter: saturate(0.5) brightness(0.8);
		cursor: not-allowed;
		transform: translate(-50%) scale(0.97);
	}
	.spin-arrow,
	.spin-glyph {
		width: 100%;
		height: 100%;
		color: var(--bone);
		filter: drop-shadow(0 2px 0 rgba(10, 6, 7, 0.7));
		transition: color 0.16s;
	}
	.spin-glyph {
		width: 58%;
		height: 58%;
	}
	.respin-btn:not(:disabled):hover .spin-arrow,
	.respin-btn:not(:disabled):hover .spin-glyph {
		color: var(--gold-hi);
	}
	@keyframes noir-spin-breathe {
		0%,
		100% {
			box-shadow:
				0 0 0 3px var(--bone),
				0 0 0 6px var(--ink),
				0 7px 0 6px #000,
				0 0 18px rgba(200, 16, 46, 0.4);
		}
		50% {
			box-shadow:
				0 0 0 3px var(--bone),
				0 0 0 6px var(--ink),
				0 7px 0 6px #000,
				0 0 34px rgba(255, 59, 78, 0.75);
		}
	}

	.hud-fx-row {
		display: flex;
		align-items: center;
		gap: 7px;
		flex-shrink: 0;
	}
	.hud-sq-btn {
		width: 43px;
		height: 43px;
		border-radius: 9px;
	}
	.hud-sq-btn .ico-bolt {
		width: 58%;
		height: 58%;
	}
	.hud-sq-btn .ico-loop {
		width: 70%;
		height: 70%;
	}
	.hud-sq-btn.is-on {
		color: var(--bone);
		background: linear-gradient(180deg, var(--blood-hi), var(--blood) 55%, var(--blood-deep));
		box-shadow:
			0 0 0 1.5px var(--gold),
			0 3px 0 1.5px var(--ink),
			0 0 16px rgba(255, 59, 78, 0.55);
	}
	.auto-count {
		position: absolute;
		right: 2px;
		bottom: 1px;
		font-family: var(--f-ui);
		font-weight: 700;
		font-size: 11px;
		line-height: 1;
		color: var(--gold-hi);
		text-shadow: 0 1px 0 var(--ink);
	}

	/* ---- volume popover -------------------------------------------------------------------------- */
	.hud-sound-wrap {
		position: relative;
	}
	.hud-vol-pop {
		position: absolute;
		left: 0;
		bottom: calc(100% + 14px);
		z-index: 50;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px 6px 8px;
		color: var(--bone);
		white-space: nowrap;
		background: linear-gradient(180deg, #2a2a2e, #0a0a0c);
		border: 2px solid var(--ink);
		border-radius: 999px;
		box-shadow:
			0 0 0 1.5px var(--bone-dim),
			0 8px 22px rgba(0, 0, 0, 0.6);
	}
	.hud-vol-pop-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		color: inherit;
		background: none;
		border: 0;
		cursor: pointer;
	}
	.hud-vol-num {
		min-width: 25px;
		text-align: right;
		font-family: var(--f-ui);
		font-weight: 600;
		font-size: 12.5px;
		font-variant-numeric: tabular-nums;
	}
	.hud-vol-slider {
		--hud-vol: 100%;
		width: 93px;
		height: 16px;
		margin: 0;
		background: transparent;
		outline: none;
		cursor: pointer;
		-webkit-appearance: none;
		appearance: none;
	}
	.hud-vol-slider::-webkit-slider-runnable-track {
		height: 3px;
		border-radius: 999px;
		background: linear-gradient(to right, var(--blood-hi) var(--hud-vol), #3a3a3e var(--hud-vol));
	}
	.hud-vol-slider::-webkit-slider-thumb {
		width: 13px;
		height: 13px;
		margin-top: -5px;
		border: none;
		border-radius: 999px;
		background: var(--bone);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
		-webkit-appearance: none;
		appearance: none;
	}
	.hud-vol-slider::-moz-range-track {
		height: 3px;
		border-radius: 999px;
		background: #3a3a3e;
	}
	.hud-vol-slider::-moz-range-progress {
		height: 3px;
		border-radius: 999px;
		background: var(--blood-hi);
	}
	.hud-vol-slider::-moz-range-thumb {
		width: 13px;
		height: 13px;
		border: none;
		border-radius: 999px;
		background: var(--bone);
	}

	/* ---- portrait (Muerta's 720-wide phone layout, scaled to this 540-wide stage) ------------------ */
	:global(.nv-stage.portrait) .hud-inner {
		grid-template-columns: 1fr auto 1fr;
		grid-template-areas:
			'info bonus snd'
			'bal  spin  stk'
			'bet  spin  fx';
		column-gap: 7.5px;
		row-gap: 7.5px;
		padding: 16px 14px 14px;
	}
	:global(.nv-stage.portrait) .hud-left,
	:global(.nv-stage.portrait) .hud-right,
	:global(.nv-stage.portrait) .hud-tools,
	:global(.nv-stage.portrait) .hud-stake {
		display: contents;
	}
	:global(.nv-stage.portrait) .hud-left > .hud-meter {
		grid-area: bal;
		justify-self: start;
		align-self: end;
	}
	:global(.nv-stage.portrait) .hud-tools > .hud-bonus-btn {
		grid-area: bonus;
		justify-self: center;
		height: 50px;
		padding: 0 18px;
		font-size: 24px;
		border-radius: 9px;
	}
	:global(.nv-stage.portrait) .hud-stake > .hud-meter {
		grid-area: stk;
		justify-self: end;
		align-self: end;
	}
	:global(.nv-stage.portrait) .hud-stake > .hud-bet-col {
		grid-area: bet;
		justify-self: start;
		flex-direction: row-reverse;
		gap: 7.5px;
	}
	:global(.nv-stage.portrait) .hud-spin-slot {
		grid-area: spin;
		width: 112px;
		height: 112px;
	}
	:global(.nv-stage.portrait) .respin-btn {
		width: 112px;
		height: 112px;
		bottom: 0;
	}
	:global(.nv-stage.portrait) .hud-fx-row {
		grid-area: fx;
		justify-self: end;
		gap: 7.5px;
	}
	:global(.nv-stage.portrait) .hud-tools > .hud-chip-btn {
		grid-area: info;
		justify-self: end;
	}
	:global(.nv-stage.portrait) .hud-sound-wrap {
		grid-area: snd;
		justify-self: start;
	}
	:global(.nv-stage.portrait) .hud-chip-btn {
		width: 50px;
		height: 50px;
		border-radius: 9px;
	}
	:global(.nv-stage.portrait) .hud-sq-btn,
	:global(.nv-stage.portrait) .hud-bet-col .hud-icon-btn {
		width: 60px;
		height: 60px;
		border-radius: 10px;
	}
	:global(.nv-stage.portrait) .ico-step {
		width: 24px;
		height: 24px;
	}
	:global(.nv-stage.portrait) .hud-meter-label {
		font-size: 16.5px;
	}
	:global(.nv-stage.portrait) .hud-meter-value {
		font-size: 25px;
		margin-top: 1.5px;
	}
	:global(.nv-stage.portrait) .hud-vol-pop {
		left: auto;
		right: 0;
		bottom: calc(100% + 9px);
		gap: 10px;
		padding: 8px 15px 8px 11px;
	}
	:global(.nv-stage.portrait) .hud-vol-slider {
		width: 140px;
		height: 21px;
	}
	:global(.nv-stage.portrait) .hud-vol-num {
		font-size: 16px;
	}
	/* the win readout floats just above the bar in portrait */
	:global(.nv-stage.portrait) .hud-win {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 6px);
		transform: translateX(-50%);
		padding: 5px 16px;
		background: rgba(0, 0, 0, 0.72);
		border: 1px solid rgba(241, 230, 204, 0.25);
		border-radius: 999px;
	}
	:global(.nv-stage.portrait) .hud-win-copy {
		flex-direction: row;
		align-items: baseline;
		gap: 10px;
	}
	:global(.nv-stage.portrait) .hud-win-amount {
		font-size: 24px;
	}

	@media (prefers-reduced-motion: reduce) {
		.respin-btn {
			animation: none;
		}
	}
</style>
