import { createLayout } from 'utils-layout';

export const { stateLayout, stateLayoutDerived } = createLayout({
	backgroundRatio: { normal: 16 / 9, portrait: 9 / 16 },
	mainSizesMap: {
		desktop: { width: 1280, height: 720 },
		tablet: { width: 1280, height: 960 },
		landscape: { width: 1280, height: 720 },
		portrait: { width: 540, height: 960 },
	},
});
