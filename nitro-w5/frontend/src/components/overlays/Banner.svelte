<script lang="ts">
	import { stateGame } from '../../game/stateGame.svelte';

	type Props = { top: number };
	const { top }: Props = $props();
</script>

{#if stateGame.banner}
	{#key stateGame.banner.id}
		<div class="banner {stateGame.banner.kind}" style="top: {top}px" role="status" data-testid="banner">
			<div class="t">{stateGame.banner.text}</div>
			{#if stateGame.banner.sub}<div class="s">{stateGame.banner.sub}</div>{/if}
		</div>
	{/key}
{/if}

<style>
	.banner {
		position: absolute;
		left: 50%;
		transform: translate(-50%, -50%);
		min-width: 300px;
		max-width: 92%;
		padding: 12px 34px 14px;
		border: 3px solid var(--nv-gold);
		border-radius: 16px;
		background: linear-gradient(180deg, rgba(48, 22, 66, 0.96), rgba(16, 8, 26, 0.96));
		box-shadow:
			0 0 30px rgba(255, 170, 40, 0.5),
			0 10px 24px rgba(0, 0, 0, 0.6);
		text-align: center;
		pointer-events: none;
		z-index: 18;
		animation: banner-in 0.35s cubic-bezier(0.2, 1.4, 0.4, 1);
	}
	.t {
		font-family: var(--nv-font-display);
		font-size: 40px;
		line-height: 1.05;
		letter-spacing: 0.06em;
		color: #fff3c4;
		text-shadow: var(--nv-text-shadow);
	}
	.s {
		margin-top: 2px;
		font-family: var(--nv-font-display);
		font-size: 26px;
		letter-spacing: 0.08em;
		color: var(--nv-gold);
	}
	.banner.feature {
		border-color: var(--nv-ember);
		background: linear-gradient(180deg, rgba(110, 24, 8, 0.97), rgba(40, 8, 4, 0.97));
	}
	.banner.warn {
		border-color: #ff5a5a;
	}
	.banner.warn .t {
		font-size: 30px;
		color: #ffc9c9;
	}
	@keyframes banner-in {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.5);
		}
		100% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}
</style>
