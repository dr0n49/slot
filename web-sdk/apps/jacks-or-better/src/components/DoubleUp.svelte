<script lang="ts" module>
	export type EmitterEventDoubleUp =
		| { type: 'doubleUpRevealStart' }
		| { type: 'doubleUpRevealDone' };
</script>

<script lang="ts">
	import { Container, Rectangle, Text, REM } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import {
		CARD_HEIGHT,
		CARD_WIDTH,
		DOUBLE_UP_MAX_CHAIN,
		formatMultiplier,
		parseCard,
		rankLabel,
		suitGlyph,
	} from '../game/constants';
	import { stateGame } from '../game/stateGame.svelte';
	import { isLiveDevHudEnabled } from '../game/liveDevHud';

	const context = getContext();
	const layout = $derived(context.stateLayoutDerived.mainLayout());
	const originX = $derived(layout.width * 0.5 - CARD_WIDTH / 2);
	const originY = $derived(layout.height * 0.5 - CARD_HEIGHT / 2 - 20);
	const parsed = $derived(stateGame.doubleUpCard ? parseCard(stateGame.doubleUpCard) : null);
	const isRed = $derived(stateGame.doubleUpColour === 'red');
	const colourFill = $derived(isRed ? 0xb42318 : 0x111827);

	context.eventEmitter.subscribeOnMount({
		doubleUpRevealStart: () => {},
		doubleUpRevealDone: () => {},
	});
</script>

