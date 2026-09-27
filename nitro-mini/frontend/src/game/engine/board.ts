import { Container, Graphics, Sprite } from 'pixi.js';

import { GAME, SYMBOLS } from '../config';
import type { BookSymbol, Pos } from '../typesBookEvent';
import { sfx } from '../sfx';
import { Particles } from './particles';
import { SymbolView } from './symbolView';
import { textures } from './textures';
import { ease, run, scheduler, tween, wait } from './tween';

const REELS = GAME.numReels;
const ROWS = GAME.numRows;

/** fall, tiny dip below the floor, settle */
const land = (t: number) => {
	const k = 0.74;
	if (t < k) return Math.pow(t / k, 2);
	const u = (t - k) / (1 - k);
	return 1 + 0.045 * Math.sin(Math.PI * u);
};

const STRIP_SYMBOLS = [...SYMBOLS.paying, SYMBOLS.wild, SYMBOLS.keg, SYMBOLS.scatter, SYMBOLS.rock];

/** A column of fast scrolling symbols shown while the RGS request / reveal is pending. */
class ReelBlur extends Container {
	private items: Sprite[] = [];
	private cell = 100;
	speed = 0;
	private targetSpeed = 0;

	constructor() {
		super();
		for (let i = 0; i < ROWS + 3; i++) {
			const s = new Sprite();
			s.anchor.set(0.5);
			this.items.push(s);
			this.addChild(s);
		}
	}

	configure(cell: number) {
		this.cell = cell;
		this.items.forEach((s, i) => {
			s.x = cell / 2;
			s.y = (i - 1.5) * cell;
			this.retexture(s);
		});
	}

	private retexture(s: Sprite) {
		const name = STRIP_SYMBOLS[(Math.random() * STRIP_SYMBOLS.length) | 0];
		s.texture = textures.symbols[name];
		const k = (this.cell * 0.9) / 256;
		s.scale.set(k, k * 1.18);
		s.alpha = 0.82;
		s.tint = 0xcfcfd8;
	}

	setSpeed(v: number) {
		this.targetSpeed = v;
	}

	tick(dtMs: number) {
		const dt = dtMs / 1000;
		this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * 14);
		const total = this.items.length * this.cell;
		for (const s of this.items) {
			s.y += this.speed * dt;
			if (s.y > total - 1.5 * this.cell) {
				s.y -= total;
				this.retexture(s);
			}
		}
	}
}

export type BoardHooks = {
	onPresentationDone?: () => void;
};

export class Board extends Container {
	cell = 100;
	readonly particles: Particles;
	private symbolLayer = new Container();
	private blurLayer = new Container();
	private fxLayer = new Container();
	private maskG = new Graphics();
	private anticipationG: Graphics[] = [];
	/** padded [reel][row] symbol names (row 0 and ROWS+1 are hidden padding) */
	names: string[][] = [];
	views: (SymbolView | null)[][] = [];
	private blurs: (ReelBlur | null)[] = [];
	private spinning: boolean[] = [];
	spinStartedAt = 0;
	private spinReady: Promise<void> = Promise.resolve();

	constructor(particles: Particles) {
		super();
		this.particles = particles;
		this.sortableChildren = false;
		this.addChild(this.symbolLayer, this.blurLayer, this.fxLayer);
		this.addChild(this.maskG);
		this.symbolLayer.mask = this.maskG;
		this.blurLayer.mask = this.maskG;
		for (let c = 0; c < REELS; c++) {
			this.views.push(new Array(ROWS).fill(null));
			this.blurs.push(null);
			this.spinning.push(false);
			const g = new Graphics();
			g.alpha = 0;
			this.anticipationG.push(g);
			this.fxLayer.addChild(g);
		}
	}

	// ---- geometry ----------------------------------------------------------
	cx(col: number) {
		return this.cell * (col + 0.5);
	}
	cy(row: number) {
		return this.cell * (row + 0.5);
	}

	setCell(cell: number) {
		this.cell = cell;
		this.maskG.clear();
		this.maskG.rect(0, 0, cell * REELS, cell * ROWS).fill(0xffffff);
		for (let c = 0; c < REELS; c++) {
			const g = this.anticipationG[c];
			g.clear();
			g.roundRect(c * cell + 2, 2, cell - 4, cell * ROWS - 4, 10).stroke({ width: 4, color: 0xffb833, alpha: 1 });
			g.roundRect(c * cell + 2, 2, cell - 4, cell * ROWS - 4, 10).fill({ color: 0xffb833, alpha: 0.12 });
			const blur = this.blurs[c];
			if (blur) {
				blur.x = c * cell;
				blur.configure(cell);
			}
			for (let r = 0; r < ROWS; r++) {
				const v = this.views[c][r];
				if (v && !v.removed) {
					v.applySize(cell);
					v.position.set(this.cx(c), this.cy(r));
				}
			}
		}
	}

