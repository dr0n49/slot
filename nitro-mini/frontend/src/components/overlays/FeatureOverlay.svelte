<script lang="ts">
	import { formatBookWin } from '../../game/constants';
	import { releaseContinue } from '../../game/presentation';
	import { stateGame } from '../../game/stateGame.svelte';

	const intro = $derived(stateGame.featureIntro);
	const outro = $derived(stateGame.featureOutro);
	const press = (e: KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			releaseContinue();
		}
	};
</script>

{#if intro}
	<div class="fo" role="button" tabindex="0" data-testid="fs-intro" onclick={releaseContinue} onkeydown={press}>
		<div class="card">
			<div class="kicker">DEEP VEIN</div>
			<div class="num">{intro.spins}</div>
			<div class="title">FREE SPINS</div>
			<p>The Blast Ladder <b>never resets</b> between spins. Every TNT keg lifts it even higher.</p>
			<div class="go">TAP TO START</div>
		</div>
	</div>
{:else if outro}
	<div class="fo" role="button" tabindex="0" data-testid="fs-outro" onclick={releaseContinue} onkeydown={press}>
		<div class="card">
			<div class="kicker">DEEP VEIN COMPLETE</div>
			<div class="title">TOTAL WIN</div>
			<div class="num">{formatBookWin(outro.amount)}</div>
			<p>{outro.spins} free spins played</p>
			<div class="go">TAP TO CONTINUE</div>
		</div>
	</div>
{/if}

<style>
	.fo {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(circle at 50% 50%, rgba(70, 14, 4, 0.7), rgba(4, 2, 8, 0.92));
		z-index: 38;
		cursor: pointer;
		animation: fo-in 0.35s ease-out;
	}
	.fo:focus-visible {
		outline: 4px solid var(--nv-cyan);
		outline-offset: -8px;
	}
	.card {
		width: min(90%, 560px);
		padding: 28px 30px 24px;
		border: 4px solid var(--nv-gold);
		border-radius: 24px;
		background: linear-gradient(180deg, #4a1408 0%, #1a0808 100%);
		box-shadow:
			0 0 50px rgba(255, 106, 26, 0.6),
			0 14px 30px rgba(0, 0, 0, 0.7);
		text-align: center;
		animation: card-in 0.55s cubic-bezier(0.2, 1.4, 0.4, 1);
	}
	.kicker {
		font-family: var(--nv-font-ui);
		font-weight: 700;
		letter-spacing: 0.3em;
		font-size: 14px;
		color: #ffb27a;
	}
	.num {
		font-family: var(--nv-font-display);
		font-size: 120px;
		line-height: 1;
		background: linear-gradient(180deg, #fff9c8, #ffc107 55%, #c26a00);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 5px 0 rgba(60, 20, 0, 0.9)) drop-shadow(0 0 24px rgba(255, 170, 40, 0.7));
		font-variant-numeric: tabular-nums;
	}
	.title {
		font-family: var(--nv-font-display);
		font-size: 48px;
		letter-spacing: 0.1em;
		color: #fff3c4;
		text-shadow: var(--nv-text-shadow);
	}
	p {
		margin: 10px 0 0;
		font-family: var(--nv-font-ui);
		font-size: 15px;
		line-height: 1.4;
		color: rgba(255, 243, 196, 0.85);
	}
	p b {
		color: var(--nv-gold);
	}
	.go {
		margin-top: 18px;
		font-family: var(--nv-font-ui);
		font-weight: 700;
		font-size: 14px;
		letter-spacing: 0.24em;
		color: var(--nv-gold);
		animation: go-blink 1.1s ease-in-out infinite alternate;
	}
	@keyframes fo-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes card-in {
		0% {
			transform: scale(0.4) rotate(-4deg);
			opacity: 0;
		}
		100% {
			transform: scale(1) rotate(0);
			opacity: 1;
		}
	}
	@keyframes go-blink {
		from {
			opacity: 0.4;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card,
		.go {
			animation: none;
		}
	}
</style>
