<script lang="ts">
	import { stateBet } from 'state-shared';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';

	const context = getContext();

	onMount(() => {
		if (!stateBet.betToResume) return;
		if (stateBet.betToResume.active && stateBet.betToResume.mode) {
			stateBet.activeBetModeKey = stateBet.betToResume.mode;
		}
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	});
</script>
