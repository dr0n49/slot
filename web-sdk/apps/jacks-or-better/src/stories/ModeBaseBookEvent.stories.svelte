<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'MODE_BASE/bookEvent',
	});
</script>

<script lang="ts">
	import {
		StoryGameTemplate,
		StoryLocale,
	} from 'components-storybook';

	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import { playBookEvent, playBookEvents } from '../game/utils';
	import { stateGame, stateGameDerived } from '../game/stateGame.svelte';
	import events from './data/mocked_hold_events';
	import doubleUpEvents from './data/mocked_double_up_events';
	import type { BookEvent } from '../game/typesBookEvent';

	setContext();
</script>

<Story name="deal_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				stateGameDerived.resetRound();
				stateGame.sourceLabel = 'MOCKED deal — not from generated books';
				await playBookEvent(events.deal as BookEvent, { bookEvents: [] });
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="hold_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				stateGameDerived.resetRound();
				stateGame.sourceLabel = 'MOCKED hold — not from generated books';
				await playBookEvents(events.holdWithDeal as BookEvent[]);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="draw_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				stateGameDerived.resetRound();
				stateGame.sourceLabel = 'MOCKED draw — not from generated books';
				await playBookEvents(events.jacksOrBetter as BookEvent[]);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="handResult_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				stateGameDerived.resetRound();
				stateGame.sourceLabel = 'MOCKED handResult — not from generated books';
				await playBookEvent(events.handResult as BookEvent, { bookEvents: [] });
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="doubleUp_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				stateGameDerived.resetRound();
				stateGame.sourceLabel = 'MOCKED doubleUp — not from generated books';
				await playBookEvents(doubleUpEvents.handResultThenDoubleUp as BookEvent[]);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>
