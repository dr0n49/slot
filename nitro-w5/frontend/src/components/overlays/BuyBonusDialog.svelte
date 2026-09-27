<script lang="ts">
	import { stateBet } from 'state-shared';
	import { tick } from 'svelte';

	import { BONUS_COST, FREE_SPINS, GAME, MODES } from '../../game/config';
	import { formatAmount, formatBetLabel } from '../../game/constants';
	import { getContext } from '../../game/context';
	import { sfx } from '../../game/sfx';
	import { uiState } from '../../game/uiState.svelte';
	import { ICONS } from '../hud/icons';

	const context = getContext();
	const price = $derived(stateBet.betAmount * BONUS_COST);
	const affordable = $derived(price <= stateBet.balanceAmount);
	let confirmBtn: HTMLButtonElement | undefined = $state();

	$effect(() => {
		if (uiState.buyOpen) void tick().then(() => confirmBtn?.focus());
	});

	const close = () => {
		sfx.play('ui_close');
		uiState.buyOpen = false;
	};
	const confirm = () => {
		if (!affordable) return;
		sfx.play('buy_confirm');
		uiState.buyOpen = false;
		stateBet.activeBetModeKey = MODES.bonus as never;
		context.eventEmitter.broadcast({ type: 'bet' });
	};
	/** keys typed inside the dialog must not reach the game hotkeys (Space would spin) */
	const onDialogKey = (e: KeyboardEvent) => {
		if (e.key === 'Escape') close();
		e.stopPropagation();
	};
	const onKey = (e: KeyboardEvent) => {
		if (uiState.buyOpen && e.key === 'Escape') close();
	};
	const triggers = Object.entries(FREE_SPINS.trigger);
</script>

<svelte:window onkeydown={onKey} />

{#if uiState.buyOpen}
	<div class="scrim" role="presentation" onclick={close}>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="dlg"
			role="dialog"
			aria-modal="true"
			aria-labelledby="buy-title"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={onDialogKey}
			data-testid="buy-dialog"
		>
			<button type="button" class="x" aria-label="Close" onclick={close}>
				<svg viewBox="0 0 24 24"><path d={ICONS.close} /></svg>
			</button>
			<div class="kicker">BONUS BUY</div>
			<h2 id="buy-title">DEEP VEIN</h2>
			<p>
				Skip the base game and start the <b>Free Spins</b> feature straight away. You get {triggers
					.map(([s, n]) => `${n} spins for ${s} scatters`)
					.join(', ')}. The Blast Ladder is never reset between free spins.
			</p>
			<div class="price">
				<span>COST</span>
				<strong data-testid="buy-price">{formatAmount(price)}</strong>
				<em>{BONUS_COST}× bet ({formatBetLabel(stateBet.betAmount)})</em>
			</div>
			{#if !affordable}<div class="warn">Your balance is too low for this bonus.</div>{/if}
			<div class="actions">
				<button type="button" class="nv-btn" onclick={close}>Cancel</button>
				<button
					type="button"
					class="nv-btn gold big"
					bind:this={confirmBtn}
					disabled={!affordable}
					onclick={confirm}
					data-testid="buy-confirm"
				>
					Buy for {formatAmount(price)}
				</button>
			</div>
			<small>RTP {(GAME.rtp * 100).toFixed(2)}% · max win {GAME.wincap.toLocaleString('en-US')}×</small>
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(4, 2, 8, 0.78);
		z-index: 50;
		animation: fade 0.2s ease-out;
	}
	.dlg {
		position: relative;
		width: min(92%, 520px);
		padding: 26px 28px 20px;
		border: 3px solid var(--nv-gold);
		border-radius: 22px;
		background: linear-gradient(180deg, #341a48 0%, #150a20 100%);
		box-shadow:
			0 0 40px rgba(255, 106, 26, 0.35),
			0 16px 36px rgba(0, 0, 0, 0.7);
		text-align: center;
		color: var(--nv-cream);
		font-family: var(--nv-font-ui);
	}
	.kicker {
		font-size: 13px;
		letter-spacing: 0.3em;
		font-weight: 700;
		color: #ff9a2e;
	}
	h2 {
		margin: 2px 0 8px;
		font-family: var(--nv-font-display);
		font-size: 52px;
		letter-spacing: 0.08em;
		font-weight: 400;
		background: linear-gradient(180deg, #ffb27a, #ff5a1a 55%, #a01a05);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	p {
		margin: 0 0 14px;
		font-size: 15px;
		line-height: 1.5;
		color: rgba(255, 243, 196, 0.9);
	}
	.price {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 6px 0 12px;
		padding: 10px;
		border-radius: 14px;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid var(--nv-line);
	}
	.price span {
		font-size: 12px;
		letter-spacing: 0.24em;
		font-weight: 700;
		color: #ff9a2e;
	}
	.price strong {
		font-family: var(--nv-font-display);
		font-size: 46px;
		font-weight: 400;
		line-height: 1.05;
		color: #fff;
		text-shadow: var(--nv-text-shadow);
	}
	.price em {
		font-style: normal;
		font-size: 13px;
		color: rgba(255, 243, 196, 0.7);
	}
	.warn {
		margin-bottom: 10px;
		color: #ff9a9a;
		font-weight: 700;
		font-size: 14px;
	}
	.actions {
		display: flex;
		gap: 12px;
		justify-content: center;
	}
	.actions .nv-btn {
		flex-direction: row;
		min-height: 52px;
		font-size: 14px;
		padding: 6px 22px;
	}
	.actions .big {
		flex: 1 1 auto;
		font-size: 16px;
	}
	small {
		display: block;
		margin-top: 12px;
		font-size: 12px;
		color: rgba(255, 243, 196, 0.55);
	}
	.x {
		position: absolute;
		top: 10px;
		right: 10px;
		display: inline-flex;
		width: 40px;
		height: 40px;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
		color: var(--nv-gold);
		cursor: pointer;
	}
	.x svg {
		width: 22px;
		height: 22px;
		fill: currentColor;
	}
	.x:focus-visible {
		outline: 3px solid var(--nv-cyan);
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
