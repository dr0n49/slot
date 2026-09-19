import { stateGame } from './stateGame.svelte';

/** Dev-only live-hold HUD chrome (?liveDebug=1 on the page URL). */
export const isLiveDevHudEnabled = (): boolean => {
	if (typeof window === 'undefined') return false;
	const hasFlag = (search: string) => new URLSearchParams(search).get('liveDebug') === '1';
	if (hasFlag(window.location.search)) return true;
	try {
		if (window.top && window.top !== window && hasFlag(window.top.location.search)) return true;
	} catch {
		// cross-origin parent
	}
	return false;
};

/** Casino shell: HTML UI (Stake Engine / ACP), not Pixi dev HUD. */
export const isCasinoShell = () =>
	stateGame.casinoUiEnabled && !isLiveDevHudEnabled();
