import type { LadderRung, Pos } from './typesBookEvent';

/**
 * Per-round presentation scratch state.
 *
 * Everything the book-event handlers need to remember *while they animate one round* lives
 * here and nowhere else. A fresh context is created for every round, so nothing can leak
 * across a round, a game-type switch or an error recovery — which is exactly what module
 * level variables used to do.
 */
export type RoundContext = {
	/** Round this context belongs to; stale callbacks compare against it. */
	readonly token: number;
	/** Cascade step inside the current spin — drives the ascending win-sound pitch. */
	stepIndex: number;
	/** Book units already banked when the current spin started (free spins add up). */
	spinBase: number;
	/** Line amounts held back until a keg blast has raised the ladder. */
	pendingLines: null | { pos: Pos[]; text: string }[];
	/**
	 * The per-rung breakdown of the step being paid, taken from `winInfo.ladder.rungs`.
	 * The following `kegBlast` reads it so each rung can show what it contributed; it is
	 * never computed here.
	 */
	pendingRungs: null | readonly LadderRung[];
};

const create = (token: number): RoundContext => ({
	token,
	stepIndex: 0,
	spinBase: 0,
	pendingLines: null,
	pendingRungs: null,
});

let current: RoundContext = create(0);

/** Start a new round: every handler from here on sees a clean context. */
export const startRoundContext = (token: number): RoundContext => {
	current = create(token);
	return current;
};

/** The context of the round being presented. */
export const roundContext = (): RoundContext => current;

/** A new spin inside the same round (base spin or one free spin). */
export const startSpinContext = (spinBase: number) => {
	current.stepIndex = 0;
	current.spinBase = spinBase;
	current.pendingLines = null;
	current.pendingRungs = null;
};

/** Drop anything a round left behind. Safe to call more than once. */
export const clearRoundContext = () => {
	current.pendingLines = null;
	current.pendingRungs = null;
	current.stepIndex = 0;
};
