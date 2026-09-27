import { GAME } from '../config';

/**
 * One layout function shared by the Pixi scene and the DOM HUD, so the board and the HUD
 * always agree on where everything is. All numbers are "stage units": the stage is authored
 * in fixed design pixels and scaled uniformly to cover the viewport.
 */
export type StageLayout = {
	portrait: boolean;
	/** viewport px per stage unit */
	scale: number;
	stageW: number;
	stageH: number;
	topH: number;
	bottomH: number;
	board: { x: number; y: number; w: number; h: number; cell: number; pad: number };
	/** free space left/right of the board (landscape rails) */
	railW: number;
};

const DESIGN = {
	landscape: { w: 1280, h: 720 },
	portrait: { w: 540, h: 960 },
} as const;

export const computeLayout = (vw: number, vh: number): StageLayout => {
	const portrait = vh > vw;
	const d = portrait ? DESIGN.portrait : DESIGN.landscape;
	const scale = vw > 0 && vh > 0 ? Math.min(vw / d.w, vh / d.h) : 1;
	const stageW = vw > 0 ? vw / scale : d.w;
	const stageH = vh > 0 ? vh / scale : d.h;

	const topH = portrait ? 118 : 60;
	const bottomH = portrait ? 204 : 88;
	const pad = 12; // frame padding around the symbols
	const areaH = stageH - topH - bottomH;
	const railW = portrait ? 0 : Math.min(230, Math.max(150, (stageW - 700) / 2));
	const areaW = stageW - railW * 2;

	const cell = Math.max(
		40,
		Math.min(
			(areaH - pad * 2 - 8) / GAME.numRows,
			(areaW - pad * 2 - (portrait ? 16 : 40)) / GAME.numReels,
			portrait ? 112 : 124,
		),
	);
	const w = cell * GAME.numReels + pad * 2;
	const h = cell * GAME.numRows + pad * 2;
	const x = (stageW - w) / 2;
	const y = topH + (areaH - h) / 2;
	return { portrait, scale, stageW, stageH, topH, bottomH, board: { x, y, w, h, cell, pad }, railW };
};
