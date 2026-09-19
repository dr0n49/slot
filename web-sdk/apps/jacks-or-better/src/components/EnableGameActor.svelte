<script lang="ts">
	import { onMount } from 'svelte';

	import { stateBet } from 'state-shared';

	import { Text } from 'pixi-svelte';

	import { gameActor } from '../game/actor';
	import { resetBuyBetModeIfNeeded } from '../game/betModes';
	import { getContext } from '../game/context';
	import { ensureWalletReady, isLiveRoundStartable, runLiveBetRound } from '../game/liveWallet';
	import { stateGame } from '../game/stateGame.svelte';

	type Props = {
		debug?: boolean;
	};

	const props: Props = $props();
	const context = getContext();

	const runLiveBet = async () => {
		if (!stateGame.liveWalletEnabled) return;

		try {
			await ensureWalletReady();
		} catch (error) {
			console.error(error);
			return;
		}

		if (!isLiveRoundStartable()) return;

		try {
			await runLiveBetRound();
		} catch (error) {
			console.error(error);
		}
	};

	onMount(() => {
		const { unsubscribe } = gameActor.subscribe((snapshot) => {
			context.stateXstate.value = snapshot.value;
		});

		gameActor.start();
		gameActor.send({ type: 'RENDERED' });

		return () => {
			unsubscribe();
			gameActor.stop();
		};
	});

	context.eventEmitter.subscribeOnMount({
		bet: () => {
			if (stateGame.liveWalletEnabled) {
				void runLiveBet();
				return;
			}
			gameActor.send({ type: 'BET' });
		},
		autoBet: () => {
			if (stateGame.liveWalletEnabled) return;
			gameActor.send({ type: 'AUTO_BET' });
		},
		resumeBet: () => gameActor.send({ type: 'RESUME_BET' }),
		stopButtonEnable: () => resetBuyBetModeIfNeeded(),
	});
</script>

{#if props.debug}
	<Text
		x={context.stateLayoutDerived.canvasSizes().width}
		anchor={{ x: 1, y: 0 }}
		style={{ fill: 0xffffff }}
		text={JSON.stringify(context.stateXstate.value, undefined, 2)}
	/>
{/if}
