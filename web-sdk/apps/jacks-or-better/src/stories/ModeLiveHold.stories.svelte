<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'MODE_LIVE/book',
		tags: ['!autodocs'],
	});
</script>

<script lang="ts">
	import { StoryLocale } from 'components-storybook';

	import Game from '../components/Game.svelte';
	import LiveHoldStoryShell from '../components/LiveHoldStoryShell.svelte';
	import { setContext } from '../game/context';

	setContext();
</script>

<Story name="liveHold_localWallet">
	{#snippet template()}
		<div class="story-shell">
			<LiveHoldStoryShell>
				<StoryLocale lang="en">
					<Game />
				</StoryLocale>
			</LiveHoldStoryShell>
		</div>
	{/snippet}
</Story>

<style>
	.story-shell {
		width: 100%;
		min-height: 100vh;
		height: 100vh;
		background: #001240;
	}
</style>
