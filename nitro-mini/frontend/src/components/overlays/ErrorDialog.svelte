<script lang="ts">
	import { tick } from 'svelte';

	import { stateGame } from '../../game/stateGame.svelte';

	let okBtn: HTMLButtonElement | undefined = $state();

	const error = $derived(stateGame.error);
	const dismiss = () => (stateGame.error = null);

	$effect(() => {
		if (error) void tick().then(() => okBtn?.focus());
	});
	const onKey = (e: KeyboardEvent) => {
		if (error && (e.key === 'Escape' || e.key === 'Enter')) {
			e.preventDefault();
			dismiss();
		}
		if (error) e.stopPropagation();
	};
</script>

{#if error}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="scrim" role="presentation" data-testid="error-toast">
		<div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="err-title" aria-describedby="err-msg" tabindex="-1" onkeydown={onKey}>
			<div class="badge" aria-hidden="true">!</div>
			<h2 id="err-title">{error.title ?? 'SOMETHING WENT WRONG'}</h2>
			<p id="err-msg">{error.message}</p>
			<button type="button" class="ok" bind:this={okBtn} onclick={dismiss}>OK</button>
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: absolute;
		inset: 0;
		z-index: 70;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: rgba(4, 2, 8, 0.72);
		pointer-events: auto;
		animation: fade-in 0.2s ease-out;
	}
	.dlg {
		width: min(100%, 420px);
		padding: 22px 24px 20px;
		border: 3px solid #ff5a3a;
		border-radius: 20px;
		background: linear-gradient(180deg, #3a0f10 0%, #1a0708 100%);
		box-shadow:
			0 0 40px rgba(255, 60, 30, 0.45),
			0 14px 30px rgba(0, 0, 0, 0.7);
		text-align: center;
		animation: pop-in 0.3s cubic-bezier(0.2, 1.3, 0.4, 1);
	}
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		margin-bottom: 6px;
		border-radius: 50%;
		background: linear-gradient(180deg, #ff8a5a, #d8281a);
		box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.4);
		color: #fff;
		font-family: var(--nv-font-display);
		font-size: 30px;
	}
	h2 {
		margin: 0 0 8px;
		font-family: var(--nv-font-display);
		font-weight: 400;
		font-size: 30px;
		letter-spacing: 0.06em;
		color: #ffd9c4;
	}
	p {
		margin: 0 0 18px;
		font-family: var(--nv-font-ui);
		font-size: 15px;
		line-height: 1.5;
		color: rgba(255, 233, 220, 0.9);
	}
	.ok {
		min-width: 130px;
		padding: 10px 24px;
		border: 2px solid #ffd54a;
		border-radius: 12px;
		background: linear-gradient(180deg, #ffd54a, #e08a10);
		color: #2a1400;
		font-family: var(--nv-font-display);
		font-size: 22px;
		letter-spacing: 0.1em;
		cursor: pointer;
	}
	.ok:hover {
		filter: brightness(1.08);
	}
	.ok:focus-visible {
		outline: 3px solid var(--nv-cyan);
		outline-offset: 3px;
	}
	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}
	@keyframes pop-in {
		from {
			transform: scale(0.85);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.scrim,
		.dlg {
			animation: none;
		}
	}
</style>
