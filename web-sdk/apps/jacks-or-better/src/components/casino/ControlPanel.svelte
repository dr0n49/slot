<script lang="ts">
	import { stateBet, stateBetDerived, stateModal } from 'state-shared';
	import { OnHotkey } from 'components-shared';

	import { getContext } from '../../game/context';
	import { formatBetLabel, LIVE_BONUS_COST } from '../../game/constants';
	import { engineBonusModeKey } from '../../game/betModes';
	import { casinoAudio } from '../../game/casinoAudio';
	import { isCasinoShell } from '../../game/liveDevHud';
	import { isLiveRoundStartable, runLiveBonusRound, submitLiveHold } from '../../game/liveWallet';
	import { stateGame } from '../../game/stateGame.svelte';
	import BetSelector from './BetSelector.svelte';

	const context = getContext();

	const useLiveWallet = $derived(stateGame.liveWalletEnabled);
	const useEnginePlay = $derived(isCasinoShell() && !stateGame.liveWalletEnabled);

	const isAuto = $derived(useEnginePlay && context.stateXstateDerived.isAutoBetting());
	const autoStopping = $derived(isAuto && stateBet.autoSpinsCounter === 0);

	const engineCanAct = $derived(
		useEnginePlay &&
			(context.stateXstateDerived.isIdle() || stateGame.awaitingDraw || stateGame.awaitingCollect),
	);

	const canDeal = $derived(
		useLiveWallet
			? stateGame.liveWalletStatus !== 'offline' &&
					stateGame.liveWalletStatus !== 'starting' &&
					(stateGame.awaitingPlayerHold || isLiveRoundStartable())
			: engineCanAct && stateBetDerived.isBetCostAvailable(),
	);

	const canBetChange = $derived(
		useLiveWallet
			? !stateGame.liveBetRunning && !stateGame.awaitingPlayerHold && isLiveRoundStartable()
			: context.stateXstateDerived.isIdle() && !stateGame.awaitingDraw && !stateGame.awaitingCollect,
	);

	const canToggleAuto = $derived(
		useEnginePlay &&
			(isAuto || (context.stateXstateDerived.isIdle() && stateBetDerived.isBetCostAvailable())),
	);

	const jobCost = $derived(stateBet.betAmount * LIVE_BONUS_COST.job);
	const flushCost = $derived(stateBet.betAmount * LIVE_BONUS_COST.flush);

	const canBuyBonus = $derived(canBetChange && (useLiveWallet || useEnginePlay));
	const canAffordJob = $derived(canBuyBonus && jobCost <= stateBet.balanceAmount);
	const canAffordFlush = $derived(canBuyBonus && flushCost <= stateBet.balanceAmount);

	const spaceBetDisabled = $derived(!canDeal);

	const dealLabel = $derived.by(() => {
		if (useLiveWallet && stateGame.awaitingPlayerHold) return 'DRAW';
		if (stateGame.awaitingDraw) return 'DRAW';
		if (stateGame.awaitingCollect) return 'COLLECT';
		return 'DEAL';
	});

	const click = () => {
		casinoAudio.unlock();
		casinoAudio.play('button_click');
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
	};

	const toggleSpeed = () => {
		click();
		stateBetDerived.updateIsTurbo(!stateBet.isTurbo, { persistent: true });
	};

	const openOptions = () => {
		click();
		stateModal.modal = { name: 'settings' };
	};

	const toggleAuto = () => {
		if (!canToggleAuto) return;
		click();
		if (isAuto) {
			// Finishes the current deal, then the auto loop ends.
			stateBet.autoSpinsCounter = 0;
			return;
		}
		stateBet.autoSpinsCounter = Infinity;
		context.eventEmitter.broadcast({ type: 'autoBet' });
	};

	const onDeal = () => {
		if (!canDeal) return;
		casinoAudio.unlock();
		casinoAudio.play('button_click');
		context.eventEmitter.broadcast({ type: 'soundPressBet' });
		if (useLiveWallet && stateGame.awaitingPlayerHold) {
			void submitLiveHold();
			return;
		}
		if (stateGame.awaitingDraw) {
			stateGame.continueDraw?.();
			return;
		}
		if (stateGame.awaitingCollect) {
			stateGame.continueCollect?.();
			return;
		}
		context.eventEmitter.broadcast({ type: 'bet' });
	};

	const buyBonus = async (kind: 'job' | 'flush') => {
		if (!canBuyBonus) return;
		click();
		if (useEnginePlay) {
			stateBet.activeBetModeKey = engineBonusModeKey(kind);
			context.eventEmitter.broadcast({ type: 'bet' });
			return;
		}
		try {
			await runLiveBonusRound(kind);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			stateModal.modal = { name: 'error', error: message };
		}
	};
</script>

<OnHotkey hotkey="Space" disabled={spaceBetDisabled} onpress={onDeal} />

