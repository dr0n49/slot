import type { BookEventOfType, LadderRung } from './typesBookEvent';

/**
 * Turns a book event into a presentation plan.
 *
 * Pure: no scene, no state, no timers. Everything it returns is read out of the event — it
 * never works out a multiplier, an amount or a rung for itself. The book stays the single
 * source of truth; this module only decides how long each already-decided thing is on
 * screen and in what order.
 */

/** One rung a K-4 step walked through, with what that rung contributed. */
export type BlastStep = {
	index: number;
	multiplier: number;
	/** Book units (bet multiple x100). 0 when the event carries no breakdown. */
	win: number;
	/** 1-based position in the walk, for sound pitch and escalation. */
	ordinal: number;
	/** True for the rung the step started on. */
	first: boolean;
	/** True for the rung the step ended on. */
	last: boolean;
};

export type BlastPlan = {
	steps: BlastStep[];
	/** Sum over the walked rungs — taken from the event, not recomputed. */
	totalMultiplier: number;
	/** Where the next cascade starts, per the book. */
	nextIndex: number;
	/** True when the walk crossed more than one rung (a real K-4 multi-rung blast). */
	multiRung: boolean;
};

/**
 * The rung walk of a keg blast. `breakdown` is `winInfo.ladder.rungs` from the step that is
 * being paid — it carries each rung's share of the win. The blast event itself carries the
 * rung indices and multipliers; the two are matched by index.
 */
export const planBlast = (
	blast: Pick<BookEventOfType<'kegBlast'>, 'rungs' | 'multiplier' | 'nextIndex' | 'fromIndex' | 'toIndex'>,
	breakdown: readonly LadderRung[] | null,
): BlastPlan => {
	const wins = new Map<number, number>();
	for (const r of breakdown ?? []) wins.set(r.index, r.win);
	const rungs = blast.rungs ?? [];
	const steps: BlastStep[] = rungs.map((r, i) => ({
		index: r.index,
		multiplier: r.multiplier,
		win: wins.get(r.index) ?? 0,
		ordinal: i + 1,
		first: i === 0,
		last: i === rungs.length - 1,
	}));
	return {
		steps,
		totalMultiplier: blast.multiplier,
		nextIndex: blast.nextIndex ?? blast.toIndex,
		multiRung: steps.length > 1,
	};
};

// ---------------------------------------------------------------------------- pacing
/**
 * How much screen time a cascade step earns.
 *
 * An ordinary step is quick so a plain spin stays snappy; a step that pays well or that sits
 * high on the ladder gets more room, because that is where the player needs time to read
 * what happened. Both inputs come straight off the book event.
 */
export type StepPacing = {
	/** Time the win sits on screen before the board tumbles. */
	hold: number;
	/** Extra emphasis (shake / flash) — 0 for an ordinary step, up to 1 for a big one. */
	emphasis: number;
};

/** Book units at which a step stops being "ordinary" (1x and 10x of the bet). */
const STEP_NOTABLE = 100;
const STEP_BIG = 1000;
/** Ladder rung from which the climb itself is worth pausing on. */
const RUNG_NOTABLE = 3;

export const planStep = (winBookUnits: number, rungIndex: number): StepPacing => {
	const byWin = winBookUnits >= STEP_BIG ? 1 : winBookUnits >= STEP_NOTABLE ? 0.5 : 0;
	const byRung = rungIndex >= RUNG_NOTABLE ? Math.min(1, (rungIndex - RUNG_NOTABLE + 1) / 3) : 0;
	const emphasis = Math.max(byWin, byRung);
	return { hold: Math.round((620 + emphasis * 620) * tempo()), emphasis };
};

// ------------------------------------------------------------------- round tempo
/**
 * A long round tightens its own pacing.
 *
 * Most rounds are short, but a feature with ten spins and deep cascades can run for minutes at
 * full pacing if the player never taps — long enough for the watchdog to treat a perfectly
 * healthy round as stuck. So the presentation gradually compresses as a round goes on: the first
 * stretch plays at full weight, then holds shorten towards a floor. Nothing about the outcome
 * changes — only how long each already-decided beat stays on screen.
 */
/** null until a round's presentation starts (0 is a valid start time, so null is the sentinel). */
let roundStartedAt: number | null = null;

/** Called when a round's presentation begins. */
export const startRoundTempo = (now = Date.now()) => {
	roundStartedAt = now;
};

/**
 * The first `TEMPO_FULL_MS` of a round play at full weight; compression then ramps in over the
 * same span again, down to `TEMPO_FLOOR`. Chosen so the longest published book finishes well
 * inside the 90 s fast-forward threshold with the player never tapping — see pacing.test.ts,
 * which checks every book against exactly these constants.
 */
const TEMPO_FULL_MS = 15_000;
const TEMPO_FLOOR = 0.3;

/** Multiplier applied to presentation holds, 1 → TEMPO_FLOOR as the round runs long. */
export const tempo = (now = Date.now()): number => {
	if (roundStartedAt === null) return 1;
	const elapsed = now - roundStartedAt;
	if (elapsed <= TEMPO_FULL_MS) return 1;
	const over = Math.min(1, (elapsed - TEMPO_FULL_MS) / TEMPO_FULL_MS);
	return 1 - over * (1 - TEMPO_FLOOR);
};

/** Per-rung tick while a blast walks the ladder: later rungs land slightly harder. */
export const planTick = (step: BlastStep, total: number): { hold: number; rate: number } => ({
	hold: total > 4 ? 120 : 165,
	rate: 0.9 + (step.ordinal - 1) * 0.08,
});

// ---------------------------------------------------------------------------- tiers
export type Tier = 'normal' | 'big' | 'mega' | 'massive' | 'max';

/**
 * Presentation tier of a finished win. The level is the book's own `winLevel`, produced by
 * the frozen WIN_LEVELS table — nothing here reinterprets the amount.
 */
export const tierForLevel = (level: number): Tier => {
	if (level >= 10) return 'max';
	if (level >= 8) return 'massive';
	if (level >= 7) return 'mega';
	if (level >= 6) return 'big';
	return 'normal';
};

export const isCelebrationTier = (t: Tier) => t !== 'normal';

/** How hard the feature outro lands, by the tier the book's win level earned. */
export const featureOutroHold = (level: number) => (isCelebrationTier(tierForLevel(level)) ? 5200 : 4200);

// ------------------------------------------------------------------- feature wording
/**
 * Wording for a feature trigger.
 *
 * The frozen rules award free spins on exactly three scatters, so a count is only ever
 * spelled out when it is the one the rules can produce; anything else falls back to wording
 * that names no number. This can only ever soften the text — the spin count itself is the
 * book's `totalFs` and is printed as given.
 */
export const TRIGGER_SCATTERS = 3;

export const triggerText = (scatters: number, totalFs: number) => ({
	text: scatters === TRIGGER_SCATTERS ? `${scatters} SCATTERS` : 'SCATTERS',
	sub: `${totalFs} FREE SPINS`,
});
