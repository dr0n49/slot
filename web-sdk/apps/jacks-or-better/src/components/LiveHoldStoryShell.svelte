<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	import { getContext } from '../game/context';
	import { initLiveWalletBalance } from '../game/liveWallet';
	import { stateGame } from '../game/stateGame.svelte';

	type Props = {
		children: Snippet;
	};

	const props: Props = $props();
	const context = getContext();

	onMount(() => {
		context.stateLayout.showLoadingScreen = false;
		void initLiveWalletBalance();
	});

	// Enable casino shell before first paint (onMount is too late — Pixi collapses to 0×0).
	context.stateLayout.showLoadingScreen = false;
	stateGame.casinoUiEnabled = true;
	stateGame.liveWalletEnabled = true;
	stateGame.sourceLabel = 'LOCAL DEV WALLET — not Engine / not approval-ready';
</script>

{@render props.children()}