	/** Advance idle animations. */
	tick(dtMs: number) {
		for (let c = 0; c < REELS; c++) {
			this.blurs[c]?.tick(dtMs);
			for (let r = 0; r < ROWS; r++) {
				const v = this.views[c][r];
				if (v && v.isSpecial) v.tick(dtMs, this.particles);
			}
		}
	}

	// ---- view management -----------------------------------------------------
	private makeView(name: string, col: number, row: number, y?: number) {
		const v = new SymbolView();
		v.setSymbol(name, this.cell);
		v.col = col;
		v.row = row;
		v.position.set(this.cx(col), y ?? this.cy(row));
		this.symbolLayer.addChild(v);
		return v;
	}

	private destroyView(v: SymbolView | null) {
		if (!v) return;
		v.removed = true;
		v.parent?.removeChild(v);
		v.destroy({ children: true });
	}

	/** Instantly show a padded board (resume / fallback / error recovery). */
	setBoard(padded: BookSymbol[][]) {
		this.names = padded.map((col) => col.map((s) => s.name));
		for (let c = 0; c < REELS; c++) {
			this.stopBlur(c);
			for (let r = 0; r < ROWS; r++) {
				this.destroyView(this.views[c][r]);
				this.views[c][r] = this.makeView(this.names[c][r + 1], c, r);
			}
		}
	}

	/** Deterministic idle board shown before the first spin (visual only — never a game outcome). */
	showIdle() {
		const seed = [
			['L3', 'H4', 'L1', 'R', 'L5', 'H2'],
			['L2', 'L4', 'H1', 'L3', 'K', 'L1'],
			['H3', 'L5', 'L2', 'W', 'L4', 'H4'],
			['L1', 'S', 'L3', 'H2', 'L5', 'L2'],
			['L4', 'H3', 'R', 'L1', 'H1', 'L3'],
		];
		this.setBoard(
			seed.map((col) => [{ name: 'L1' }, ...col.map((name) => ({ name })), { name: 'L1' }]),
		);
	}

	clearAll() {
		for (let c = 0; c < REELS; c++) {
			this.stopBlur(c);
			for (let r = 0; r < ROWS; r++) {
				this.destroyView(this.views[c][r]);
				this.views[c][r] = null;
			}
		}
	}

	// ---- spinning ---------------------------------------------------------------
	private stopBlur(col: number) {
		const b = this.blurs[col];
		if (b) {
			b.parent?.removeChild(b);
			b.destroy({ children: true });
			this.blurs[col] = null;
		}
		this.spinning[col] = false;
	}

	get isSpinning() {
		return this.spinning.some(Boolean);
	}

	/** Drop the current symbols out of the bottom and start the reels scrolling. */
	startSpin(fast: boolean) {
		this.spinStartedAt = performance.now();
		const jobs: Promise<void>[] = [];
		for (let c = 0; c < REELS; c++) {
			this.spinning[c] = true;
			jobs.push(this.spinColumn(c, fast));
		}
		this.spinReady = Promise.all(jobs).then(() => undefined);
		return this.spinReady;
	}

	private async spinColumn(col: number, fast: boolean) {
		const stagger = fast ? 0 : col * 45;
		if (stagger) await wait(stagger);
		const views = this.views[col];
		const outs: Promise<void>[] = [];
		for (let r = ROWS - 1; r >= 0; r--) {
			const v = views[r];
			if (!v) continue;
			v.stopWin();
			const delay = (ROWS - 1 - r) * (fast ? 10 : 24);
			outs.push(
				tween(v, { y: v.y + this.cell * (ROWS + 1) }, fast ? 160 : 260, ease.inQuad, delay).then(() => {
					this.destroyView(v);
				}),
			);
			views[r] = null;
		}
		await Promise.all(outs);
		if (!this.spinning[col]) return; // stopped while leaving (skip / error)
		const blur = new ReelBlur();
		blur.x = col * this.cell;
		blur.configure(this.cell);
		blur.setSpeed(this.cell * (fast ? 22 : 15));
		this.blurLayer.addChild(blur);
		this.blurs[col] = blur;
	}

