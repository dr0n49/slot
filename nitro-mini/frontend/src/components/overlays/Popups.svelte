<script lang="ts">
	import { stateGame } from '../../game/stateGame.svelte';
</script>

<div class="popups" aria-hidden="true">
	{#each stateGame.popups as p (p.id)}
		<span class="popup {p.tone}" style="left: {p.x}px; top: {p.y}px">{p.text}</span>
	{/each}
</div>

<style>
	.popups {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 14;
	}
	.popup {
		position: absolute;
		transform: translate(-50%, -50%);
		font-family: var(--nv-font-display);
		font-size: 30px;
		letter-spacing: 0.04em;
		color: #fff7c9;
		white-space: nowrap;
		text-shadow:
			0 3px 0 #5a2a00,
			0 0 14px rgba(255, 190, 40, 0.95),
			-2px -2px 0 #7a4200,
			2px -2px 0 #7a4200;
		animation: pop-float 1.4s ease-out forwards;
	}
	.popup.keg {
		font-size: 46px;
		color: #ffd9b0;
		text-shadow:
			0 3px 0 #6a1200,
			0 0 20px rgba(255, 90, 20, 1);
		animation: pop-keg 1.2s ease-out forwards;
	}
	@keyframes pop-float {
		0% {
			opacity: 0;
			transform: translate(-50%, -30%) scale(0.5);
		}
		15% {
			opacity: 1;
			transform: translate(-50%, -60%) scale(1.15);
		}
		30% {
			transform: translate(-50%, -70%) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -150%) scale(1);
		}
	}
	@keyframes pop-keg {
		0% {
			opacity: 0;
			transform: translate(-50%, -30%) scale(0.3);
		}
		20% {
			opacity: 1;
			transform: translate(-50%, -60%) scale(1.4);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -140%) scale(1);
		}
	}
</style>
