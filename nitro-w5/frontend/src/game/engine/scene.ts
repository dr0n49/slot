import { Application, Container, Graphics, Sprite } from 'pixi.js';

import { Board } from './board';
import { computeLayout, type StageLayout } from './layout';
import { Particles } from './particles';
import { perf } from './perf';
import { loadTextures, textures } from './textures';
import { ease, run, scheduler, tween } from './tween';

/**
 * The Pixi presentation layer: background, board frame, symbols, particles.
 * It is purely visual — book events tell it what to show (see bookEventHandlerMap.ts).
 */
export class Scene {
	app!: Application;
	world = new Container();
	bgLayer = new Container();
	bgSprite = new Sprite();
	bgFallback = new Graphics();
	frame = new Graphics();
	board!: Board;
	boardParticles = new Particles();
	stageParticles = new Particles(); // ambient + big-win effects, full stage
	featureTint = new Graphics();
	flashG = new Graphics();
	layout!: StageLayout;
	private host!: HTMLElement;
	private resizeObserver?: ResizeObserver;
	private dustAcc = 0;
	private visibilityTimer: ReturnType<typeof setInterval> | null = null;
	private destroyed = false;
	private shakeToken = 0;
	private featureOn = false;

	static async create(host: HTMLElement, onProgress?: (p: number) => void) {
		const scene = new Scene();
		await scene.init(host, onProgress);
		return scene;
	}

	private async init(host: HTMLElement, onProgress?: (p: number) => void) {
		this.host = host;
		await loadTextures(onProgress);
		const app = new Application();
		await app.init({
			width: Math.max(1, host.clientWidth),
			height: Math.max(1, host.clientHeight),
			background: 0x0b0710,
			antialias: perf.tier !== 'low',
			resolution: perf.dpr,
			autoDensity: true,
			preference: 'webgl',
			powerPreference: 'high-performance',
		});
		this.app = app;
		host.appendChild(app.canvas);
		app.canvas.style.display = 'block';
		app.canvas.style.width = '100%';
		app.canvas.style.height = '100%';
		app.canvas.style.touchAction = 'manipulation';

		this.bgLayer.addChild(this.bgFallback, this.bgSprite);
		if (textures.background) this.bgSprite.texture = textures.background;
		this.bgSprite.anchor.set(0.5);

		this.featureTint.alpha = 0;
		this.board = new Board(this.boardParticles);
		this.board.addChild(this.boardParticles.container);
		this.world.addChild(this.stageParticles.container, this.frame, this.board, this.featureTint, this.flashG);
		this.flashG.alpha = 0;
		this.flashG.eventMode = 'none';
		app.stage.addChild(this.bgLayer, this.world);

		this.applySize();
		this.board.showIdle();

		app.ticker.add((t) => this.simulate(Math.min(t.deltaMS, 64)));

		this.resizeObserver = new ResizeObserver(() => this.applySize());
		this.resizeObserver.observe(host);

		// A hidden tab stops requestAnimationFrame; keep presentations moving so a round can never
		// stall on an animation that no one is watching.
		document.addEventListener('visibilitychange', this.onVisibility);
		this.onVisibility();
	}

	private onVisibility = () => {
		if (document.hidden) {
			if (!this.visibilityTimer) {
				this.visibilityTimer = setInterval(() => {
					scheduler.step(1e9);
				}, 250);
			}
		} else if (this.visibilityTimer) {
			clearInterval(this.visibilityTimer);
			this.visibilityTimer = null;
		}
	};

	applySize() {
		if (this.destroyed || !this.app) return;
		const w = Math.max(1, this.host.clientWidth);
		const h = Math.max(1, this.host.clientHeight);
		this.app.renderer.resize(w, h);
		const L = computeLayout(w, h);
		this.layout = L;
		this.world.scale.set(L.scale);
		this.world.position.set(0, 0);

		// background: cover
		this.bgFallback.clear().rect(0, 0, w, h).fill(0x140d1c);
		const tex = textures.background;
		if (tex) {
			const k = Math.max(w / tex.width, h / tex.height);
			this.bgSprite.scale.set(k);
			this.bgSprite.position.set(w / 2, h / 2);
			this.bgSprite.visible = true;
		} else {
			this.bgSprite.visible = false;
		}

		// feature tint + flash cover the whole stage
		this.featureTint.clear().rect(0, 0, L.stageW, L.stageH).fill({ color: 0xff3a10, alpha: 0.22 });
		this.flashG.clear().rect(0, 0, L.stageW, L.stageH).fill(0xffffff);

		// board
		const { board } = L;
		this.board.position.set(board.x + board.pad, board.y + board.pad);
		this.board.setCell(board.cell);
		this.drawFrame();
	}