	/** Stop every reel on the given padded board with the classic left→right cascade. */
	async reveal(
		padded: BookSymbol[][],
		anticipation: number[],
		opts: { fast: boolean; minSpinMs: number },
	) {
		await this.spinReady;
		const elapsed = performance.now() - this.spinStartedAt;
		const remaining = opts.minSpinMs - elapsed;
		if (remaining > 0) await wait(remaining);
		this.names = padded.map((col) => col.map((s) => s.name));
		let scatterCount = 0;
		const jobs: Promise<void>[] = [];
		for (let c = 0; c < REELS; c++) {
			const anticipating = Boolean(anticipation?.[c]) && !opts.fast;
			if (anticipating) {
				this.setAnticipation(c, true);
				sfx.play('anticipation');
				await wait(900);
			}
			// scatters seen so far (visible rows only) — drives the ascending land pitch
			const visible = this.names[c].slice(1, ROWS + 1);
			const newScatters = visible.filter((n) => n === SYMBOLS.scatter).length;
			jobs.push(this.stopColumn(c, opts.fast, scatterCount, newScatters));
			scatterCount += newScatters;
			if (anticipating) this.setAnticipation(c, false);
			if (c < REELS - 1) await wait(opts.fast ? 0 : 130);
		}
		await Promise.all(jobs);
		for (let c = 0; c < REELS; c++) this.setAnticipation(c, false);
	}

	private setAnticipation(col: number, on: boolean) {
		const g = this.anticipationG[col];
		void tween(g, { alpha: on ? 1 : 0 }, on ? 160 : 260, ease.outQuad);
	}

	private async stopColumn(col: number, fast: boolean, scattersBefore: number, scattersHere: number) {
		this.stopBlur(col);
		const rows = this.names[col];
		const dur = fast ? 170 : 390;
		const fall = this.cell * (ROWS + 1);
		const jobs: Promise<void>[] = [];
		const created: SymbolView[] = [];
		for (let r = 0; r < ROWS; r++) {
			const v = this.makeView(rows[r + 1], col, r, this.cy(r) - fall);
			this.views[col][r] = v;
			created.push(v);
			const delay = (ROWS - 1 - r) * (fast ? 6 : 16);
			const startY = v.y;
			const endY = this.cy(r);
			jobs.push(
				run(
					dur,
					(p) => {
						// the view can be destroyed under us (tumble, skip, recovery): stop quietly
						if (v.removed || v.destroyed) return;
						v.y = startY + (endY - startY) * land(p);
					},
					delay,
				),
			);
		}
		sfx.reelStop(col);
		await Promise.all(jobs);
		let scatterIdx = scattersBefore;
		for (let r = 0; r < ROWS; r++) {
			const v = created[r];
			if (!v || v.removed) continue;
			if (v.symbol === SYMBOLS.scatter) {
				sfx.scatterLand(scatterIdx++);
				this.particles.burst(v.x, v.y, { count: 10, colors: [0xff5a3c, 0xffd27a], speed: 220 });
				void v.pop();
			} else if (v.symbol === SYMBOLS.keg) {
				sfx.play('symbol_land');
				void v.land(1.3);
			} else if (v.symbol === SYMBOLS.wild) {
				this.particles.burst(v.x, v.y, { count: 8, colors: [0xffe680, 0xffffff] });
				void v.pop();
			} else if (!fast && r === ROWS - 1) {
				void v.land(0.7);
			}
		}
		void scattersHere;
	}

	// ---- wins ----------------------------------------------------------------------
	private viewAt(p: Pos): SymbolView | null {
		return this.views[p.reel]?.[p.row - 1] ?? null;
	}

	positionsToViews(ps: Pos[]) {
		return ps.map((p) => this.viewAt(p)).filter((v): v is SymbolView => !!v && !v.removed);
	}

	highlight(ps: Pos[]) {
		for (const v of this.positionsToViews(ps)) v.startWin();
	}

	clearHighlights() {
		for (const col of this.views) for (const v of col) v?.stopWin();
	}

	/** centre of a group of positions in board-local coordinates */
	centroid(ps: Pos[]) {
		if (ps.length === 0) return { x: this.cx(2), y: this.cy(3) };
		let x = 0;
		let y = 0;
		for (const p of ps) {
			x += this.cx(p.reel);
			y += this.cy(p.row - 1);
		}
		return { x: x / ps.length, y: y / ps.length };
	}

