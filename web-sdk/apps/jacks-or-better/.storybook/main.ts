// https://github.com/storybookjs/storybook/issues/29567
import type { StorybookConfig } from '@storybook/sveltekit';

import { main as baseMain } from 'config-storybook';

const config: StorybookConfig = {
	...baseMain,
	// @storybook/addon-docs csf-tools parser conflicts with svelte-csf v5 snippet stories.
	addons: ['@storybook/addon-svelte-csf'],
};

export default config;
