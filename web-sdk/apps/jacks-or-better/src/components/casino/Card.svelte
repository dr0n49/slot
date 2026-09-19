<script lang="ts">
	import { parseCard, rankLabel, suitGlyph } from '../../game/constants';

	type Props = {
		code?: string;
		held?: boolean;
		drawing?: boolean;
		showBack?: boolean;
		winning?: boolean;
		winGlow?: boolean;
		replacing?: boolean;
		interactive?: boolean;
		/** Skip the rotateY transition (turbo / instant board set). */
		instant?: boolean;
		onclick?: () => void;
	};

	const props: Props = $props();

	const parsed = $derived(props.code ? parseCard(props.code) : null);
	const faceUp = $derived(Boolean(parsed && !props.drawing && !props.showBack && !props.replacing));

	/** Static SVG faces live in /cards/svg/{rank}_{suit}.svg (e.g. A_H.svg, T_D.svg). */
	const faceSrc = $derived(
		parsed ? `cards/svg/${parsed.rank}_${parsed.suit}.svg` : '',
	);
</script>

<div
	class="card-scene"
	class:drawing={props.drawing}
	class:held={props.held}
	class:winning={props.winning}
	class:win-glow={props.winGlow}
	class:replacing={props.replacing}
>
	<button
		type="button"
		class="card"
		class:flipped={faceUp}
		class:instant={props.instant}
		class:interactive={props.interactive}
		disabled={!props.interactive}
		aria-label={props.showBack || props.drawing || props.replacing || !parsed
			? 'Face-down card'
			: props.interactive
				? props.held
					? 'Release held card'
					: 'Hold card'
				: `${rankLabel(parsed.rank)}${suitGlyph(parsed.suit)}`}
		onclick={() => props.onclick?.()}
	>
		<span class="card-face card-front" aria-hidden={!faceUp}>
			{#if faceSrc}
				<img class="face-art" src={faceSrc} alt="" draggable="false" />
			{/if}
		</span>

		<span class="card-face card-back" aria-hidden={faceUp}>
			<span class="back-frame">
				<span class="back-inner">
					<span class="back-corner tl">♠</span>
					<span class="back-corner tr">♥</span>
					<span class="back-corner bl">♦</span>
					<span class="back-corner br">♣</span>
				</span>
			</span>
		</span>
	</button>
</div>

<style>
	.card-scene {
		position: relative;
		width: 100%;
		max-width: 128px;
		aspect-ratio: 5 / 7;
		perspective: 800px;
		transition:
			transform 0.18s ease,
			opacity 200ms ease;
	}
	.card-scene.drawing {
		transform: translateY(-16px);
	}
	.card-scene.replacing {
		opacity: 0;
		transform: translateY(18px) scale(0.96);
	}
	.card-scene:has(.card.interactive:hover:not(:disabled)):not(.drawing):not(.replacing) {
		transform: translateY(-5px);
	}
	.card-scene.win-glow .card-front {
		border-color: #ffd54a;
		box-shadow:
			0 0 0 3px rgba(255, 213, 74, 0.85),
			0 0 22px rgba(255, 213, 74, 0.65),
			0 10px 20px rgba(0, 0, 0, 0.45);
	}
	.card-scene.win-glow {
		transform: translateY(-4px) scale(1.04);
	}

	.card {
		position: relative;
		container-type: inline-size;
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		background: transparent;
		cursor: default;
		box-sizing: border-box;
		transform-style: preserve-3d;
		transform: rotateY(0deg);
		transition: transform 350ms ease;
	}
	.card.flipped {
		transform: rotateY(180deg);
	}
	.card.instant {
		transition: none;
	}
	.card.interactive {
		cursor: pointer;
	}
	.card:disabled {
		pointer-events: none;
	}

	.card-face {
		position: absolute;
		inset: 0;
		border-radius: 12px;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		overflow: hidden;
		box-sizing: border-box;
	}

	.card-front {
		display: block;
		border: 3px solid #e2e8f0;
		background: #fff;
		box-shadow:
			0 10px 20px rgba(0, 0, 0, 0.5),
			0 2px 0 rgba(255, 255, 255, 0.2) inset;
		transform: rotateY(180deg);
		transition:
			box-shadow 180ms ease,
			border-color 180ms ease,
			transform 180ms ease;
	}
	.card-scene.held .card-front {
		border-color: #ffd54a;
		box-shadow:
			0 0 0 3px rgba(255, 213, 74, 0.75),
			0 12px 24px rgba(0, 0, 0, 0.55);
	}
	.face-art {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
		user-select: none;
	}

	.card-back {
		border: 3px solid #ffd54a;
		background: linear-gradient(165deg, #001240 0%, #0a1f6e 52%, #001a5c 100%);
		box-shadow:
			0 10px 20px rgba(0, 0, 0, 0.5),
			inset 0 0 0 1px rgba(255, 213, 74, 0.35);
		transform: rotateY(0deg);
	}
	.card-scene.drawing .card-back {
		border-color: #93c5fd;
	}

	.back-frame {
		position: absolute;
		inset: 7cqw;
		border-radius: 8cqw;
		border: 2px solid rgba(255, 213, 74, 0.55);
		background:
			repeating-linear-gradient(
				45deg,
				rgba(255, 213, 74, 0.07) 0 1px,
				transparent 1px 7px
			),
			repeating-linear-gradient(
				-45deg,
				rgba(255, 213, 74, 0.05) 0 1px,
				transparent 1px 7px
			),
			linear-gradient(180deg, rgba(0, 18, 64, 0.6) 0%, rgba(0, 8, 40, 0.85) 100%);
		box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.35);
	}
	.back-inner {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 6px;
		border: 1px dashed rgba(255, 213, 74, 0.35);
	}
	.back-corner {
		position: absolute;
		color: rgba(255, 213, 74, 0.45);
		font-size: 11.5cqw;
		line-height: 1;
	}
	.back-corner.tl {
		top: 4cqw;
		left: 5cqw;
	}
	.back-corner.tr {
		top: 4cqw;
		right: 5cqw;
	}
	.back-corner.bl {
		bottom: 4cqw;
		left: 5cqw;
	}
	.back-corner.br {
		right: 5cqw;
		bottom: 4cqw;
	}
</style>
