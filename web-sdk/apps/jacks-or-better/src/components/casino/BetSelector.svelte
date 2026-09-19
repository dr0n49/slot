<script lang="ts">
	import { stateBet, stateBetDerived } from 'state-shared';

	import { casinoAudio } from '../../game/casinoAudio';
	import { getContext } from '../../game/context';
	import { betAmountIndex, formatBetLabel, resolvedBetAmountOptions } from '../../game/constants';

	type Props = {
		disabled?: boolean;
	};

	const { disabled = false }: Props = $props();

	const context = getContext();

	let open = $state(false);

	const betOptions = $derived(resolvedBetAmountOptions());

	const currentIdx = $derived(betAmountIndex(stateBet.betAmount, betOptions));
	const atMin = $derived(currentIdx <= 0);
	const atMax = $derived(currentIdx >= betOptions.length - 1);

	const setBet = (amount: number) => {
		casinoAudio.unlock();
		casinoAudio.play('button_click');
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateBetDerived.setBetAmount(amount);
		open = false;
	};

	const stepUp = () => {
		if (disabled || atMax) return;
		setBet(betOptions[currentIdx + 1]);
	};

	const stepDown = () => {
		if (disabled || atMin) return;
		setBet(betOptions[currentIdx - 1]);
	};

	const toggleOpen = () => {
		if (disabled) return;
		casinoAudio.unlock();
		casinoAudio.play('button_click');
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		open = !open;
	};

	const onWindowClick = (event: MouseEvent) => {
		const target = event.target as HTMLElement;
		if (!target.closest('.bet-selector')) open = false;
	};
</script>

<svelte:window onclick={onWindowClick} />

<div class="bet-selector">
	<button
		type="button"
		class="step-btn"
		aria-label="Lower bet"
		disabled={disabled || atMin}
		onclick={stepDown}
	>
		▼
	</button>

	<div class="bet-picker-wrap">
		<button
			type="button"
			class="casino-btn bet-btn"
			disabled={disabled}
			aria-expanded={open}
			aria-haspopup="listbox"
			onclick={toggleOpen}
		>
			{formatBetLabel(stateBet.betAmount)}
		</button>

		{#if open}
			<ul class="bet-menu" role="listbox" aria-label="Bet amount">
				{#each betOptions as amount (amount)}
					<li role="option" aria-selected={amount === stateBet.betAmount}>
						<button
							type="button"
							class="bet-option"
							class:selected={amount === stateBet.betAmount}
							onclick={() => setBet(amount)}
						>
							{formatBetLabel(amount)}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<button
		type="button"
		class="step-btn"
		aria-label="Raise bet"
		disabled={disabled || atMax}
		onclick={stepUp}
	>
		▲
	</button>
</div>

<style>
	.bet-selector {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		position: relative;
	}
	.step-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		min-height: 34px;
		padding: 0;
		border: 2px solid #8b6914;
		border-radius: 5px;
		background: linear-gradient(180deg, #ffd700 0%, #daa520 48%, #b8860b 100%);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.4),
			0 1px 3px rgba(0, 0, 0, 0.35);
		color: #111;
		font-size: 10px;
		font-weight: 900;
		line-height: 1;
		cursor: pointer;
	}
	.step-btn:hover:not(:disabled) {
		filter: brightness(1.08);
	}
	.step-btn:disabled {
		opacity: 0.38;
		cursor: not-allowed;
	}
	.bet-picker-wrap {
		position: relative;
	}
	.bet-btn {
		min-width: 64px;
		min-height: 34px;
		border-radius: 999px;
		padding-inline: 14px;
		font-size: 13px;
		color: #7a1a00;
	}
	.bet-menu {
		position: absolute;
		bottom: calc(100% + 4px);
		left: 50%;
		z-index: 60;
		transform: translateX(-50%);
		margin: 0;
		padding: 4px;
		list-style: none;
		width: max-content;
		min-width: 72px;
		max-height: 220px;
		overflow-y: auto;
		border: 2px solid #8b6914;
		border-radius: 8px;
		background: linear-gradient(180deg, #001a5c 0%, #000820 100%);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
	}
	.bet-option {
		display: block;
		width: 100%;
		padding: 5px 10px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: #ffd54a;
		font-family: 'Arial Black', Impact, sans-serif;
		font-size: 11px;
		font-weight: 900;
		text-align: center;
		cursor: pointer;
	}
	.bet-option:hover,
	.bet-option.selected {
		background: rgba(255, 213, 74, 0.18);
		color: #fff;
	}
</style>
