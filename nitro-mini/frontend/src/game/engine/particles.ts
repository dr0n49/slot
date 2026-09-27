import { Container, Sprite, type Texture } from 'pixi.js';

import { perf } from './perf';
import { textures } from './textures';

type Particle = {
	sprite: Sprite;
	alive: boolean;
	age: number;
	life: number;
	vx: number;
	vy: number;
	ax: number;
	ay: number;
	vr: number;
	s0: number;
	s1: number;
	a0: number;
	a1: number;
	drag: number;
	flip: boolean;
};

export type EmitOptions = {
	tex?: Texture;
	x: number;
	y: number;
	vx?: number;
	vy?: number;
	ax?: number;
	ay?: number;
	life?: number;
	s0?: number;
	s1?: number;
	a0?: number;
	a1?: number;
	rot?: number;
	vr?: number;
	tint?: number;
	add?: boolean;
	drag?: number;
	/** coin-style squash animation (scale.y oscillates) */
	flip?: boolean;
};

/** Pooled, capped sprite particle system. Everything additive unless asked otherwise. */
export class Particles {
	container = new Container();
	private pool: Particle[] = [];
	private active = 0;

	constructor() {
		this.container.eventMode = 'none';
	}

	get count() {
		return this.active;
	}

	private acquire(): Particle | null {
		if (this.active >= perf.maxParticles) return null;
		let p = this.pool.find((q) => !q.alive);
		if (!p) {
			const sprite = new Sprite();
			sprite.anchor.set(0.5);
			this.container.addChild(sprite);
			p = {
				sprite,
				alive: false,
				age: 0,
				life: 1,
				vx: 0,
				vy: 0,
				ax: 0,
				ay: 0,
				vr: 0,
				s0: 1,
				s1: 1,
				a0: 1,
				a1: 0,
				drag: 0,
				flip: false,
			};
			this.pool.push(p);
		}
		return p;
	}

	emit(o: EmitOptions) {
		const p = this.acquire();
		if (!p) return;
		p.alive = true;
		this.active++;
		p.age = 0;
		p.life = o.life ?? 600;
		p.vx = o.vx ?? 0;
		p.vy = o.vy ?? 0;
		p.ax = o.ax ?? 0;
		p.ay = o.ay ?? 0;
		p.vr = o.vr ?? 0;
		p.s0 = o.s0 ?? 1;
		p.s1 = o.s1 ?? 0;
		p.a0 = o.a0 ?? 1;
		p.a1 = o.a1 ?? 0;
		p.drag = o.drag ?? 0;
		p.flip = o.flip ?? false;
		const s = p.sprite;
		s.texture = o.tex ?? textures.spark;
		s.position.set(o.x, o.y);
		s.rotation = o.rot ?? 0;
		s.tint = o.tint ?? 0xffffff;
		s.blendMode = o.add === false ? 'normal' : 'add';
		s.scale.set(p.s0);
		s.alpha = p.a0;
		s.visible = true;
	}

	/** Radial burst of sparks (+ optional smoke). */
	burst(
		x: number,
		y: number,
		o: {
			count?: number;
			colors?: number[];
			speed?: number;
			life?: number;
			size?: number;
			gravity?: number;
			tex?: Texture;
			spread?: number;
			angle?: number;
		} = {},
	) {
		const n = Math.max(1, Math.round((o.count ?? 12) * perf.burstScale));
		const colors = o.colors ?? [0xffe680, 0xffb833, 0xff7a1a];
		const speed = o.speed ?? 260;
		const spread = o.spread ?? Math.PI * 2;
		const base = o.angle ?? 0;
		for (let i = 0; i < n; i++) {
			const a = base + (Math.random() - 0.5) * spread + (spread >= Math.PI * 2 ? Math.random() * 6.28 : 0);
			const v = speed * (0.4 + Math.random() * 0.8);
			this.emit({
				tex: o.tex ?? textures.spark,
				x,
				y,
				vx: Math.cos(a) * v,
				vy: Math.sin(a) * v,
				ay: o.gravity ?? 380,
				life: (o.life ?? 620) * (0.7 + Math.random() * 0.6),
				s0: (o.size ?? 0.5) * (0.6 + Math.random() * 0.8),
				s1: 0,
				rot: Math.random() * 6.28,
				vr: (Math.random() - 0.5) * 8,
				tint: colors[(Math.random() * colors.length) | 0],
				drag: 1.6,
			});
		}
	}

	smoke(x: number, y: number, count = 4, tint = 0x3a2a44) {
		const n = Math.max(1, Math.round(count * perf.burstScale));
		for (let i = 0; i < n; i++) {
			this.emit({
				tex: textures.smoke,
				x: x + (Math.random() - 0.5) * 30,
				y: y + (Math.random() - 0.5) * 30,
				vx: (Math.random() - 0.5) * 60,
				vy: -30 - Math.random() * 50,
				life: 800 + Math.random() * 500,
				s0: 0.5,
				s1: 1.7,
				a0: 0.55,
				a1: 0,
				tint,
				add: false,
				vr: (Math.random() - 0.5) * 1.5,
				drag: 0.8,
			});
		}
	}

	shockwave(x: number, y: number, size = 1, tint = 0xffd27a, life = 520) {
		this.emit({ tex: textures.ring, x, y, life, s0: 0.15 * size, s1: 1.9 * size, a0: 0.95, a1: 0, tint });
	}

	coin(x: number, y: number, vx: number, vy: number) {
		this.emit({
			tex: textures.coin,
			x,
			y,
			vx,
			vy,
			ay: 900,
			life: 1700 + Math.random() * 500,
			s0: 0.55 + Math.random() * 0.25,
			s1: 0.5,
			a0: 1,
			a1: 0.9,
			rot: Math.random() * 6,
			vr: (Math.random() - 0.5) * 10,
			add: false,
			flip: true,
		});
	}

	update(dtMs: number) {
		if (this.active === 0) return;
		const dt = Math.min(dtMs, 50) / 1000;
		for (const p of this.pool) {
			if (!p.alive) continue;
			p.age += dt * 1000;
			const t = p.age / p.life;
			if (t >= 1) {
				p.alive = false;
				p.sprite.visible = false;
				this.active--;
				continue;
			}
			if (p.drag) {
				const d = Math.max(0, 1 - p.drag * dt);
				p.vx *= d;
				p.vy *= d;
			}
			p.vx += p.ax * dt;
			p.vy += p.ay * dt;
			const s = p.sprite;
			s.x += p.vx * dt;
			s.y += p.vy * dt;
			s.rotation += p.vr * dt;
			const sc = p.s0 + (p.s1 - p.s0) * t;
			s.scale.set(sc, p.flip ? sc * Math.abs(Math.cos(p.age / 90)) : sc);
			s.alpha = p.a0 + (p.a1 - p.a0) * (t * t);
		}
	}

	clear() {
		for (const p of this.pool) {
			p.alive = false;
			p.sprite.visible = false;
		}
		this.active = 0;
	}
}