{#if stateGame.doubleUpSkipped && !stateGame.liveWalletEnabled}
	<Text
		x={layout.width * 0.5}
		y={originY + CARD_HEIGHT + 72}
		anchor={{ x: 0.5, y: 0 }}
		text="No double-up — base hand lost. Win stays 0."
		style={{
			fontFamily: 'proxima-nova',
			fontSize: REM * 0.85,
			fill: 0x94a3b8,
		}}
	/>
{/if}

{#if stateGame.doubleUpActive}
	<Rectangle
		width={layout.width}
		height={layout.height}
		backgroundColor={0x0b1220}
		eventMode="none"
	/>

	{#if stateGame.sourceLabel && (!stateGame.liveWalletEnabled || isLiveDevHudEnabled())}
		<Text
			x={layout.width * 0.5}
			y={72}
			anchor={{ x: 0.5, y: 0 }}
			text={stateGame.sourceLabel}
			style={{
				fontFamily: 'proxima-nova',
				fontSize: REM * 0.7,
				fill: 0xfbbf24,
			}}
		/>
	{/if}

	<Text
		x={layout.width * 0.5}
		y={originY - 88}
		anchor={{ x: 0.5, y: 1 }}
		text={stateGame.liveHold
			? stateGame.awaitingDoubleUpChoice
				? 'Live double-up — pick Red or Black, or Collect (DECISION before card draw)'
				: 'Live double-up — card revealed after your colour choice'
			: 'Double-up outcome is pre-determined by the book — not a player choice'}
		style={{
			fontFamily: 'proxima-nova',
			fontSize: REM * 0.75,
			fill: 0xe2e8f0,
		}}
	/>

	<Text
		x={layout.width * 0.5}
		y={originY - 58}
		anchor={{ x: 0.5, y: 1 }}
		text={`Stage ${stateGame.doubleUpStep} of ${stateGame.liveHold ? stateGame.doubleUpMaxSteps : DOUBLE_UP_MAX_CHAIN}`}
		style={{
			fontFamily: 'proxima-nova',
			fontSize: REM * 0.9,
			fill: 0xcbd5e1,
		}}
	/>

	{#if !stateGame.liveHold || stateGame.awaitingDoubleUpChoice}
		<Text
			x={layout.width * 0.5}
			y={originY - 28}
			anchor={{ x: 0.5, y: 1 }}
			text={`At risk  ·  ${formatMultiplier(stateGame.doubleUpAmountAtRisk)}`}
			style={{
				fontFamily: 'proxima-nova',
				fontSize: REM * 1.5,
				fontWeight: '700',
				fill: stateGame.doubleUpAmountAtRisk > 0 ? 0xfacc15 : 0x94a3b8,
			}}
		/>
	{/if}

	<Container x={originX} y={originY} eventMode="none">
		<Rectangle
			width={CARD_WIDTH}
			height={CARD_HEIGHT}
			borderRadius={12}
			backgroundColor={stateGame.doubleUpRevealed
				? isRed
					? 0xfef2f2
					: 0xf8fafc
				: 0x1e3a5f}
			borderColor={stateGame.doubleUpRevealed ? (isRed ? 0xb42318 : 0x334155) : 0xcbd5e1}
			borderWidth={4}
		/>
		{#if stateGame.doubleUpRevealed && parsed}
			<Text
				x={16}
				y={16}
				text={`${rankLabel(parsed.rank)}${suitGlyph(parsed.suit)}`}
				style={{
					fontFamily: 'proxima-nova',
					fontSize: REM * 1.6,
					fontWeight: '700',
					fill: colourFill,
				}}
			/>
			<Text
				x={CARD_WIDTH / 2}
				y={CARD_HEIGHT / 2 - 8}
				anchor={{ x: 0.5, y: 0.5 }}
				text={suitGlyph(parsed.suit)}
				style={{
					fontFamily: 'proxima-nova',
					fontSize: REM * 3.2,
					fill: colourFill,
				}}
			/>
			<Text
				x={CARD_WIDTH / 2}
				y={CARD_HEIGHT - 28}
				anchor={{ x: 0.5, y: 0.5 }}
				text={stateGame.doubleUpColour.toUpperCase()}
				style={{
					fontFamily: 'proxima-nova',
					fontSize: REM * 0.85,
					fontWeight: '700',
					fill: colourFill,
				}}
			/>
		{:else if stateGame.doubleUpRevealing}
			<Text
				x={CARD_WIDTH / 2}
				y={CARD_HEIGHT / 2}
				anchor={{ x: 0.5, y: 0.5 }}
				text="…"
				style={{
					fontFamily: 'proxima-nova',
					fontSize: REM * 1.4,
					fontWeight: '700',
					fill: 0xcbd5e1,
				}}
			/>
		{/if}
	</Container>

	{#if stateGame.doubleUpRevealed}
		<Text
			x={layout.width * 0.5}
			y={originY + CARD_HEIGHT + 28}
			anchor={{ x: 0.5, y: 0 }}
			text={stateGame.doubleUpCorrect
				? `SURVIVED  ·  win doubles to ${formatMultiplier(stateGame.doubleUpAmountAfter)}`
				: 'MISS  ·  win goes to 0'}
			style={{
				fontFamily: 'proxima-nova',
				fontSize: REM * 1.2,
				fontWeight: '700',
				fill: stateGame.doubleUpCorrect ? 0xfacc15 : 0xf87171,
			}}
		/>
		{#if stateGame.doubleUpCorrect && stateGame.doubleUpStep >= (stateGame.liveHold ? stateGame.doubleUpMaxSteps : DOUBLE_UP_MAX_CHAIN)}
			<Text
				x={layout.width * 0.5}
				y={originY + CARD_HEIGHT + 58}
				anchor={{ x: 0.5, y: 0 }}
				text={`Chain complete — settles at ${formatMultiplier(stateGame.doubleUpAmountAfter)}`}
				style={{
					fontFamily: 'proxima-nova',
					fontSize: REM * 0.8,
					fill: 0xe2e8f0,
				}}
			/>
		{/if}
	{:else if !stateGame.liveHold}
		<Text
			x={layout.width * 0.5}
			y={originY + CARD_HEIGHT + 28}
			anchor={{ x: 0.5, y: 0 }}
			text="Reveal continues the book. Colour is not a player choice."
			style={{
				fontFamily: 'proxima-nova',
				fontSize: REM * 0.75,
				fill: 0x94a3b8,
			}}
		/>
	{/if}
{/if}
