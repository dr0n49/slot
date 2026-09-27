import { Container, Sprite } from 'pixi.js';

import { SYMBOLS } from '../config';
import { ease, run, tween, wait } from './tween';
import { textures } from './textures';
import type { Particles } from './particles';

const GLOW_TINT: Record<string, number> = {
	H1: 0xffd54a,
	H2: 0xc9d2e0,
	H3: 0xffd54a,
	H4: 0xc9d2e0,
	L1: 0xff4d6a,
	L2: 0xffaa33,
	L3: 0x3dff8a,
	L4: 0x4da3ff,
	L5: 0xb56cff,
	W: 0xffe680,
	S: 0xff5a3c,
	K: 0xff8a2a,
	R: 0xaab0c0,
};

export class SymbolView extends Container {
	name_ = '';
	col = 0;
	row = 0;
	private glow = new Sprite();
	private body = new Container();
	private sprite = new Sprite();
	private shine = new Sprite();
	private size = 100;
	private t = Math.random() * 10;
	private fuseAcc = 0;
	winning = false;
	removed = false;

	constructor() {
		super();
		this.glow.anchor.set(0.5);
		this.glow.blendMode = 'add';
		this.glow.alpha = 0;
		this.sprite.anchor.set(0.5);
		this.shine.anchor.set(0.5);
		this.shine.blendMode = 'add';
		this.shine.alpha = 0;
		this.body.addChild(this.sprite, this.shine);
		this.addChild(this.glow, this.body);
		this.eventMode = 'none';
	}

	get symbol() {
		return this.name_;
	}

	setSymbol(name: string, size: number) {
		this.name_ = name;
		this.size = size;
		this.sprite.texture = textures.symbols[name];
		this.shine.texture = textures.glow;
		this.glow.texture = textures.glow;
		this.glow.tint = GLOW_TINT[name] ?? 0xffffff;
		this.shine.tint = name === SYMBOLS.wild ? 0xfff0a0 : name === SYMBOLS.scatter ? 0xff9a6a : 0xffffff;
		this.applySize(size);
		this.body.scale.set(1);
		this.body.alpha = 1;
		this.body.rotation = 0;
		this.body.y = 0;
		this.winning = false;
		this.removed = false;
	}

	applySize(size: number) {
		this.size = size;
		const s = (size * 0.94) / 256;
		this.sprite.scale.set(s);
		this.glow.scale.set((size * 1.5) / 128);
		this.shine.scale.set((size * 0.9) / 128);
	}

	get isSpecial() {
		return this.name_ === SYMBOLS.keg || this.name_ === SYMBOLS.wild || this.name_ === SYMBOLS.scatter;
	}

	/** per-frame idle animation for the special symbols (cheap) */
	tick(dtMs: number, particles?: Particles) {
		if (this.removed || this.winning) return;
		this.t += dtMs / 1000;
		if (this.name_ === SYMBOLS.keg) {
			this.body.rotation = Math.sin(this.t * 3.2) * 0.035;
			this.fuseAcc += dtMs;
			if (particles && this.fuseAcc > 90) {
				this.fuseAcc = 0;
				const px = this.x + this.size * 0.2;
				const py = this.y - this.size * 0.42;
				particles.emit({
					x: px,
					y: py,
					vx: (Math.random() - 0.3) * 60,
					vy: -60 - Math.random() * 60,
					ay: 160,
					life: 380,
					s0: 0.28,
					s1: 0,
					tint: Math.random() > 0.5 ? 0xffd27a : 0xff6a1a,
				});
			}
		} else if (this.name_ === SYMBOLS.wild) {
			this.shine.alpha = 0.18 + 0.16 * Math.sin(this.t * 3);
			this.body.scale.set(1 + Math.sin(this.t * 2.2) * 0.02);
		} else if (this.name_ === SYMBOLS.scatter) {
			this.shine.alpha = 0.1 + 0.14 * Math.sin(this.t * 4);
			this.body.rotation = Math.sin(this.t * 2.6) * 0.05;
		}
	}

	// ---- one-shot animations -------------------------------------------------
	/** squash & stretch when a symbol lands */
	async land(strength = 1) {
		const b = this.body;
		await tween(b.scale, { x: 1 + 0.1 * strength, y: 1 - 0.13 * strength }, 70, ease.outQuad);
		await tween(b.scale, { x: 1, y: 1 }, 190, ease.outElastic);
	}

	/** pop for special symbols (scatter / keg / wild) */
	async pop() {
		await tween(this.body.scale, { x: 1.28, y: 1.28 }, 150, ease.outQuad);
		await tween(this.body.scale, { x: 1, y: 1 }, 240, ease.outBack);
	}

	/** looping win highlight; resolves never — call stopWin() */
	startWin() {
		if (this.winning) return;
		this.winning = true;
		const loop = () => {
			if (!this.winning || this.removed) return;
			const dur = 360;
			void Promise.all([
				tween(this.body.scale, { x: 1.14, y: 1.14 }, dur, ease.inOutQuad),
				tween(this.glow, { alpha: 0.85 }, dur, ease.outQuad),
				tween(this.body, { rotation: 0.05 }, dur, ease.inOutQuad),
			]).then(() =>
				Promise.all([
					tween(this.body.scale, { x: 1.0, y: 1.0 }, dur, ease.inOutQuad),
					tween(this.glow, { alpha: 0.45 }, dur, ease.inOutQuad),
					tween(this.body, { rotation: -0.05 }, dur, ease.inOutQuad),
				]).then(loop),
			);
		};
		loop();
	}

	stopWin() {
		this.winning = false;
	}

	async explode(particles: Particles, tone: 'normal' | 'keg' = 'normal') {
		this.winning = false;
		this.removed = true;
		const cx = this.x;
		const cy = this.y;
		const color = GLOW_TINT[this.name_] ?? 0xffffff;
		particles.burst(cx, cy, {
			count: tone === 'keg' ? 22 : 10,
			colors: [color, 0xffffff, 0xffd27a],
			speed: tone === 'keg' ? 420 : 260,
			size: tone === 'keg' ? 0.7 : 0.5,
		});
		if (tone === 'keg') particles.smoke(cx, cy, 5, 0x2a1a20);
		this.glow.alpha = 1;
		await Promise.all([
			tween(this.body.scale, { x: 1.35, y: 1.35 }, 110, ease.outQuad).then(() =>
				tween(this.body.scale, { x: 0.05, y: 0.05 }, 170, ease.inBack),
			),
			tween(this.body, { alpha: 0 }, 250, ease.inQuad, 60),
			tween(this.glow, { alpha: 0 }, 300, ease.linear),
		]);
	}

	/** small idle "breath" used while waiting */
	async shake(amp = 3, ms = 220) {
		await run(ms, (p) => {
			this.body.x = Math.sin(p * Math.PI * 8) * amp * (1 - p);
		});
		this.body.x = 0;
	}

	async flash() {
		await tween(this.glow, { alpha: 1 }, 90, ease.outQuad);
		await tween(this.glow, { alpha: 0 }, 260, ease.linear);
	}

	async wobble() {
		await wait(0);
	}
}
