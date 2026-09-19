<script lang="ts">
	import { stateBet } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import { stateGame } from '../game/stateGame.svelte';

	const highlightedCategory = $derived.by(() => {
		if (!stateGame.handCategory) return '';
		if (stateGame.liveWalletEnabled && stateGame.handAmount <= 0) return '';
		if (
			stateGame.roundState === 'holdSelection' ||
			stateGame.roundState === 'betPlaced' ||
			stateGame.roundState === 'initialDeal'
		) {
			return '';
		}
		return stateGame.handCategory;
	});
</script>

{#if stateGame.liveWalletEnabled}
	<div class="paytable-hud">
		{#if stateGame.liveWalletStatus === 'offline'}
			<p class="wallet-offline">Wallet offline — start live_wallet/server.py on :8787</p>
		{:else if stateGame.livePaytableRows.length === 0}
			<p class="wallet-offline">Loading paytable…</p>
		{:else}
			<p class="paytable-title">7/5 Paytable</p>
			<ul class="paytable-rows">
				{#each stateGame.livePaytableRows as row (row.name)}
					{@const active = highlightedCategory === row.name}
					{@const pay = stateBet.betAmount * row.multiplier}
					<li class="paytable-row" class:active>
						<span class="hand-name">{row.name}</span>
						<span class="hand-pay">{row.multiplier}× · {numberToCurrencyString(pay)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<style>
	.paytable-hud {
		padding: 8px 10px;
		border-radius: 8px;
		background: rgba(15, 23, 42, 0.92);
		border: 1px solid rgba(51, 65, 85, 0.9);
		min-width: 220px;
		max-width: 280px;
		pointer-events: none;
	}
	.paytable-title {
		margin: 0 0 6px;
		color: #94a3b8;
		font-family: proxima-nova, sans-serif;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-align: right;
	}
	.paytable-rows {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.paytable-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 3px 8px;
		border-radius: 4px;
		border: 1px solid transparent;
		font-family: proxima-nova, sans-serif;
		font-size: 11px;
		line-height: 1.3;
	}
	.paytable-row.active {
		background: rgba(30, 58, 95, 0.95);
		border-color: #facc15;
		box-shadow: 0 0 8px rgba(250, 204, 21, 0.35);
	}
	.hand-name {
		color: #cbd5e1;
		font-weight: 500;
		text-align: left;
	}
	.paytable-row.active .hand-name {
		color: #facc15;
		font-weight: 700;
	}
	.hand-pay {
		color: #64748b;
		font-weight: 500;
		white-space: nowrap;
	}
	.paytable-row.active .hand-pay {
		color: #f8fafc;
		font-weight: 700;
	}
	.wallet-offline {
		margin: 0;
		color: #fbbf24;
		font-family: proxima-nova, sans-serif;
		font-size: 11px;
		text-align: right;
		max-width: 240px;
	}
</style>
