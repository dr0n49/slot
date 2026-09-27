import { Assets, Texture } from 'pixi.js';

import { SYMBOL_ASSETS, symbolUrl, backgroundUrl } from '../assets';

export const textures = {
	symbols: {} as Record<string, Texture>,
	background: null as Texture | null,
	glow: null as unknown as Texture,
	spark: null as unknown as Texture,
	ring: null as unknown as Texture,
	smoke: null as unknown as Texture,
	coin: null as unknown as Texture,
	ray: null as unknown as Texture,
	dust: null as unknown as Texture,
};

const canvas = (w: number, h: number) => {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	return c;
};

const radial = (size: number, stops: [number, string][]) => {
	const c = canvas(size, size);
	const g = c.getContext('2d')!;
	const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	for (const [o, col] of stops) grad.addColorStop(o, col);
	g.fillStyle = grad;
	g.fillRect(0, 0, size, size);
	return Texture.from(c);
};

const makeGenerated = () => {
	textures.glow = radial(128, [
		[0, 'rgba(255,255,255,1)'],
		[0.35, 'rgba(255,255,255,0.45)'],
		[1, 'rgba(255,255,255,0)'],
	]);
	textures.dust = radial(32, [
		[0, 'rgba(255,255,255,0.9)'],
		[1, 'rgba(255,255,255,0)'],
	]);
	textures.smoke = radial(96, [
		[0, 'rgba(255,255,255,0.55)'],
		[0.6, 'rgba(255,255,255,0.18)'],
		[1, 'rgba(255,255,255,0)'],
	]);

	// 4-point spark
	{
		const s = 64;
		const c = canvas(s, s);
		const g = c.getContext('2d')!;
		g.translate(s / 2, s / 2);
		const grad = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
		grad.addColorStop(0, 'rgba(255,255,255,1)');
		grad.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = grad;
		g.beginPath();
		g.moveTo(0, -s / 2);
		g.quadraticCurveTo(3, -3, s / 2, 0);
		g.quadraticCurveTo(3, 3, 0, s / 2);
		g.quadraticCurveTo(-3, 3, -s / 2, 0);
		g.quadraticCurveTo(-3, -3, 0, -s / 2);
		g.fill();
		textures.spark = Texture.from(c);
	}

	// ring (shockwave)
	{
		const s = 256;
		const c = canvas(s, s);
		const g = c.getContext('2d')!;
		const grad = g.createRadialGradient(s / 2, s / 2, s * 0.32, s / 2, s / 2, s / 2);
		grad.addColorStop(0, 'rgba(255,255,255,0)');
		grad.addColorStop(0.7, 'rgba(255,255,255,0.9)');
		grad.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = grad;
		g.fillRect(0, 0, s, s);
		textures.ring = Texture.from(c);
	}

	// gold coin
	{
		const s = 64;
		const c = canvas(s, s);
		const g = c.getContext('2d')!;
		const grad = g.createLinearGradient(0, 0, s, s);
		grad.addColorStop(0, '#fff3a0');
		grad.addColorStop(0.5, '#ffc933');
		grad.addColorStop(1, '#b8700a');
		g.fillStyle = grad;
		g.strokeStyle = '#7a4a00';
		g.lineWidth = 3;
		g.beginPath();
		g.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
		g.fill();
		g.stroke();
		g.strokeStyle = 'rgba(122,74,0,0.7)';
		g.lineWidth = 2;
		g.beginPath();
		g.arc(s / 2, s / 2, s / 2 - 12, 0, Math.PI * 2);
		g.stroke();
		g.fillStyle = 'rgba(255,255,255,0.55)';
		g.beginPath();
		g.ellipse(s * 0.38, s * 0.34, 8, 4, -0.6, 0, Math.PI * 2);
		g.fill();
		textures.coin = Texture.from(c);
	}

	// light ray (soft vertical wedge)
	{
		const w = 64;
		const h = 256;
		const c = canvas(w, h);
		const g = c.getContext('2d')!;
		const grad = g.createLinearGradient(0, h, 0, 0);
		grad.addColorStop(0, 'rgba(255,255,255,0.85)');
		grad.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = grad;
		g.beginPath();
		g.moveTo(w / 2 - 2, h);
		g.lineTo(w / 2 + 2, h);
		g.lineTo(w, 0);
		g.lineTo(0, 0);
		g.closePath();
		g.fill();
		textures.ray = Texture.from(c);
	}
};

let loading: Promise<void> | null = null;

/** Decode every image once. Rejects if a symbol image cannot be loaded (the caller shows an error). */
export const loadTextures = (onProgress?: (p: number) => void) => {
	if (loading) return loading;
	loading = (async () => {
		makeGenerated();
		const total = SYMBOL_ASSETS.length + 1;
		let done = 0;
		const tick = () => onProgress?.(++done / total);
		await Promise.all([
			...SYMBOL_ASSETS.map(async (name) => {
				textures.symbols[name] = await Assets.load<Texture>(symbolUrl(name));
				tick();
			}),
			(async () => {
				try {
					textures.background = await Assets.load<Texture>(backgroundUrl());
				} catch {
					textures.background = null; // scene falls back to a flat gradient
				}
				tick();
			})(),
		]);
	})();
	loading.catch(() => (loading = null));
	return loading;
};
