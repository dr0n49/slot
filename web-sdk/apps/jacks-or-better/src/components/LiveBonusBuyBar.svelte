<script lang="ts">
	import { stateBet } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import { LIVE_BONUS_COST } from '../game/constants';
	import { isLiveRoundStartable, runLiveBonusRound } from '../game/liveWallet';
	import { stateGame } from '../game/stateGame.svelte';

	const jobCost = $derived(stateBet.betAmount * LIVE_BONUS_COST.job);
	const flushCost = $derived(stateBet.betAmount * LIVE_BONUS_COST.flush);

	const canBuy = $derived(
		stateGame.liveWalletEnabled &&
			!stateGame.liveBetRunning &&
			stateGame.liveWalletStatus !== 'offline' &&
			!stateGame.awaitingPlayerHold &&
			!stateGame.awaitingDoubleUpChoice &&
			isLiveRoundStartable(),
	);

	const buy = (kind: 'job' | 'flush') => {
		if (!canBuy) return;
		void runLiveBonusRound(kind);
	};
</script>

{#if stateGame.liveWalletEnabled}
	<div class="bonus-buy-bar">
		<button class="bonus-btn" disabled={!canBuy} onclick={() => buy('job')}>
			<span class="label">MIN WIN: JoB+</span>
			<span class="price">Cost: {numberToCurrencyString(jobCost)}</span>
		</button>
		<button class="bonus-btn flush" disabled={!canBuy} onclick={() => buy('flush')}>
			<span class="label">MIN WIN: Flush+</span>
			<span class="price">Cost: {numberToCurrencyString(flushCost)}</span>
		</button>
	</div>
{/if}

<style>
	.bonus-buy-bar {
		position: absolute;
		top: calc(var(--live-hold-card-y-ratio, 0.5) * 100% + var(--live-hold-card-half-height, 98px) + 12px);
		right: 12px;
		left: auto;
		z-index: 22;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
		width: min(220px, calc(100% - 24px));
		max-width: calc(100% - 24px);
		box-sizing: border-box;
		pointer-events: none;
	}
	.bonus-btn {
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		width: 100%;
		padding: 8px 12px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		border-radius: 8px;
		background: rgba(15, 23, 42, 0.92);
		color: #f8fafc;
		font-family: proxima-nova, sans-serif;
		cursor: pointer;
		box-sizing: border-box;
	}
	.bonus-btn:hover:not(:disabled) {
		border-color: #d4a017;
		background: rgba(30, 41, 59, 0.95);
	}
	.bonus-btn.flush:hover:not(:disabled) {
		border-color: #22c55e;
	}
	.bonus-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.label {
		font-size: 12px;
		font-weight: 700;
		text-align: right;
		line-height: 1.25;
	}
	.price {
		font-size: 11px;
		font-weight: 600;
		color: #94a3b8;
	}
</style>