<div class="control-panel">
	<div class="buttons-row">
		<button type="button" class="casino-btn" onclick={openOptions}>Options</button>
		<button
			type="button"
			class="casino-btn speed"
			class:active={stateBet.isTurbo}
			onclick={toggleSpeed}
		>
			Turbo <span class="chevrons">›››</span>
		</button>
		<BetSelector disabled={!canBetChange} />
		{#if useEnginePlay}
			<button
				type="button"
				class="casino-btn auto"
				class:active={isAuto}
				disabled={!canToggleAuto}
				aria-pressed={isAuto}
				onclick={toggleAuto}
			>
				{isAuto ? (autoStopping ? 'Stopping' : 'Stop') : 'Auto'}
			</button>
		{/if}
		<button type="button" class="casino-btn deal" disabled={!canDeal} onclick={onDeal}>
			{dealLabel}
		</button>
	</div>

	{#if useLiveWallet || useEnginePlay}
		<div class="bonus-row">
			<button
				type="button"
				class="casino-btn bonus"
				disabled={!canAffordJob}
				onclick={() => void buyBonus('job')}
			>
				<span class="bonus-name">JoB+</span>
				<span class="bonus-cost">{formatBetLabel(jobCost)}</span>
			</button>
			<button
				type="button"
				class="casino-btn bonus"
				disabled={!canAffordFlush}
				onclick={() => void buyBonus('flush')}
			>
				<span class="bonus-name">Flush+</span>
				<span class="bonus-cost">{formatBetLabel(flushCost)}</span>
			</button>
		</div>
	{/if}
</div>

<style>
	.control-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 8px 10px 10px;
		margin-top: auto;
		flex-shrink: 0;
		border-top: 2px solid rgba(255, 213, 74, 0.25);
		background: linear-gradient(180deg, rgba(0, 8, 40, 0.9) 0%, rgba(0, 18, 64, 0.98) 100%);
	}
	.buttons-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 6px;
		width: 100%;
		margin-inline: auto;
		flex-shrink: 0;
	}
	.bonus-row {
		display: flex;
		flex-wrap: nowrap;
		justify-content: center;
		align-items: center;
		gap: 10px;
		width: 100%;
		margin-inline: auto;
		flex-shrink: 0;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		padding: 6px 4px 2px;
	}
	.bonus-row::-webkit-scrollbar {
		display: none;
	}
	.buttons-row :global(.bet-selector) {
		flex: 0 0 auto;
		justify-content: center;
	}
	.buttons-row .casino-btn {
		flex: 0 0 auto;
		min-width: 72px;
		min-height: 34px;
		padding: 5px 12px;
		font-size: 11px;
		justify-content: center;
	}
	.buttons-row .casino-btn.deal {
		min-width: 84px;
		font-size: 12px;
	}
	/* Portrait (375 design px): tighten so Options · Turbo · bet · Auto · Deal share one row. */
	:global(.casino-machine.portrait) .buttons-row {
		gap: 4px;
	}
	:global(.casino-machine.portrait) .buttons-row .casino-btn {
		min-width: 0;
		padding-inline: 6px;
		font-size: 9px;
	}
	:global(.casino-machine.portrait) .buttons-row .casino-btn.deal {
		min-width: 58px;
	}
	.casino-btn.speed .chevrons {
		color: #dc2626;
		letter-spacing: -2px;
		margin-left: 1px;
		font-size: 9px;
	}
	.casino-btn.active {
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.5),
			0 0 12px rgba(255, 213, 74, 0.65);
	}
	.casino-btn.auto.active {
		border-color: #7f1d1d;
		background: linear-gradient(180deg, #f87171 0%, #dc2626 48%, #b91c1c 100%);
		color: #fff;
	}
	.casino-btn.bonus {
		flex: 0 0 auto;
		min-width: 96px;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-height: 44px;
		padding: 6px 12px;
		line-height: 1.15;
		border: 2px solid transparent;
		background:
			linear-gradient(180deg, #0d2a8a 0%, #071858 100%) padding-box,
			linear-gradient(135deg, #fde68a 0%, #f59e0b 45%, #b45309 100%) border-box;
		background-clip: padding-box, border-box;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.25),
			0 0 12px rgba(251, 191, 36, 0.35),
			0 2px 6px rgba(0, 0, 0, 0.45);
		color: #fff8dc;
		position: relative;
	}
	.casino-btn.bonus::before {
		content: '★';
		position: absolute;
		top: -7px;
		right: -4px;
		width: 18px;
		height: 18px;
		border-radius: 999px;
		background: linear-gradient(180deg, #fde68a, #f59e0b);
		color: #7a1a00;
		font-size: 10px;
		line-height: 18px;
		text-align: center;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
	}
	.bonus-name {
		font-size: 11px;
		letter-spacing: 0.04em;
	}
	.bonus-cost {
		font-size: 10px;
		font-weight: 900;
		color: #ffd54a;
		opacity: 1;
		letter-spacing: 0.02em;
	}
	:global(.casino-machine.portrait) .casino-btn.bonus {
		min-width: 88px;
		padding: 5px 10px;
	}
	:global(.casino-machine.portrait) .bonus-name {
		font-size: 10px;
	}
	:global(.casino-machine.portrait) .bonus-cost {
		font-size: 10px;
	}
</style>
