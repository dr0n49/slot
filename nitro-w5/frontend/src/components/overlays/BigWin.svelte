<script lang="ts">
	import { bookToMultiplier, formatBookWin, formatX } from '../../game/constants';
	import { TIER_LABEL, tapBigWin } from '../../game/presentation';
	import { stateGame } from '../../game/stateGame.svelte';

	const bw = $derived(stateGame.bigWin);
</script>

{#if bw}
	<div
		class="bw {bw.tier}"
		role="button"
		tabindex="0"
		aria-label="Big win. Press to {bw.done ? 'continue' : 'skip'}"
		data-testid="bigwin"
		data-tier={bw.tier}
		onclick={tapBigWin}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tapBigWin())}
	>
		<div class="rays"></div>
		<div class="content">
			{#key bw.tier}
				<div class="title">{TIER_LABEL[bw.tier]}</div>
			{/key}
			<div class="amount" data-testid="bigwin-amount">{formatBookWin(bw.shown)}</div>
			<div class="mult">{formatX(bookToMultiplier(bw.shown))} BET</div>
			<div class="hint">{bw.done ? 'TAP TO CONTINUE' : 'TAP TO SKIP'}</div>
		</div>
	</div>
{/if}

<style>
	.bw {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(circle at 50% 46%, rgba(40, 14, 8, 0.72), rgba(4, 2, 8, 0.9));
		z-index: 40;
		cursor: pointer;
		animation: bw-in 0.35s ease-out;
		overflow: hidden;
	}
	.bw:focus-visible {
		outline: 4px solid var(--nv-cyan);
		outline-offset: -8px;
	}
	.rays {
		position: absolute;
		left: 50%;
		top: 46%;
		width: 260vmax;
		height: 260vmax;
		margin: -130vmax 0 0 -130vmax;
		background: repeating-conic-gradient(from 0deg, rgba(255, 200, 80, 0.2) 0deg 7deg, transparent 7deg 20deg);
		-webkit-mask-image: radial-gradient(circle, #000 0, transparent 34%);
		mask-image: radial-gradient(circle, #000 0, transparent 34%);
		animation: rays-spin 24s linear infinite;
		pointer-events: none;
	}
	.mega .rays {
		background: repeating-conic-gradient(from 0deg, rgba(255, 110, 40, 0.28) 0deg 7deg, transparent 7deg 20deg);
	}
	.massive .rays,
	.max .rays {
		background: repeating-conic-gradient(from 0deg, rgba(120, 220, 255, 0.28) 0deg 7deg, transparent 7deg 20deg);
	}
	.content {
		position: relative;
		text-align: center;
		padding: 0 24px;
	}
	.title {
		font-family: var(--nv-font-display);
		font-size: clamp(56px, 13vmin, 150px);
		line-height: 1;
		letter-spacing: 0.06em;
		background: linear-gradient(180deg, #fff9c8, #ffc107 50%, #c26a00);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 6px 0 rgba(60, 20, 0, 0.9)) drop-shadow(0 0 30px rgba(255, 170, 40, 0.8));
		animation: title-slam 0.6s cubic-bezier(0.2, 1.5, 0.4, 1);
	}
	.mega .title {
		background: linear-gradient(180deg, #fff0d0, #ff8a2e 50%, #b02a08);
		-webkit-background-clip: text;
		background-clip: text;
		filter: drop-shadow(0 6px 0 rgba(60, 8, 0, 0.9)) drop-shadow(0 0 36px rgba(255, 90, 20, 0.9));
	}
	.massive .title,
	.max .title {
		background: linear-gradient(180deg, #ffffff, #7fe1ff 50%, #2a6ad8);
		-webkit-background-clip: text;
		background-clip: text;
		filter: drop-shadow(0 6px 0 rgba(0, 20, 60, 0.9)) drop-shadow(0 0 40px rgba(90, 200, 255, 0.95));
	}
	.amount {
		margin-top: 6px;
		font-family: var(--nv-font-display);
		font-size: clamp(50px, 12vmin, 130px);
		line-height: 1.05;
		color: #fff;
		letter-spacing: 0.03em;
		text-shadow:
			0 5px 0 #6a3200,
			0 0 28px rgba(255, 190, 60, 0.9);
		font-variant-numeric: tabular-nums;
	}
	.mult {
		font-family: var(--nv-font-display);
		font-size: clamp(22px, 4.6vmin, 44px);
		letter-spacing: 0.1em;
		color: var(--nv-gold);
		text-shadow: 0 3px 0 #000;
	}
	.hint {
		margin-top: 18px;
		font-family: var(--nv-font-ui);
		font-weight: 700;
		font-size: clamp(12px, 2.4vmin, 18px);
		letter-spacing: 0.24em;
		color: rgba(255, 243, 196, 0.75);
		animation: hint-blink 1.2s ease-in-out infinite alternate;
	}
	@keyframes bw-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes rays-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes title-slam {
		0% {
			transform: scale(2.6);
			opacity: 0;
		}
		60% {
			transform: scale(0.94);
			opacity: 1;
		}
		100% {
			transform: scale(1);
		}
	}
	@keyframes hint-blink {
		from {
			opacity: 0.45;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.rays,
		.title,
		.hint {
			animation: none;
		}
	}
</style>
