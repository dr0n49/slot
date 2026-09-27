/** Rough device tiering — decides DPR cap and particle budgets. */
export type PerfTier = 'low' | 'mid' | 'high';

const detect = (): PerfTier => {
	if (typeof navigator === 'undefined') return 'mid';
	const nav = navigator as Navigator & { deviceMemory?: number };
	const cores = nav.hardwareConcurrency ?? 4;
	const mem = nav.deviceMemory ?? 4;
	const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);
	if (mobile && (cores <= 4 || mem <= 3)) return 'low';
	if (mobile) return 'mid';
	if (cores <= 2 || mem <= 2) return 'low';
	return 'high';
};

export const perf = {
	tier: detect() as PerfTier,
	get dpr() {
		const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
		const cap = this.tier === 'low' ? 1.5 : this.tier === 'mid' ? 2 : 2;
		return Math.min(raw, cap);
	},
	/** Hard cap of simultaneously alive particles. */
	get maxParticles() {
		return this.tier === 'low' ? 90 : this.tier === 'mid' ? 200 : 380;
	},
	/** Multiplier applied to requested burst sizes. */
	get burstScale() {
		return this.tier === 'low' ? 0.45 : this.tier === 'mid' ? 0.75 : 1;
	},
};
