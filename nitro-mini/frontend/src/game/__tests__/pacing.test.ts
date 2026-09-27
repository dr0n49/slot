import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { startRoundTempo, tempo } from '../presentationPlan';
import type { BookEvent } from '../typesBookEvent';

/**
 * Frame-rate independent pacing budget.
 *
 * A round the player never touches must still finish well inside the presentation watchdog,
 * otherwise a perfectly healthy feature gets fast-forwarded (90 s) or force-settled (120 s).
 * This walks every published book through the same pacing constants the handlers use, applying
 * the round tempo ramp as it goes.
 */

/** Unattended cost of each event, in ms, before the tempo ramp. */
const COST: Record<string, number> = {
	reveal: 650 + 450,
	winInfo: 620 + 80,
	kegBlast: 165 * 2 + 240 + 560,
	updateTumbleWin: 420,
	tumbleBoard: 700,
	updateLadder: 140,
	setWin: 250 + 1100,
	setTotalWin: 250,
	freeSpinTrigger: 1600 + 4200,
	updateFreeSpin: 300 + 650,
	freeSpinRetrigger: 1500,
	freeSpinEnd: 300 + 4200,
	finalWin: 0,
	wincap: 250,
};

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../dev/mock-books.json.gz');
const available = fs.existsSync(file);

/** Milliseconds a book spends on screen unattended, with the tempo ramp applied. */
const budget = (events: BookEvent[]) => {
	const t0 = 0;
	startRoundTempo(t0);
	let elapsed = 0;
	for (const e of events) elapsed += (COST[e.type] ?? 0) * tempo(t0 + elapsed);
	return elapsed;
};

const SKIP_AFTER_MS = 90_000;
const ABANDON_AFTER_MS = 120_000;

describe('round tempo', () => {
	it('plays the opening of a round at full weight', () => {
		startRoundTempo(0);
		expect(tempo(0)).toBe(1);
		expect(tempo(14_000)).toBe(1);
	});

	it('compresses a long round towards the floor, and never past it', () => {
		startRoundTempo(0);
		const mid = tempo(22_500);
		expect(mid).toBeLessThan(1);
		expect(mid).toBeGreaterThan(0.3);
		expect(tempo(30_000)).toBeCloseTo(0.3, 5);
		expect(tempo(10_000_000)).toBeCloseTo(0.3, 5);
	});

	it('treats time zero as a real start rather than "no round"', () => {
		startRoundTempo(0);
		expect(tempo(0)).toBe(1);
		expect(tempo(30_000)).toBeCloseTo(0.3, 5);
	});
});

describe.skipIf(!available)('presentation budget across every published book', () => {
	const load = () => {
		const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf-8'));
		const out: { id: number; events: BookEvent[] }[] = [];
		for (const m of Object.values<{ natural: never[]; qa: Record<string, never[]> }>(data.modes)) {
			out.push(...m.natural, ...Object.values(m.qa).flat());
		}
		return out;
	};

	it('no book can outlive the watchdog while the player simply is not tapping', () => {
		const books = load();
		let worst = 0;
		let worstId = 0;
		let overSkip = 0;
		for (const b of books) {
			const ms = budget(b.events);
			if (ms > worst) {
				worst = ms;
				worstId = b.id;
			}
			if (ms > SKIP_AFTER_MS) overSkip++;
		}
		console.log(`worst book ${worstId}: ~${(worst / 1000).toFixed(1)}s unattended (${books.length} books)`);
		expect(overSkip).toBe(0);
		expect(worst).toBeLessThan(SKIP_AFTER_MS);
		expect(worst).toBeLessThan(ABANDON_AFTER_MS);
	});
});
