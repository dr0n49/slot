<script lang="ts">
	import { onMount } from 'svelte';

	import { gameActor } from '../game/actor';
	import { resetBuyBetModeIfNeeded } from '../game/betModes';
	import { getContext } from '../game/context';
	import { stateGame } from '../game/stateGame.svelte';

	const context = getContext();

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
			// one round at a time: the bet machine only accepts BET while idle, the phase guard
			// additionally refuses a spin while a presentation is still running
			if (stateGame.phase !== 'IDLE') return;
			gameActor.send({ type: 'BET' });
		},
		autoBet: () => {
			if (stateGame.phase !== 'IDLE') return;
			gameActor.send({ type: 'AUTO_BET' });
		},
		resumeBet: () => gameActor.send({ type: 'RESUME_BET' }),
		stopButtonEnable: () => resetBuyBetModeIfNeeded(),
	});
</script>
