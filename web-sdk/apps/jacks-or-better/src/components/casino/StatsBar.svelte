<script lang="ts">
	import { stateBet } from 'state-shared';

	import { formatBetLabel, formatBookWinPayout, formatCredits } from '../../game/constants';
	import { stateGame } from '../../game/stateGame.svelte';
	import StatDisplay from './StatDisplay.svelte';

	const winDisplay = $derived.by(() => {
		const bookAmount = stateGame.winAnimActive
			? stateGame.winAnimAmount
			: stateGame.winAnimAmount > 0 && stateGame.winPulse
				? stateGame.winAnimAmount
				: stateBet.winBookEventAmount || stateGame.handAmount;
		return formatBookWinPayout(bookAmount, stateBet.betAmount);
	});
	const credits = $derived(stateBet.balanceAmount);

	const progressPct = $derived.by(() => {
		if (stateGame.doubleUpActive && stateGame.doubleUpMaxSteps > 0) {
			return Math.round((stateGame.doubleUpStep / stateGame.doubleUpMaxSteps) * 100);
		}
		if (stateGame.awaitingPlayerHold) return 50;
		if (stateGame.liveBetRunning) return 25;
		return stateBet.isTurbo ? 100 : 35;
	});
</script>

<div class="stats-row">
	<StatDisplay label="WIN" value={winDisplay} align="left" />

	<div class="bet-center">
		<span class="bet-label">BET {formatBetLabel(stateBet.betAmount)}</span>
		<div class="progress-track">
			<span class="star" aria-hidden="true">★</span>
			<div class="progress-fill" style="width: {progressPct}%"></div>
		</div>
	</div>

	<StatDisplay label="CREDITS" value={formatCredits(credits)} align="right" />
</div>

<style>
	.stats-row {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: end;
		gap: 6px;
		flex-shrink: 0;
		padding: 4px 10px 0;
	}
	.bet-center {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		min-width: 72px;
	}
	:global(.casino-machine.portrait) .stats-row {
		grid-template-columns: 1fr 1fr;
		grid-template-areas:
			'win credits'
			'bet bet';
		row-gap: 4px;
	}
	:global(.casino-machine.portrait) .stats-row > :global(:nth-child(1)) {
		grid-area: win;
	}
	:global(.casino-machine.portrait) .stats-row > :global(:nth-child(2)) {
		grid-area: bet;
	}
	:global(.casino-machine.portrait) .stats-row > :global(:nth-child(3)) {
		grid-area: credits;
	}
	.bet-label {
		color: #fff;
		font-family: 'Arial Black', Impact, sans-serif;
		font-size: 12px;
		font-weight: 900;
		letter-spacing: 0.07em;
		text-shadow: 0 1px 0 #000;
	}
	.progress-track {
		position: relative;
		width: 96px;
		height: 8px;
		border: 1px solid rgba(255, 213, 74, 0.4);
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.35);
		overflow: hidden;
	}
	.star {
		position: absolute;
		left: 2px;
		top: 50%;
		z-index: 2;
		color: #ffd54a;
		font-size: 8px;
		transform: translateY(-50%);
	}
	.progress-fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, #22c55e 0%, #4ade80 100%);
		transition: width 0.25s ease;
	}
</style>
