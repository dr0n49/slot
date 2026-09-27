<script lang="ts">
	import { stateBet } from 'state-shared';

	import { symbolUrl } from '../../game/assets';
	import { BONUS_COST, FREE_SPINS, GAME, LADDER, PAYTABLE, SYMBOLS } from '../../game/config';
	import { formatAmount, formatX } from '../../game/constants';
	import { sfx } from '../../game/sfx';
	import { uiState } from '../../game/uiState.svelte';
	import { ICONS } from '../hud/icons';

	const rows = [...SYMBOLS.paying];
	const pay = (sym: string, kind: number) => PAYTABLE[sym]?.[String(kind)] ?? 0;
	const close = () => {
		sfx.play('ui_close');
		uiState.infoOpen = false;
	};
	/** keys typed inside the dialog must not reach the game hotkeys (Space would spin) */
	const onDialogKey = (e: KeyboardEvent) => {
		if (e.key === 'Escape') close();
		e.stopPropagation();
	};
	const onKey = (e: KeyboardEvent) => {
		if (uiState.infoOpen && e.key === 'Escape') close();
	};
	const tabs = [
		['paytable', 'Paytable'],
		['features', 'Features'],
		['rules', 'Rules'],
	] as const;
	const wildReels = `2–${GAME.numReels}`;
</script>

<svelte:window onkeydown={onKey} />

