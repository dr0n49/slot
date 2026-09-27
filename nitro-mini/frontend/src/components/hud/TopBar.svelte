<script lang="ts">
	import { stateGame } from '../../game/stateGame.svelte';

	type Props = { height: number; portrait: boolean };
	const { height, portrait }: Props = $props();
</script>

<div class="top" style="height: {height}px" class:portrait>
	<div class="logo" aria-label="Nitro Vein">
		<span class="n">NITRO</span><span class="v">VEIN</span>
	</div>
	{#if stateGame.fsActive}
		<div class="fs" data-testid="fs-counter">
			<span class="k">FREE SPINS</span>
			<span class="n">{stateGame.fsCurrent}<i>/</i>{stateGame.fsTotal}</span>
		</div>
	{/if}
</div>

<style>
	.top {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 22px;
		box-sizing: border-box;
		pointer-events: none;
		z-index: 15;
	}
	.top.portrait {
		padding: 0 14px;
		align-items: flex-start;
		padding-top: 14px;
	}
	.logo {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-family: var(--nv-font-display);
		font-size: 34px;
		line-height: 1;
		letter-spacing: 0.06em;
	}
	.logo .n {
		background: linear-gradient(180deg, #fff3a0, #ffc107 55%, #b8700a);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 3px 0 rgba(0, 0, 0, 0.7));
	}
	.logo .v {
		background: linear-gradient(180deg, #ffb27a, #ff5a1a 55%, #a01a05);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 3px 0 rgba(0, 0, 0, 0.7));
	}
	.portrait .logo {
		font-size: 30px;
	}
	.fs {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 16px;
		border: 2px solid var(--nv-ember);
		border-radius: 999px;
		background: linear-gradient(180deg, #5a1408, #2a0806);
		box-shadow: 0 0 18px rgba(255, 106, 26, 0.6);
		font-family: var(--nv-font-display);
		color: #fff;
		letter-spacing: 0.08em;
	}
	.fs .k {
		font-family: var(--nv-font-ui);
		font-size: 12px;
		font-weight: 700;
		color: #ffb27a;
	}
	.fs .n {
		font-size: 26px;
		line-height: 1;
	}
	.fs i {
		font-style: normal;
		opacity: 0.6;
		padding: 0 2px;
	}
	.portrait .fs {
		position: absolute;
		right: 14px;
		top: 12px;
		padding: 3px 14px;
	}
</style>