	/** Remove the given padded positions with the pop animation (kegs get the big blast). */
	async explode(ps: Pos[], opts: { fast: boolean }) {
		const jobs: Promise<void>[] = [];
		let i = 0;
		for (const p of ps) {
			const v = this.viewAt(p);
			if (!v || v.removed) continue;
			const tone = v.symbol === SYMBOLS.keg ? 'keg' : 'normal';
			const delay = opts.fast ? 0 : (i++ % 6) * 22;
			jobs.push(wait(delay).then(() => v.explode(this.particles, tone)));
			if (!opts.fast) sfx.play('symbol_pop');
		}
		await Promise.all(jobs);
		for (const p of ps) {
			const v = this.viewAt(p);
			if (v) {
				this.destroyView(v);
				this.views[p.reel][p.row - 1] = null;
			}
		}
	}

	/**
	 * Gravity + refill exactly like the math engine:
	 * new padded column = newSymbols[reel] ++ (old padded column minus exploded rows).
	 */
	async tumble(newSymbols: BookSymbol[][], exploding: Pos[], opts: { fast: boolean }) {
		const jobs: Promise<void>[] = [];
		let anyDrop = false;
		for (let c = 0; c < REELS; c++) {
			const explodedRows = new Set(exploding.filter((p) => p.reel === c).map((p) => p.row));
			const n = explodedRows.size;
			const incoming = (newSymbols[c] ?? []).map((s) => s.name);
			const oldNames = this.names[c];
			const nextNames = incoming.concat(oldNames.filter((_, row) => !explodedRows.has(row)));
			if (nextNames.length !== GAME.paddedRows) {
				throw new Error(`tumble produced ${nextNames.length} rows on reel ${c}`);
			}
			this.names[c] = nextNames;
			if (n === 0) continue;
			anyDrop = true;

			// survivors (visible only) keep their views and fall to their new row
			const oldViews = this.views[c];
			const survivors: { view: SymbolView; from: number }[] = [];
			for (let r = 0; r < ROWS; r++) {
				if (!explodedRows.has(r + 1) && oldViews[r]) survivors.push({ view: oldViews[r]!, from: r });
			}
			const nextViews: (SymbolView | null)[] = new Array(ROWS).fill(null);
			const newCount = ROWS - survivors.length; // rows filled by new/top-pad symbols
			survivors.forEach((s, idx) => {
				const to = newCount + idx;
				nextViews[to] = s.view;
				s.view.row = to;
				const dist = to - s.from;
				if (dist > 0) jobs.push(this.fall(s.view, this.cy(to), dist, opts.fast, c));
			});
			for (let j = 0; j < newCount; j++) {
				const v = this.makeView(nextNames[j + 1], c, j, this.cy(j) - this.cell * (newCount + 0.4));
				nextViews[j] = v;
				jobs.push(this.fall(v, this.cy(j), newCount + 0.4, opts.fast, c));
			}
			this.views[c] = nextViews;
		}
		if (anyDrop && !opts.fast) sfx.play('cascade_drop');
		await Promise.all(jobs);
		if (anyDrop) {
			for (let c = 0; c < REELS; c++) {
				const v = this.views[c][ROWS - 1];
				if (v && !opts.fast) void v.land(0.55);
			}
		}
	}

	private fall(v: SymbolView, toY: number, rows: number, fast: boolean, col: number) {
		const startY = v.y;
		const dur = (fast ? 130 : 210) + rows * (fast ? 35 : 70);
		return run(
			Math.min(dur, fast ? 320 : 620),
			(p) => {
				// same here: a falling symbol may be removed before it lands
				if (v.removed || v.destroyed) return;
				v.y = startY + (toY - startY) * land(p);
			},
			fast ? 0 : col * 28,
		);
	}

	/** Sound-less nudge used when a scatter trigger presents. */
	async pulseSymbols(symbol: string) {
		const jobs: Promise<void>[] = [];
		for (const col of this.views) {
			for (const v of col) {
				if (v && v.symbol === symbol) {
					jobs.push(v.pop());
					this.particles.burst(v.x, v.y, { count: 12, colors: [0xff5a3c, 0xffd27a, 0xffffff], speed: 300 });
				}
			}
		}
		await Promise.all(jobs);
	}

	countSymbol(name: string) {
		let n = 0;
		for (const col of this.names) for (let r = 1; r <= ROWS; r++) if (col[r] === name) n++;
		return n;
	}

	kegPositions(): Pos[] {
		const out: Pos[] = [];
		this.names.forEach((col, reel) => {
			for (let r = 1; r <= ROWS; r++) if (col[r] === SYMBOLS.keg) out.push({ reel, row: r });
		});
		return out;
	}

	/** Stop everything that is mid-flight (used on recovery). */
	halt() {
		scheduler.cancelAll();
		for (let c = 0; c < REELS; c++) this.setAnticipation(c, false);
	}
}