	private drawFrame() {
		const { board: b } = this.layout;
		const g = this.frame;
		g.clear();
		const r = 18;
		// outer wooden/iron frame
		g.roundRect(b.x - 10, b.y - 10, b.w + 20, b.h + 20, r + 6).fill(0x1a1018);
		g.roundRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16, r + 4).fill(0x3a2410);
		g.roundRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10, r + 2).fill(0xb8860b);
		g.roundRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6, r + 1).fill(0xffd54a);
		g.roundRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, r).fill(0x241528);
		// inner panel
		g.roundRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, r - 4).fill({ color: 0x0c0712, alpha: 0.94 });
		// column separators + faint checker
		const px = b.x + b.pad;
		const py = b.y + b.pad;
		for (let c = 0; c < 5; c++) {
			if (c % 2 === 0) g.rect(px + c * b.cell, py, b.cell, b.cell * 6).fill({ color: 0xffffff, alpha: 0.025 });
		}
		for (let c = 1; c < 5; c++) {
			g.rect(px + c * b.cell - 1, py + 4, 2, b.cell * 6 - 8).fill({ color: 0xffd54a, alpha: 0.1 });
		}
		// rivets
		for (const [ix, iy] of [
			[b.x + 4, b.y + 4],
			[b.x + b.w - 4, b.y + 4],
			[b.x + 4, b.y + b.h - 4],
			[b.x + b.w - 4, b.y + b.h - 4],
		]) {
			g.circle(ix, iy, 3).fill(0xfff3a0);
		}
	}

	/** One simulation step (tweens, symbol loops, particles). Render is done by the pixi ticker. */
	private simulate(dt: number) {
		scheduler.step(dt);
		this.board.tick(dt);
		this.boardParticles.update(dt);
		this.stageParticles.update(dt);
		this.ambient(dt);
	}

	/**
	 * Test hook: advance the simulation by `ms` of virtual time in fixed steps. Used by the automated
	 * visual tests (software-rendered CI browsers run at ~1 fps, which would stretch every animation).
	 */
	async advance(ms: number, step = 16) {
		this.app.ticker.stop();
		for (let t = 0; t < ms; t += step) {
			this.simulate(step);
			await new Promise<void>((r) => setTimeout(r, 0));
		}
		this.app.render();
	}

	private ambient(dt: number) {
		if (perf.tier === 'low') return;
		this.dustAcc += dt;
		if (this.dustAcc < 380) return;
		this.dustAcc = 0;
		const L = this.layout;
		this.stageParticles.emit({
			tex: textures.dust,
			x: Math.random() * L.stageW,
			y: L.stageH * (0.4 + Math.random() * 0.6),
			vx: (Math.random() - 0.5) * 16,
			vy: -14 - Math.random() * 18,
			life: 5200,
			s0: 0.12 + Math.random() * 0.22,
			s1: 0.05,
			a0: 0,
			a1: 0,
			tint: 0xffd9a0,
		});
	}

	// ---- helpers used by the book event handlers -------------------------------
	/** stage coordinates (design units) of a board cell centre */
	cellToStage(col: number, row: number) {
		const b = this.layout.board;
		return { x: b.x + b.pad + this.board.cx(col), y: b.y + b.pad + this.board.cy(row) };
	}

	shake(amp = 6, ms = 320) {
		const token = ++this.shakeToken;
		return run(ms, (p) => {
			if (token !== this.shakeToken && p < 1) return;
			const k = (1 - p) * amp;
			this.world.position.set((Math.random() - 0.5) * 2 * k * this.layout.scale, (Math.random() - 0.5) * 2 * k * this.layout.scale);
			if (p >= 1) this.world.position.set(0, 0);
		});
	}

	async flash(color = 0xffffff, alpha = 0.5, ms = 380) {
		this.flashG.tint = color;
		this.flashG.alpha = alpha;
		await tween(this.flashG, { alpha: 0 }, ms, ease.outQuad);
	}

	setFeatureMode(on: boolean) {
		if (on === this.featureOn) return Promise.resolve();
		this.featureOn = on;
		return tween(this.featureTint, { alpha: on ? 1 : 0 }, 700, ease.inOutQuad);
	}

	/** Coins pouring from the top of the stage — big-win effect. */
	coinRain(intensity = 1) {
		const L = this.layout;
		const n = Math.round(14 * intensity * perf.burstScale);
		for (let i = 0; i < n; i++) {
			this.stageParticles.coin(Math.random() * L.stageW, -20 - Math.random() * 60, (Math.random() - 0.5) * 120, 80 + Math.random() * 160);
		}
	}

	fireworks(intensity = 1) {
		const L = this.layout;
		const cx = L.stageW * (0.2 + Math.random() * 0.6);
		const cy = L.stageH * (0.2 + Math.random() * 0.35);
		const colors = [[0xffe680, 0xffb833], [0x6ad8ff, 0xffffff], [0xff6a8a, 0xffd0dc], [0xb56cff, 0xffffff]][(Math.random() * 4) | 0];
		this.stageParticles.burst(cx, cy, { count: Math.round(38 * intensity), colors, speed: 380, life: 900, size: 0.7, gravity: 260 });
		this.stageParticles.shockwave(cx, cy, 1.2, colors[0], 700);
	}

	destroy() {
		this.destroyed = true;
		document.removeEventListener('visibilitychange', this.onVisibility);
		if (this.visibilityTimer) clearInterval(this.visibilityTimer);
		this.resizeObserver?.disconnect();
		scheduler.cancelAll();
		this.app?.destroy({ removeView: true }, { children: true });
	}
}

let current: Scene | null = null;
export const setScene = (s: Scene | null) => (current = s);
export const getScene = () => current;
