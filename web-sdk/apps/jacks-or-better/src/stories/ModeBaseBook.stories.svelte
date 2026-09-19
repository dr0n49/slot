<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'MODE_BASE/book',
	});
</script>

<script lang="ts">
	import {
		StoryGameTemplate,
		StoryLocale,
	} from 'components-storybook';
	import { randomInteger } from 'utils-shared/random';

	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import { playBookEvents, playBet, toPlayableBet, convertTorResumableBet } from '../game/utils';
	import { stateGame, stateGameDerived } from '../game/stateGame.svelte';
	import events from './data/mocked_hold_events';
	import doubleUpEvents from './data/mocked_double_up_events';
	import {
		loss,
		missStage1,
		surviveBoth,
		royal3200,
		realBookList,
	} from './data/real_books';
	import type { BookEvent } from '../game/typesBookEvent';
	import type { RealBook } from './data/real_books';

	setContext();

	const playMocked = async (bookEvents: BookEvent[], label: string) => {
		stateGameDerived.resetRound();
		stateGame.sourceLabel = label;
		await playBookEvents(bookEvents);
	};

	const playReal = async (book: RealBook) => {
		stateGameDerived.resetRound();
		await playBet(toPlayableBet(book));
	};

	const playRealResume = async (book: RealBook, event: string) => {
		stateGameDerived.resetRound();
		const resumable = convertTorResumableBet(toPlayableBet(book, { event, active: true }));
		await playBet(resumable);
	};
</script>

<Story name="real_loss">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playReal(loss);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="real_missStage1">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playReal(missStage1);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="real_surviveBoth">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playReal(surviveBoth);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="real_royal3200">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playReal(royal3200);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="real_resume_royal_event4">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playRealResume(royal3200, '4');
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="real_random">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				const index = randomInteger({ min: 0, max: realBookList.length - 1 });
				const book = realBookList[index];
				console.log('Running generated book', book.id, 'payoutMultiplier', book.payoutMultiplier);
				await playReal(book);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="holdSelection_jacksOrBetter_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playMocked(
					events.jacksOrBetter as BookEvent[],
					'MOCKED — not from generated books: Jacks or Better',
				);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="holdSelection_fullHouse_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playMocked(
					events.fullHouse as BookEvent[],
					'MOCKED — not from generated books: Full House',
				);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="holdSelection_royalFlush_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playMocked(
					events.royalFlush as BookEvent[],
					'MOCKED — not from generated books: Royal Flush',
				);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="holdSelection_nothing_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playMocked(
					events.nothing as BookEvent[],
					'MOCKED — not from generated books: Nothing',
				);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="holdSelection_discardAll_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playMocked(
					events.discardAll as BookEvent[],
					'MOCKED — not from generated books: discard-all',
				);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="doubleUp_none_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playMocked(
					doubleUpEvents.none as BookEvent[],
					'MOCKED — not from generated books: 0 double-up events',
				);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="doubleUp_missStage1_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playMocked(
					doubleUpEvents.missStage1 as BookEvent[],
					'MOCKED — not from generated books: miss stage 1',
				);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>

<Story name="doubleUp_surviveBoth_MOCKED">
	{#snippet template()}
		<StoryGameTemplate
			skipLoadingScreen={true}
			action={async () => {
				await playMocked(
					doubleUpEvents.surviveBoth as BookEvent[],
					'MOCKED — not from generated books: Royal Flush → 3,200×',
				);
			}}
		>
			<StoryLocale lang="en">
				<Game />
			</StoryLocale>
		</StoryGameTemplate>
	{/snippet}
</Story>