{#if uiState.infoOpen}
	<div class="scrim" role="presentation" onclick={close}>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="dlg"
			role="dialog"
			aria-modal="true"
			aria-label="Game information"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={onDialogKey}
			data-testid="info-dialog"
		>
			<header>
				<div class="tabs" role="tablist">
					{#each tabs as [id, label] (id)}
						<button
							type="button"
							role="tab"
							aria-selected={uiState.infoTab === id}
							class:on={uiState.infoTab === id}
							onclick={() => {
								sfx.play('ui_toggle');
								uiState.infoTab = id;
							}}>{label}</button
						>
					{/each}
				</div>
				<button type="button" class="x" aria-label="Close" onclick={close}>
					<svg viewBox="0 0 24 24"><path d={ICONS.close} /></svg>
				</button>
			</header>

			<div class="body">
				{#if uiState.infoTab === 'paytable'}
					<p class="note">
						Wins pay <b>per way</b>: a symbol wins when it lands on {4} or more neighbouring reels starting from the
						leftmost reel. Values are multiples of your total bet per way; the amount for your current bet is shown
						beneath.
					</p>
					<div class="grid">
						{#each rows as sym (sym)}
							<div class="sym">
								<img src={symbolUrl(sym)} alt="" width="64" height="64" />
								<div class="pays">
									{#each [5, 4, 3] as kind (kind)}
										{#if pay(sym, kind) > 0}
											<div>
												<span class="k">{kind}</span>
												<span class="v">{formatX(pay(sym, kind))}</span>
												<span class="m">{formatAmount(pay(sym, kind) * stateBet.betAmount)}</span>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/each}
					</div>
					<div class="specials">
						<div><img src={symbolUrl(SYMBOLS.wild)} alt="" width="52" height="52" /><span><b>WILD</b> substitutes for every paying symbol on reels {wildReels}. It is removed with the win it completes.</span></div>
						<div><img src={symbolUrl(SYMBOLS.scatter)} alt="" width="52" height="52" /><span><b>SCATTER</b> 3, 4 or 5 anywhere trigger the Free Spins. Scatters stay on the board while symbols cascade.</span></div>
						<div><img src={symbolUrl(SYMBOLS.keg)} alt="" width="52" height="52" /><span><b>NITRO KEG</b> detonates with any winning cascade step and lifts the Blast Ladder.</span></div>
						<div><img src={symbolUrl(SYMBOLS.rock)} alt="" width="52" height="52" /><span><b>BEDROCK</b> never pays and is never removed — it only falls with gravity.</span></div>
					</div>
				{:else if uiState.infoTab === 'features'}
					<h3>Cascades</h3>
					<p>
						Every winning symbol is blasted away and the symbols above fall down while new ones drop in. Cascades
						continue until no more wins are formed. All wins of the spin are added together.
					</p>
					<h3>Blast Ladder</h3>
					<p>
						Each winning cascade step climbs one rung and pays with that rung's multiplier. Every Nitro Keg on the
						board when a step wins detonates and carries the step <b>one extra rung per keg</b> — and the step
						<b>pays on every rung it passes through</b>, so a blast through ×2, ×3 and ×5 pays all three.
						The ladder resets at the start of every spin, in the base game and in free spins alike.
					</p>
					<div class="ladder">
						<div><b>Base game</b>{#each LADDER.basegame as v (v)}<span>×{v}</span>{/each}</div>
						<div><b>Free spins</b>{#each LADDER.freegame as v, i (i)}<span>×{v}</span>{/each}</div>
					</div>
					<h3>Deep Vein free spins</h3>
					<p>
						{#each Object.entries(FREE_SPINS.trigger) as [s, n], i (s)}{i ? ' · ' : ''}{s} scatters = {n} free spins{/each}.
						Landing {Object.keys(FREE_SPINS.retrigger).join(' / ')} scatters again during the feature adds
						{Object.values(FREE_SPINS.retrigger).join(' / ')} more. <b>Free spins run on their own, higher ladder</b>,
						which — like the base game — starts from its bottom rung on every spin.
					</p>
					<h3>Bonus buy</h3>
					<p>Buy the feature for {BONUS_COST}× your bet. Bonus buy has the same RTP as the base game.</p>
					<p>Every feature is entered with 3 scatters and runs for {Object.values(FREE_SPINS.trigger)[0]} free spins.</p>
				{:else}
					<h3>Rules</h3>
					<ul>
						<li>The game is played on {GAME.numReels} reels × {GAME.numRows} rows ({GAME.numReels * GAME.numRows} symbol positions).</li>
						<li>Wins pay left to right on adjacent reels, starting from the first reel, with at least 4 matching reels.</li>
						<li>The number of ways multiplies the win: every matching symbol on a reel counts.</li>
						<li>Wilds appear on reels {wildReels} only.</li>
						<li>Only the highest win per symbol is paid; wins are shown in your currency and rounded to 0.01× of your bet.</li>
						<li>Total win is capped at {GAME.wincap.toLocaleString('en-US')}× your bet. When it is reached the round ends immediately.</li>
						<li>Theoretical return to player (RTP): {(GAME.rtp * 100).toFixed(2)}%.</li>
						<li>Malfunction voids all pays and plays. Every outcome is decided by the game server before it is shown.</li>
						<li>Press <b>Space</b> to spin / skip animations. Use <b>Turbo</b> for faster rounds and <b>Auto</b> for automatic play.</li>
					</ul>
				{/if}
			</div>
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
		background: rgba(4, 2, 8, 0.82);
		z-index: 50;
		animation: fade 0.2s ease-out;
	}
	.dlg {
		display: flex;
		flex-direction: column;
		width: min(94%, 760px);
		max-height: 92%;
		border: 3px solid var(--nv-gold);
		border-radius: 22px;
		background: linear-gradient(180deg, #2b1640 0%, #120a1c 100%);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.75);
		color: var(--nv-cream);
		font-family: var(--nv-font-ui);
		overflow: hidden;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 10px 12px 8px 16px;
		border-bottom: 1px solid var(--nv-line);
	}
	.tabs {
		display: flex;
		gap: 6px;
	}
	.tabs button {
		padding: 9px 16px;
		border: 2px solid transparent;
		border-radius: 999px;
		background: transparent;
		color: rgba(255, 243, 196, 0.7);
		font-family: var(--nv-font-display);
		font-size: 19px;
		letter-spacing: 0.08em;
		cursor: pointer;
	}
	.tabs button.on {
		border-color: var(--nv-gold);
		background: rgba(255, 213, 74, 0.14);
		color: #fff;
	}
	.tabs button:focus-visible,
	.x:focus-visible {
		outline: 3px solid var(--nv-cyan);
	}
	.x {
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
	.body {
		padding: 14px 18px 18px;
		overflow-y: auto;
		font-size: 14px;
		line-height: 1.5;
		scrollbar-color: #8b6914 transparent;
	}
	.note {
		margin: 0 0 12px;
		color: rgba(255, 243, 196, 0.85);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	.sym {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
		border: 1px solid var(--nv-line);
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.3);
	}
	.sym img {
		flex: none;
	}
	.pays {
		display: flex;
		flex-direction: column;
		gap: 1px;
		font-size: 12px;
		min-width: 0;
	}
	.pays div {
		display: flex;
		align-items: baseline;
		gap: 5px;
	}
	.pays .k {
		width: 12px;
		color: #ff9a2e;
		font-weight: 700;
	}
	.pays .v {
		font-family: var(--nv-font-display);
		font-size: 16px;
		color: #fff;
	}
	.pays .m {
		color: rgba(255, 243, 196, 0.5);
		font-size: 11px;
	}
	.specials {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		margin-top: 14px;
	}
	.specials div {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		line-height: 1.35;
	}
	.specials img {
		flex: none;
	}
	h3 {
		margin: 14px 0 4px;
		font-family: var(--nv-font-display);
		font-size: 22px;
		font-weight: 400;
		letter-spacing: 0.08em;
		color: var(--nv-gold);
	}
	h3:first-child {
		margin-top: 0;
	}
	p {
		margin: 0;
	}
	ul {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.ladder {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 8px;
	}
	.ladder div {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}
	.ladder b {
		width: 100%;
		font-size: 12px;
		letter-spacing: 0.14em;
		color: #ff9a2e;
		text-transform: uppercase;
	}
	.ladder span {
		padding: 1px 8px;
		border-radius: 6px;
		background: rgba(255, 213, 74, 0.14);
		font-family: var(--nv-font-display);
		font-size: 14px;
	}
	@media (max-width: 640px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.specials {
			grid-template-columns: 1fr;
		}
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
