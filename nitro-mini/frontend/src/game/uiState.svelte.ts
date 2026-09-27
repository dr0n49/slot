import { computeLayout, type StageLayout } from './engine/layout';

/** Viewport-derived stage layout + dialog toggles shared by the HUD components. */
export const uiState = $state({
	viewportW: 0,
	viewportH: 0,
	infoOpen: false,
	buyOpen: false,
	infoTab: 'paytable' as 'paytable' | 'features' | 'rules',
});

export const stageLayout = (): StageLayout => computeLayout(uiState.viewportW, uiState.viewportH);
