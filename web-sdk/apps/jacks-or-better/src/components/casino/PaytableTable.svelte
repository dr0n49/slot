<script lang="ts">
	import { stateBet } from 'state-shared';

	import {
		PAYTABLE_7_5_ROWS,
		paytableBetPayout,
		resolvedBetAmountOptions,
	} from '../../game/constants';
	import { stateGame } from '../../game/stateGame.svelte';

	const rows = $derived(
		stateGame.livePaytableRows.length > 0
			? stateGame.livePaytableRows
			: [...PAYTABLE_7_5_ROWS],
	);

	const betAmount = $derived(stateBet.betAmount);
	const betOptions = $derived(resolvedBetAmountOptions());
	const maxBet = $derived(betOptions[betOptions.length - 1]);

	const highlightedCategory = $derived.by(() => {
		if (!stateGame.handCategory) return '';
		if (stateGame.handAmount <= 0) return '';
		if (
			stateGame.roundState === 'holdSelection' ||
			stateGame.roundState === 'betPlaced' ||
			stateGame.roundState === 'initialDeal'
		) {
			return '';
		}
		return stateGame.handCategory;
	});

	const payoutClass = (rowName: string) => {
		const rowWin = highlightedCategory === rowName;
		const royalJackpot = rowWin && rowName === 'Royal Flush' && betAmount === maxBet;
		return [
			rowWin && !royalJackpot ? 'cell-win' : '',
			royalJackpot ? 'cell-royal-jackpot' : '',
		]
			.filter(Boolean)
			.join(' ');
	};
</script>

<div class="paytable-wrap">
	{#if stateGame.liveWalletStatus === 'offline'}
		<p class="wallet-msg">WALLET OFFLINE — START live_wallet/server.py ON :8787</p>
	{:else}
		<div class="paytable">
			<div class="paytable-grid">
				{#each rows as row (row.name)}
					<div class="pay-row" class:row-win={highlightedCategory === row.name}>
						<span class="hand-name">{row.name.toUpperCase()}</span>
						<span class="hand-dots" aria-hidden="true"></span>
						<span class="payout {payoutClass(row.name)}">
							{paytableBetPayout(row.multiplier, betAmount)}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.paytable-wrap {
		width: 100%;
		padding: 6px 10px 4px;
		box-sizing: border-box;
		flex-shrink: 0;
	}
	.paytable {
		border: 2px dashed #ffd54a;
		background: #000320;
		padding: 4px 8px 6px;
	}
	.paytable-grid {
		display: flex;
		flex-direction: column;
	}
	.pay-row {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(12px, 0.4fr) minmax(48px, 0.7fr);
		align-items: center;
		gap: 4px;
		padding: 3px 2px;
		border-bottom: 1px dashed rgba(255, 213, 74, 0.22);
	}
	.pay-row:last-child {
		border-bottom: none;
	}
	.hand-name {
		color: #ffd54a;
		font-family: 'Arial Black', Impact, sans-serif;
		font-size: 12px;
		font-weight: 900;
		letter-spacing: 0.03em;
		line-height: 1.15;
		text-shadow: 0 1px 0 #000;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.hand-dots {
		border-bottom: 2px dotted rgba(255, 213, 74, 0.4);
		min-width: 8px;
		margin-bottom: 2px;
	}
	.payout {
		text-align: center;
		color: #ffd54a;
		font-family: 'Courier New', monospace;
		font-size: 13px;
		font-weight: 700;
		padding: 2px 4px;
		text-shadow: 0 1px 0 #000;
	}
	.payout.cell-win {
		background: rgba(255, 193, 7, 0.22);
		color: #fff;
		box-shadow: inset 0 0 0 1px rgba(255, 213, 74, 0.55);
	}
	.payout.cell-royal-jackpot {
		background: #cc0000 !important;
		color: #fff !important;
		font-weight: 900;
		box-shadow: inset 0 0 0 2px #ff4444;
	}
	.row-win .hand-name {
		color: #fff;
	}
	.wallet-msg {
		margin: 0;
		padding: 10px;
		border: 2px dashed #ffd54a;
		background: #000320;
		color: #ffc107;
		font-family: 'Arial Black', Impact, sans-serif;
		font-size: 11px;
		text-align: center;
	}
</style>
