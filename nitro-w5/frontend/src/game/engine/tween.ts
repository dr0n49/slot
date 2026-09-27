/**
 * Tiny time-based scheduler used by the whole presentation layer.
 *  - `wait(ms)` and `tween(...)` return promises (the book event handlers `await` them);
 *  - `speed` scales time (turbo);
 *  - `skip` completes everything as fast as possible (player fast-forward / hidden tab), so a
 *    presentation can never dead-end waiting for an animation.
 */
export type Ease = (t: number) => number;

export const ease = {
	linear: (t: number) => t,
	inQuad: (t: number) => t * t,
	outQuad: (t: number) => 1 - (1 - t) * (1 - t),
	inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
	inCubic: (t: number) => t * t * t,
	outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
	inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
	outBack: (t: number) => {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
	},
	inBack: (t: number) => {
		const c1 = 1.70158;
		return (c1 + 1) * t * t * t - c1 * t * t;
	},
	outBounce: (t: number) => {
		const n1 = 7.5625;
		const d1 = 2.75;
		if (t < 1 / d1) return n1 * t * t;
		if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
		if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
		return n1 * (t -= 2.625 / d1) * t + 0.984375;
	},
	outElastic: (t: number) => {
		if (t === 0 || t === 1) return t;
		return Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1;
	},
} satisfies Record<string, Ease>;

type Job = {
	elapsed: number;
	duration: number;
	delay: number;
	update: (p: number) => void;
	resolve: () => void;
	done: boolean;
};

class Scheduler {
	private jobs: Job[] = [];
	speed = 1;
	skip = false;

	get pending() {
		return this.jobs.length;
	}

	/** Advance by `dtMs` of real time. */
	step(dtMs: number) {
		if (this.jobs.length === 0) return;
		const dt = this.skip ? 1e9 : dtMs * this.speed;
		// copy: resolving a job may enqueue new ones
		const jobs = this.jobs;
		this.jobs = [];
		const keep: Job[] = [];
		for (const job of jobs) {
			if (job.done) continue;
			job.elapsed += dt;
			const active = job.elapsed - job.delay;
			if (active >= 0) {
				const p = job.duration <= 0 ? 1 : Math.min(1, active / job.duration);
				// A single misbehaving job must never abort the loop: that would strand every other
				// pending job's promise and dead-end the presentation until the watchdog fires.
				// The failing job is dropped (resolved), the rest of the frame runs normally.
				try {
					job.update(p);
				} catch (error) {
					console.error('[nitro-vein] animation step failed; dropping it', error);
					job.done = true;
					job.resolve();
					continue;
				}
				if (p >= 1) {
					job.done = true;
					job.resolve();
					continue;
				}
			}
			keep.push(job);
		}
		this.jobs = keep.concat(this.jobs);
	}

	/** Finish every running job immediately (final values are applied). */
	finishAll() {
		for (let i = 0; i < 4 && this.jobs.length; i++) this.step(1e9);
	}

	cancelAll() {
		for (const job of this.jobs) {
			job.done = true;
			job.resolve();
		}
		this.jobs = [];
	}

	add(duration: number, update: (p: number) => void, delay = 0): Promise<void> {
		return new Promise<void>((resolve) => {
			this.jobs.push({ elapsed: 0, duration, delay, update, resolve, done: false });
		});
	}
}

export const scheduler = new Scheduler();

export const wait = (ms: number) => scheduler.add(ms, () => {});

type Numeric = Record<string, any>;

/** Tween numeric properties of `target` (supports `scale.x` style paths one level deep). */
export const tween = <T extends Numeric>(
	target: T,
	to: Partial<Record<string, number>>,
	ms: number,
	easing: Ease = ease.outCubic,
	delay = 0,
): Promise<void> => {
	const keys = Object.keys(to) as string[];
	let from: Record<string, number> | null = null;
	/**
	 * A tween can outlive the display object it animates: PixiJS nulls `scale` (and friends) on
	 * destroy, and a board tumble destroys symbol views while their pop is still running. Reading
	 * or writing through a destroyed target is not an error worth reporting — the tween simply has
	 * nothing left to animate, so it stops.
	 */
	const alive = () => target != null && (keys.includes('scaleXY') ? target.scale != null : true) && !target.destroyed;
	const read = (k: string) => (k === 'scaleXY' ? target.scale.x : (target[k] as number));
	const write = (k: string, v: number) => {
		if (k === 'scaleXY') target.scale.set(v);
		else (target as Numeric)[k] = v;
	};
	return scheduler.add(
		ms,
		(p) => {
			if (!alive()) return;
			if (!from) {
				from = {};
				for (const k of keys) from[k] = read(k);
			}
			const e = easing(p);
			for (const k of keys) {
				const a = from[k];
				const b = (to as Record<string, number>)[k];
				write(k, a + (b - a) * e);
			}
		},
		delay,
	);
};

/** Run `fn(p)` for `ms`. */
export const run = (ms: number, fn: (p: number) => void, delay = 0) => scheduler.add(ms, fn, delay);
