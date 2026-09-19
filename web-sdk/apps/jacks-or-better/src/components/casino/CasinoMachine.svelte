<script lang="ts">
	import { onMount } from 'svelte';

	import { casinoAudio } from '../../game/casinoAudio';
	import { HAND_SIZE } from '../../game/constants';
	import { stateGame } from '../../game/stateGame.svelte';
	import Card from './Card.svelte';
	import ControlPanel from './ControlPanel.svelte';
	import PaytableTable from './PaytableTable.svelte';
	import StatsBar from './StatsBar.svelte';

	import './casinoTheme.css';

	/**
	 * Design-scale layout. The machine is authored in fixed "design pixels" and
	 * scaled uniformly to the container, so every size renders the same
	 * proportions (1200×675, 800×450, 400×225 are all exact copies of the
	 * 1024×576 reference). Portrait phones get their own reference (375×667).
	 * The scaled stage always covers the container, so nothing is letterboxed.
	 */
	const DESIGN = {
		landscape: { w: 1024, h: 576 },
		portrait: { w: 375, h: 667 },
	} as const;

	let viewportW = $state(0);
	let viewportH = $state(0);

	const portrait = $derived(viewportH > viewportW);
	const design = $derived(portrait ? DESIGN.portrait : DESIGN.landscape);
	const scale = $derived.by(() => {
		if (viewportW <= 0 || viewportH <= 0) return 1;
		return Math.min(viewportW / design.w, viewportH / design.h);
	});
	// Stage in design units that exactly fills the viewport after scaling.
	const stageW = $derived(scale > 0 ? viewportW / scale : design.w);
	const stageH = $derived(scale > 0 ? viewportH / scale : design.h);

	const combinationText = $derived.by(() => {
		if (stateGame.liveWalletStatus === 'starting') return '';
		if (stateGame.liveWalletStatus === 'offline') return '';
		if (stateGame.handCategory && stateGame.handAmount > 0) {
			return stateGame.handCategory.toUpperCase();
		}
		return '';
	});

	const showCardBacks = $derived(stateGame.cards.length === 0);
	const winningHand = $derived(Boolean(stateGame.handCategory && stateGame.handAmount > 0));

	onMount(() => {
		casinoAudio.enableBgm();
		return () => casinoAudio.disableBgm();
	});

	// Follow the settings-modal volume sliders (also mutes/pauses at 0).
	$effect(() => {
		casinoAudio.applyBgmVolume();
	});
</script>

<div class="casino-viewport" bind:clientWidth={viewportW} bind:clientHeight={viewportH}>
	<div
		class="casino-machine"
		class:portrait
		style="width: {stageW}px; height: {stageH}px; transform: scale({scale});"
	>
		<PaytableTable />

		<div class="combination-banner" class:win={winningHand}>
			{#if combinationText}
				<span>{combinationText}</span>
			{/if}
		</div>

		<div class="card-stage">
			<div class="card-row" class:win={winningHand && stateGame.winPulse}>
				{#if showCardBacks}
					{#each Array(HAND_SIZE) as _, index (index)}
						<div class="card-slot">
							<Card showBack={true} />
						</div>
					{/each}
				{:else}
					{#each stateGame.cards as card, index (index)}
						<div class="card-slot">
							<Card
								code={card.code}
								drawing={card.drawing}
								winning={winningHand}
								winGlow={card.winGlow}
								replacing={card.replacing}
								instant={card.instant}
							/>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<StatsBar />

		<ControlPanel />
	</div>
</div>

<style>
	.casino-viewport {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		max-height: 100%;
		background: linear-gradient(180deg, #0a1f6e 0%, #001240 100%);
		overflow: hidden;
		overscroll-behavior: none;
	}

	.casino-machine {
		position: absolute;
		top: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		transform-origin: top left;
		background: linear-gradient(180deg, #0a1f6e 0%, #001240 100%);
		overflow: hidden;
		box-sizing: border-box;
	}

	.combination-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		min-height: 28px;
		padding: 2px 12px 0;
		text-align: center;
	}
	.combination-banner span {
		color: #fff;
		font-family: 'Arial Black', Impact, sans-serif;
		font-size: 24px;
		font-weight: 900;
		letter-spacing: 0.07em;
		text-shadow: 0 2px 0 #000;
	}
	.portrait .combination-banner span {
		font-size: 20px;
	}
	.combination-banner.win span {
		animation: combo-pulse 1.4s ease-in-out infinite;
	}

	.card-stage {
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px 10px 12px;
		min-height: 0;
		width: 100%;
		box-sizing: border-box;
	}
	.card-row {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 10px;
		width: min(100%, 620px);
	}
	.portrait .card-row {
		gap: 6px;
	}
	.card-row.win :global(.card-front) {
		animation: card-win-glow 1.6s ease-in-out infinite;
	}
	.card-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
		perspective: 800px;
	}
	.card-slot :global(.card-scene) {
		max-width: 96px;
	}

	@keyframes combo-pulse {
		0%,
		100% {
			text-shadow: 0 2px 0 #000;
		}
		50% {
			text-shadow:
				0 2px 0 #000,
				0 0 18px rgba(255, 213, 74, 0.55);
		}
	}
	@keyframes card-win-glow {
		0%,
		100% {
			box-shadow:
				0 8px 16px rgba(0, 0, 0, 0.45),
				0 0 0 0 rgba(255, 213, 74, 0);
		}
		50% {
			box-shadow:
				0 10px 20px rgba(0, 0, 0, 0.5),
				0 0 14px rgba(255, 213, 74, 0.5);
		}
	}

	:global(.game-root.casino-mode) {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: 100%;
		overflow: hidden;
	}
	/* Cover the whole root so flow siblings (modal wrapper, version tag) can't steal height. */
	:global(.game-root.casino-mode) .casino-viewport {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 30;
	}
</style>
