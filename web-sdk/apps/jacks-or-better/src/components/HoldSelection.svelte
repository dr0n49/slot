<script lang="ts" module>
	export type EmitterEventHoldSelection =
		| { type: 'holdSelectionDeal' }
		| { type: 'holdSelectionDrawDone' }
		| { type: 'holdSelectionHandResult' };
</script>

<script lang="ts">
	import { Container, Rectangle, Text, REM } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import {
		CARD_GAP,
		CARD_HEIGHT,
		CARD_WIDTH,
		HAND_SIZE,
		LIVE_CARD_BACK,
		liveHoldCardOriginY,
		parseCard,
		rankLabel,
		suitGlyph,
	} from '../game/constants';
	import { stateGame } from '../game/stateGame.svelte';

	const context = getContext();
	const layout = $derived(context.stateLayoutDerived.mainLayout());
	const handWidth = HAND_SIZE * CARD_WIDTH + (HAND_SIZE - 1) * CARD_GAP;
	const originX = $derived(layout.width * 0.5 - handWidth / 2);
	const liveHold = $derived(stateGame.liveHold && stateGame.awaitingPlayerHold);
	const liveLayout = $derived(stateGame.liveWalletEnabled);
	const originY = $derived(
		liveLayout
			? liveHoldCardOriginY(layout.height)
			: layout.height * 0.5 - CARD_HEIGHT / 2 - 40,
	);
	const showCardBacks = $derived(liveLayout && stateGame.cards.length === 0);

	const toggleHold = (index: number) => {
		if (!stateGame.liveHold || !stateGame.awaitingPlayerHold) return;
		const nextHeld = !stateGame.cards[index].held;
		stateGame.cards[index] = { ...stateGame.cards[index], held: nextHeld };
		stateGame.holdMask = stateGame.cards.reduce(
			(mask, card, i) => (card.held ? mask | (1 << i) : mask),
			0,
		);
		stateGame.showHolds = true;
	};

	context.eventEmitter.subscribeOnMount({
		holdSelectionDeal: () => {},
		holdSelectionDrawDone: () => {},
		holdSelectionHandResult: () => {},
	});
</script>

<Rectangle
	width={layout.width}
	height={layout.height}
	backgroundColor={0x0b1220}
	eventMode="none"
/>

<Container x={originX} y={originY} eventMode={liveHold ? 'static' : 'none'}>
	{#if showCardBacks}
		{#each Array(HAND_SIZE) as _, index (index)}
			{@const x = index * (CARD_WIDTH + CARD_GAP)}
			<Container {x} eventMode="none">
				<Rectangle
					width={CARD_WIDTH}
					height={CARD_HEIGHT}
					borderRadius={12}
					backgroundColor={LIVE_CARD_BACK}
					borderColor={0x93c5fd}
					borderWidth={3}
					eventMode="none"
				/>
				<Text
					x={CARD_WIDTH / 2}
					y={CARD_HEIGHT / 2}
					anchor={{ x: 0.5, y: 0.5 }}
					text="JOB"
					style={{
						fontFamily: 'proxima-nova',
						fontSize: REM * 1.1,
						fontWeight: '700',
						fill: 0xffffff,
					}}
				/>
			</Container>
		{/each}
	{:else}
	{#each stateGame.cards as card, index (index)}
		{@const parsed = parseCard(card.code)}
		{@const x = index * (CARD_WIDTH + CARD_GAP)}
		{@const colour = parsed.colour === 'red' ? 0xb42318 : 0x111827}
		{@const face = card.drawing ? 0x1e3a5f : 0xf8fafc}
		<Container
			{x}
			y={card.drawing ? -18 : 0}
			eventMode={liveHold ? 'static' : 'none'}
			cursor={liveHold ? 'pointer' : 'default'}
			onpointertap={() => toggleHold(index)}
		>
			<Rectangle
				width={CARD_WIDTH}
				height={CARD_HEIGHT}
				borderRadius={12}
				backgroundColor={face}
				borderColor={card.held && stateGame.showHolds ? 0xd4a017 : 0xcbd5e1}
				borderWidth={card.held && stateGame.showHolds ? 5 : 2}
				eventMode={liveHold ? 'static' : 'none'}
			/>
			{#if !card.drawing}
			<Text
				x={16}
				y={16}
				text={`${rankLabel(parsed.rank)}${suitGlyph(parsed.suit)}`}
				style={{
					fontFamily: 'proxima-nova',
					fontSize: REM * 1.6,
					fontWeight: '700',
					fill: colour,
				}}
			/>
			<Text
				x={CARD_WIDTH / 2}
				y={CARD_HEIGHT / 2 + 8}
				anchor={{ x: 0.5, y: 0.5 }}
				text={suitGlyph(parsed.suit)}
				style={{
					fontFamily: 'proxima-nova',
					fontSize: REM * 3.2,
					fill: colour,
				}}
			/>
			{/if}
			{#if stateGame.showHolds && card.held}
				<Rectangle
					y={CARD_HEIGHT - 36}
					width={CARD_WIDTH}
					height={36}
					backgroundColor={0xd4a017}
				/>
				<Text
					x={CARD_WIDTH / 2}
					y={CARD_HEIGHT - 18}
					anchor={{ x: 0.5, y: 0.5 }}
					text="HELD"
					style={{
						fontFamily: 'proxima-nova',
						fontSize: REM * 0.85,
						fontWeight: '700',
						fill: 0x111827,
					}}
				/>
			{/if}
		</Container>
	{/each}
	{/if}
</Container>

{#if stateGame.sourceLabel && !liveLayout}
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

{#if stateGame.liveHold && !liveLayout}
	<Text
		x={layout.width * 0.5}
		y={originY - 28}
		anchor={{ x: 0.5, y: 1 }}
		text={stateGame.awaitingPlayerHold
			? 'Click cards to hold — LOCAL DEV wallet, not Engine'
			: 'Hold submitted to local wallet — not a frozen book'}
		style={{
			fontFamily: 'proxima-nova',
			fontSize: REM * 0.75,
			fill: 0xfbbf24,
		}}
	/>
{:else if stateGame.showHolds && !stateGame.liveWalletEnabled}
	<Text
		x={layout.width * 0.5}
		y={originY - 28}
		anchor={{ x: 0.5, y: 1 }}
		text="Hold is pre-selected by the book — not a player choice"
		style={{
			fontFamily: 'proxima-nova',
			fontSize: REM * 0.75,
			fill: 0xe2e8f0,
		}}
	/>
{/if}

{#if stateGame.handCategory && !(stateGame.liveWalletEnabled && stateGame.handAmount <= 0)}
	<Text
		x={layout.width * 0.5}
		y={originY + CARD_HEIGHT + 28}
		anchor={{ x: 0.5, y: 0 }}
		text={`${stateGame.handCategory}  ·  ${(stateGame.handAmount / 100).toFixed(stateGame.handAmount % 100 === 0 ? 0 : 2)}×`}
		style={{
			fontFamily: 'proxima-nova',
			fontSize: REM * 1.4,
			fontWeight: '700',
			fill: stateGame.handAmount > 0 ? 0xfacc15 : 0x94a3b8,
		}}
	/>
{/if}
