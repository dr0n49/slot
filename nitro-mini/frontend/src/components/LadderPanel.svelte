<script lang="ts">
	import { formatBookWin } from '../game/constants';
	import { stateGame } from '../game/stateGame.svelte';

	type Props = { portrait: boolean; width: number; top: number; height: number };
	const { portrait, width, top, height }: Props = $props();

	const values = $derived(stateGame.ladderValues);
	const count = $derived(values.length);
	const idx = $derived(Math.min(stateGame.ladderIndex, Math.max(0, count - 1)));
	const current = $derived(values[idx] ?? 1);
	const paid = $derived(stateGame.ladderPayMultiplier);
	const boosted = $derived(stateGame.ladderBoost > 0);
	const pulse = $derived(stateGame.ladderPulse);
	/** The rung a K-4 blast is walking through right now, straight from the book event. */
	const tick = $derived(stateGame.ladderTick);

	/** Heat ramp: cold steel → gold → ember → blast red → white-hot magenta at the top of the ladder. */
	const STOPS: [number, number, number][] = [
		[120, 214, 255],
		[255, 213, 74],
		[255, 138, 30],
		[255, 59, 46],
		[255, 110, 230],
	];
	const heat = (t: number) => {
		const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
		const i = Math.min(STOPS.length - 2, Math.floor(x));
		const f = x - i;
		const [a, b] = [STOPS[i], STOPS[i + 1]];
		return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)} ${Math.round(a[1] + (b[1] - a[1]) * f)} ${Math.round(a[2] + (b[2] - a[2]) * f)})`;
	};
	const tOf = (i: number) => (count > 1 ? i / (count - 1) : 0);

	/** rungs shown top→bottom (highest first) in the rail */
	const rungs = $derived(values.map((v, i) => ({ v, i, heat: heat(tOf(i)) })).reverse());
	const heatNow = $derived(heat(tOf(idx)));
	/** how far up the ladder the fuse has burned (measured from the bottom rung's centre) */
	const burn = $derived(count > 0 ? ((idx + 0.5) / count) * 100 : 0);
</script>

{#if !portrait}
	<aside
		class="rail"
		style="left: 12px; top: {top}px; width: {width - 24}px; height: {height}px; --heat-now: {heatNow}"
		aria-label="Blast Ladder"
	>
		<span class="rivet tl"></span><span class="rivet tr"></span><span class="rivet bl"></span><span class="rivet br"></span>

		<header class="head">
			<svg class="bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.4 1.6 5.2 13.4h5.4L8.3 22.4 19.1 9.5h-5.6L13.4 1.6z" /></svg>
			<span class="title">BLAST LADDER</span>
			<svg class="bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.4 1.6 5.2 13.4h5.4L8.3 22.4 19.1 9.5h-5.6L13.4 1.6z" /></svg>
		</header>

		<div class="shaft">
			<div class="fuse" aria-hidden="true">
				<i class="fuse-burn" style="height: {burn}%"></i>
				<i class="spark" style="bottom: {burn}%"></i>
			</div>
			<ol class="rungs" data-testid="ladder">
				{#each rungs as r (r.i)}
					<li
						class:done={r.i < idx}
						class:current={r.i === idx}
						class:top={r.i === count - 1}
						style="--heat: {r.heat}"
					>
						<span class="node"></span>
						<span class="plate">
							{#if r.i === idx}
								{#key pulse}<i class="sweep"></i>{/key}
							{/if}
							<span class="v"><em>×</em>{r.v}</span>
							{#if tick && tick.index === r.i && tick.win > 0}
								{#key tick.ordinal}<span class="paid">+{formatBookWin(tick.win)}</span>{/key}
							{/if}
							{#if r.i === count - 1}<span class="tag">MAX</span>{/if}
						</span>
					</li>
				{/each}
			</ol>
		</div>

		<footer class="foot">
			<span class="hint">NEXT WIN</span>
			<span class="cur" data-testid="ladder-current"><em>×</em>{current}</span>
			{#if boosted}
				{#key pulse}<span class="keg">TNT +{stateGame.ladderBoost}</span>{/key}
			{/if}
		</footer>
	</aside>
{:else}
	<aside class="strip" style="top: {top}px; height: {height}px; --heat-now: {heatNow}" aria-label="Blast Ladder">
		<div class="lbl">
			<svg class="bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.4 1.6 5.2 13.4h5.4L8.3 22.4 19.1 9.5h-5.6L13.4 1.6z" /></svg>
			<span>BLAST<br />LADDER</span>
		</div>
		<div class="track" data-testid="ladder">
			<i class="t-line"></i>
			<i class="t-burn" style="width: {count > 1 ? (idx / (count - 1)) * 100 : 0}%"></i>
			{#each rungs.slice().reverse() as r (r.i)}
				<span
					class="pip"
					class:done={r.i < idx}
					class:current={r.i === idx}
					style="--heat: {r.heat}; left: {count > 1 ? (r.i / (count - 1)) * 100 : 0}%"
				>
					{#if r.i === idx}<b>×{r.v}</b>{/if}
					{#if tick && tick.index === r.i && tick.win > 0}
						{#key tick.ordinal}<i class="paid-pip">+{formatBookWin(tick.win)}</i>{/key}
					{/if}
				</span>
			{/each}
		</div>
		<div class="now">
			<span class="cur" data-testid="ladder-current"><em>×</em>{current}</span>
			{#if boosted}
				{#key pulse}<span class="keg">TNT +{stateGame.ladderBoost}</span>{/key}
			{/if}
		</div>
	</aside>
{/if}
<span class="sr" aria-live="polite">Multiplier {paid}</span>

<style>
	/* ---------- landscape rail ---------- */
	.rail {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		padding: 10px 10px 10px;
		box-sizing: border-box;
		border: 2px solid transparent;
		border-radius: 16px;
		background:
			radial-gradient(120% 60% at 50% 100%, color-mix(in srgb, var(--heat-now) 22%, transparent), transparent 70%) padding-box,
			repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.025) 0 2px, transparent 2px 9px) padding-box,
			linear-gradient(180deg, rgba(34, 22, 52, 0.94), rgba(10, 6, 18, 0.96)) padding-box,
			linear-gradient(180deg, #ffe08a 0%, #b8860b 45%, #6b4a08 100%) border-box;
		box-shadow:
			0 10px 24px rgba(0, 0, 0, 0.55),
			inset 0 0 0 1px rgba(255, 255, 255, 0.05),
			inset 0 0 26px rgba(0, 0, 0, 0.55);
		z-index: 12;
		transition: background 0.5s;
	}
	.rivet {
		position: absolute;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, #fff3c4, #b8860b 70%);
		box-shadow: 0 1px 1px rgba(0, 0, 0, 0.7);
	}
	.rivet.tl {
		top: 6px;
		left: 6px;
	}
	.rivet.tr {
		top: 6px;
		right: 6px;
	}
	.rivet.bl {
		bottom: 6px;
		left: 6px;
	}
	.rivet.br {
		bottom: 6px;
		right: 6px;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 8px;
		padding-bottom: 7px;
		border-bottom: 1px solid transparent;
		border-image: linear-gradient(90deg, transparent, rgba(255, 213, 74, 0.55), transparent) 1;
	}
	.title {
		font-family: var(--nv-font-display);
		font-size: 17px;
		line-height: 1;
		letter-spacing: 0.14em;
		background: linear-gradient(180deg, #fff3a0, #ffc107 55%, #d98a0a);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.75));
	}
	.bolt {
		width: 13px;
		height: 13px;
		fill: var(--heat-now);
		filter: drop-shadow(0 0 6px var(--heat-now));
		transition: fill 0.4s;
	}

	.shaft {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
	}
	.fuse {
		position: absolute;
		left: 15px;
		top: 0;
		bottom: 0;
		width: 4px;
		margin-left: -2px;
		border-radius: 2px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.06));
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.5);
	}
	.fuse-burn {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		border-radius: 2px;
		background: linear-gradient(0deg, #ff6a1a, var(--heat-now));
		box-shadow: 0 0 10px var(--heat-now);
		transition: height 0.55s cubic-bezier(0.3, 0.9, 0.3, 1);
	}
	.spark {
		position: absolute;
		left: 50%;
		width: 12px;
		height: 12px;
		margin: 0 0 -6px -6px;
		border-radius: 50%;
		background: radial-gradient(circle, #fff 0 30%, #ffd54a 55%, transparent 72%);
		box-shadow:
			0 0 12px 3px var(--heat-now),
			0 0 22px 6px rgba(255, 150, 30, 0.55);
		transition: bottom 0.55s cubic-bezier(0.3, 0.9, 0.3, 1);
		animation: spark 0.34s steps(2, end) infinite alternate;
	}
	@keyframes spark {
		from {
			transform: scale(0.85);
			filter: brightness(1);
		}
		to {
			transform: scale(1.2);
			filter: brightness(1.35);
		}
	}

	.rungs {
		position: relative;
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
		min-height: 0;
	}
	.rungs li {
		position: relative;
		display: flex;
		align-items: center;
		flex: 1 1 0;
		min-height: 0;
		padding: 1.5px 0;
		gap: 9px;
	}
	.node {
		flex: none;
		width: 9px;
		height: 9px;
		margin-left: 11px;
		border-radius: 50%;
		background: #1b1326;
		border: 2px solid color-mix(in srgb, var(--heat) 55%, #000);
		z-index: 1;
		transition: all 0.3s;
	}
	.plate {
		position: relative;
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 100%;
		padding: 0 12px 0 10px;
		border-radius: 7px;
		border: 1px solid color-mix(in srgb, var(--heat) 26%, transparent);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0.22)),
			rgba(22, 15, 34, 0.85);
		overflow: hidden;
		transition:
			background 0.3s,
			border-color 0.3s,
			box-shadow 0.3s,
			transform 0.3s;
	}
	.v {
		position: relative;
		font-family: var(--nv-font-display);
		font-size: clamp(11px, 2.7vh, 21px);
		line-height: 1;
		letter-spacing: 0.06em;
		color: color-mix(in srgb, var(--heat) 62%, transparent);
		transition: color 0.3s, text-shadow 0.3s;
	}
	.v em {
		font-style: normal;
		font-family: var(--nv-font-ui);
		font-weight: 700;
		font-size: 0.8em;
		margin-right: 2px;
	}
	.tag {
		font-family: var(--nv-font-ui);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.18em;
		color: var(--heat);
		opacity: 0.85;
	}

	/* rungs already climbed: lit, calm */
	.rungs li.done .node {
		background: var(--heat);
		border-color: color-mix(in srgb, var(--heat) 40%, #000);
		box-shadow: 0 0 8px var(--heat);
	}
	.rungs li.done .plate {
		border-color: color-mix(in srgb, var(--heat) 45%, transparent);
		background:
			linear-gradient(90deg, color-mix(in srgb, var(--heat) 20%, transparent), transparent 80%),
			rgba(22, 15, 34, 0.85);
	}
	.rungs li.done .v {
		color: color-mix(in srgb, var(--heat) 85%, #fff 0%);
	}

	/* the rung the next win is paid at */
	.paid {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		font: 700 11.5px/1 var(--nv-ui, system-ui), sans-serif;
		letter-spacing: 0.02em;
		color: #0c0705;
		background: linear-gradient(180deg, #ffe6a4, #f0b46a);
		border-radius: 999px;
		padding: 3px 7px;
		white-space: nowrap;
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.45), 0 0 14px rgba(255, 196, 106, 0.55);
		animation: paid-pop 480ms ease-out both;
		pointer-events: none;
	}
	@keyframes paid-pop {
		0% { opacity: 0; transform: translateY(-50%) scale(0.72); }
		45% { opacity: 1; transform: translateY(-50%) scale(1.06); }
		100% { opacity: 1; transform: translateY(-50%) scale(1); }
	}
	.paid-pip {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		font: 700 10.5px/1 var(--nv-ui, system-ui), sans-serif;
		font-style: normal;
		color: #0c0705;
		background: linear-gradient(180deg, #ffe6a4, #f0b46a);
		border-radius: 999px;
		padding: 2px 6px;
		white-space: nowrap;
		animation: paid-pop 480ms ease-out both;
		pointer-events: none;
	}

	.rungs li.current .node {
		width: 15px;
		height: 15px;
		margin-left: 8px;
		background: #fff;
		border-color: var(--heat);
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--heat) 40%, transparent),
			0 0 16px 2px var(--heat);
	}
	.rungs li.current .plate {
		transform: scale(1.07, 1.12);
		border-color: #fff;
		background: linear-gradient(90deg, color-mix(in srgb, var(--heat) 48%, #140a1c), color-mix(in srgb, var(--heat) 82%, #140a1c));
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--heat) 80%, #fff),
			0 0 22px 2px var(--heat),
			inset 0 1px 0 rgba(255, 255, 255, 0.55);
		z-index: 2;
	}
	.rungs li.current .v {
		color: #fff;
		text-shadow:
			0 2px 0 rgba(0, 0, 0, 0.7),
			0 0 10px rgba(0, 0, 0, 0.5);
	}
	.rungs li.current .tag {
		color: #fff;
	}
	.sweep {
		position: absolute;
		inset: 0 auto 0 -40%;
		width: 40%;
		background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.85), transparent);
		transform: skewX(-18deg);
		animation: sweep 0.7s ease-out 1;
		pointer-events: none;
	}
	@keyframes sweep {
		to {
			left: 130%;
		}
	}
	.rungs li.top:not(.current) .plate {
		border-color: color-mix(in srgb, var(--heat) 55%, transparent);
	}
	.rungs li.top:not(.current) .v {
		color: var(--heat);
		text-shadow: 0 0 10px color-mix(in srgb, var(--heat) 60%, transparent);
	}

	/* ---------- footer readout ---------- */
	.foot {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px solid transparent;
		border-image: linear-gradient(90deg, transparent, rgba(255, 213, 74, 0.5), transparent) 1;
	}
	.hint {
		font-family: var(--nv-font-ui);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.26em;
		color: #ff9a2e;
	}
	.cur {
		font-family: var(--nv-font-display);
		font-size: 38px;
		line-height: 1.02;
		background: linear-gradient(180deg, #fff 20%, var(--heat-now));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.8)) drop-shadow(0 0 12px var(--heat-now));
		transition: filter 0.4s;
	}
	.cur em {
		font-style: normal;
		font-family: var(--nv-font-ui);
		font-weight: 700;
		font-size: 0.6em;
		margin-right: 2px;
	}
	.keg {
		margin-top: 3px;
		padding: 2px 9px;
		border-radius: 999px;
		background: linear-gradient(180deg, #ff4a3a, #b01212);
		border: 1px solid #ffb27a;
		box-shadow: 0 0 12px rgba(255, 70, 40, 0.7);
		color: #fff;
		font-family: var(--nv-font-display);
		font-size: 13px;
		letter-spacing: 0.08em;
		animation: keg-pop 0.5s ease-out;
	}
	@keyframes keg-pop {
		0% {
			transform: scale(1.35);
			filter: brightness(1.6);
		}
		100% {
			transform: scale(1);
			filter: none;
		}
	}

	/* ---------- portrait strip ---------- */
	.strip {
		position: absolute;
		left: 14px;
		right: 14px;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 14px;
		padding: 0 14px;
		border: 2px solid transparent;
		border-radius: 14px;
		background:
			radial-gradient(90% 140% at 100% 50%, color-mix(in srgb, var(--heat-now) 24%, transparent), transparent 70%) padding-box,
			linear-gradient(180deg, rgba(34, 22, 52, 0.94), rgba(10, 6, 18, 0.96)) padding-box,
			linear-gradient(180deg, #ffe08a 0%, #b8860b 50%, #6b4a08 100%) border-box;
		box-shadow: 0 8px 18px rgba(0, 0, 0, 0.5);
		z-index: 12;
	}
	.lbl {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--nv-font-display);
		font-size: 13px;
		line-height: 1.05;
		letter-spacing: 0.12em;
		background: linear-gradient(180deg, #fff3a0, #ffc107 60%, #d98a0a);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.lbl .bolt {
		width: 15px;
		height: 15px;
	}
	.track {
		position: relative;
		height: 34px;
		margin: 0 8px;
	}
	.t-line,
	.t-burn {
		position: absolute;
		left: 0;
		top: 50%;
		height: 4px;
		margin-top: -2px;
		border-radius: 2px;
	}
	.t-line {
		right: 0;
		background: rgba(255, 255, 255, 0.12);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.5);
	}
	.t-burn {
		background: linear-gradient(90deg, #ff6a1a, var(--heat-now));
		box-shadow: 0 0 10px var(--heat-now);
		transition: width 0.55s cubic-bezier(0.3, 0.9, 0.3, 1);
	}
	.pip {
		position: absolute;
		top: 50%;
		width: 9px;
		height: 9px;
		margin: -4.5px 0 0 -4.5px;
		border-radius: 50%;
		background: #1b1326;
		border: 2px solid color-mix(in srgb, var(--heat) 55%, #000);
		box-sizing: border-box;
		transition: all 0.3s;
	}
	.pip.done {
		background: var(--heat);
		box-shadow: 0 0 6px var(--heat);
	}
	.pip.current {
		width: 20px;
		height: 20px;
		margin: -10px 0 0 -10px;
		background: #fff;
		border-color: var(--heat);
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--heat) 40%, transparent),
			0 0 16px 3px var(--heat);
		animation: spark 0.34s steps(2, end) infinite alternate;
		z-index: 2;
	}
	.pip.current b {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 6px);
		transform: translateX(-50%);
		padding: 1px 7px;
		border-radius: 6px;
		background: var(--heat);
		font-family: var(--nv-font-display);
		font-size: 14px;
		line-height: 1.15;
		color: #1a0a08;
		white-space: nowrap;
	}
	.now {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 62px;
	}
	.strip .cur {
		font-size: 32px;
	}
	.strip .keg {
		position: absolute;
		right: 12px;
		bottom: -10px;
		margin: 0;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	@media (prefers-reduced-motion: reduce) {
		.spark,
		.pip.current,
		.sweep,
		.keg {
			animation: none;
		}
	}
</style>
