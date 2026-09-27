<script lang="ts">
	import { symbolUrl } from '../../game/assets';
	import { FREE_SPINS, SYMBOLS } from '../../game/config';
	import { formatBookWin } from '../../game/constants';
	import { stateGame } from '../../game/stateGame.svelte';

	type Props = { right: number; width: number; top: number; height: number };
	const { right, width, top, height }: Props = $props();
	const trig = Object.entries(FREE_SPINS.trigger);
</script>

<aside class="rail" style="right: {right}px; top: {top}px; width: {width}px; height: {height}px">
	{#if stateGame.fsActive}
		<div class="head">FREE SPINS</div>
		<div class="big" data-testid="fs-rail-count">{stateGame.fsCurrent}<i>/</i>{stateGame.fsTotal}</div>
		<div class="sub">FEATURE WIN</div>
		<div class="amt">{formatBookWin(stateGame.displayWin)}</div>
		<p class="tip">Free spins run on their own <b>higher ladder</b>.</p>
	{:else}
		<div class="head">HOW IT WORKS</div>
		<div class="card">
			<img src={symbolUrl(SYMBOLS.scatter)} alt="" width="54" height="54" />
			<div>
				<b>{trig.map(([s]) => s).join(' / ')} SCATTERS</b>
				<span>{trig.map(([, n]) => n).join(' / ')} free spins</span>
			</div>
		</div>
		<div class="card">
			<img src={symbolUrl(SYMBOLS.keg)} alt="" width="54" height="54" />
			<div>
				<b>NITRO KEG</b>
				<span>+1 ladder rung per keg — and the win pays on every rung it passes</span>
			</div>
		</div>
		<div class="card">
			<img src={symbolUrl(SYMBOLS.wild)} alt="" width="54" height="54" />
			<div>
				<b>WILD</b>
				<span>Reels 2–5 · substitutes for all pays</span>
			</div>
		</div>
	{/if}
</aside>

<style>
	.rail {
		position: absolute;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		box-sizing: border-box;
		border: 2px solid rgba(255, 213, 74, 0.4);
		border-radius: 16px;
		background: linear-gradient(180deg, rgba(38, 22, 53, 0.92), rgba(14, 8, 22, 0.92));
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
		color: var(--nv-cream);
		z-index: 12;
	}
	.head {
		text-align: center;
		font-family: var(--nv-font-display);
		font-size: 17px;
		letter-spacing: 0.12em;
		color: var(--nv-gold);
	}
	.card {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border: 1px solid var(--nv-line);
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.3);
	}
	.card img {
		flex: none;
	}
	.card b {
		display: block;
		font-family: var(--nv-font-display);
		font-size: 15px;
		font-weight: 400;
		letter-spacing: 0.06em;
		color: #fff;
	}
	.card span {
		display: block;
		font-size: 11.5px;
		line-height: 1.3;
		color: rgba(255, 243, 196, 0.75);
	}
	.big {
		text-align: center;
		font-family: var(--nv-font-display);
		font-size: 58px;
		line-height: 1;
		color: #fff;
		text-shadow: 0 3px 0 #000, 0 0 20px rgba(255, 106, 26, 0.8);
	}
	.big i {
		font-style: normal;
		opacity: 0.55;
		padding: 0 4px;
	}
	.sub {
		text-align: center;
		font-size: 11px;
		letter-spacing: 0.2em;
		font-weight: 700;
		color: #ff9a2e;
	}
	.amt {
		text-align: center;
		font-family: var(--nv-font-display);
		font-size: 30px;
		color: var(--nv-cream);
		font-variant-numeric: tabular-nums;
	}
	.tip {
		margin: auto 0 0;
		text-align: center;
		font-size: 12px;
		color: rgba(255, 243, 196, 0.7);
	}
	.tip b {
		color: var(--nv-gold);
	}
</style>
