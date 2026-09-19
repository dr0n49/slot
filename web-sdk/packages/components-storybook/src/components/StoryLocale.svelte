<script lang="ts">
	import { i18n } from '@lingui/core';
	import { type Snippet } from 'svelte';

	import { stateI18nDerived, type Language } from 'state-shared';

	type Props = {
		lang: Language;
		children: Snippet;
	};

	const props: Props = $props();

	// Init before first paint — onMount is too late for casino UI currency labels.
	stateI18nDerived.init(props.lang, {});
	i18n.load(props.lang, {});
	i18n.activate(props.lang);
</script>

{@render props.children()}
