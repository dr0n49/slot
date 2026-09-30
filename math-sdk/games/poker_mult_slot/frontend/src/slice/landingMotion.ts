// Godot reference: reel_controller.gd, symbol_visual.gd and fx_manager.gd.
// This clock owns presentation only. It cannot produce an outcome or settle
// target-free travel; the React owner must supply the real reveal first.
export const LANDING = {
  cell: 205, speed: 2600, turboSpeed: 3400,
  rampMs: 180, turboRampMs: 60, minimumMs: 550, turboMinimumMs: 120,
  columnMs: 160, turboColumnMs: 45, lastMs: 80, turboLastMs: 30,
  overshootCells: .03, overshootMs: 30, settleMs: 70,
  squashX: 1.04, squashY: .97, squashMs: 50, squashSettleMs: 120,
  rowMs: 12, turboRowMs: 6, turboBounceScale: .5,
  shakeSmall: .8, shakeLast: 2.2, shakeJoker: 5, shakeDecay: 24,
} as const;

export type ReelMotion = {
  phase: "travel" | "approach" | "overshoot" | "settle" | "rest";
  offset: number;
  stopAt: number;
  approachAt: number;
  approachMs: number;
  approachFrom: number;
  squashAt: number;
  collisionAt: number;
};
type Callbacks = {
  wrap: (column: number) => void;
  prepare: (column: number) => void;
  collision: (column: number, joker: boolean) => void;
  settled: () => void;
};
const sineIn = (v: number) => 1 - Math.cos(v * Math.PI / 2);
const sineOut = (v: number) => Math.sin(v * Math.PI / 2);
const cubicOut = (v: number) => 1 - (1 - v) ** 3;
const unit = (v: number) => Math.max(0, Math.min(1, v));

export class LandingMotion {
  readonly reels: ReelMotion[] = Array.from({length: 5}, () => ({
    phase: "rest", offset: 0, stopAt: Infinity, approachAt: 0,
    approachMs: 0, approachFrom: 0, squashAt: Infinity, collisionAt: Infinity,
  }));
  private startedAt = 0;
  private lastFrameAt = 0;
  private target = false;
  private jokers: boolean[] = [];
  private fast = false;
  private active = false;
  constructor(private callbacks: Callbacks, readonly reduced = false) {}

  begin(now: number, turbo: boolean) {
    if (this.active) return;
    this.startedAt = this.lastFrameAt = now;
    this.fast = turbo; this.active = true; this.target = false; this.jokers = [];
    for (const reel of this.reels) Object.assign(reel, {
      phase: "travel", offset: 0, stopAt: Infinity,
      squashAt: Infinity, collisionAt: Infinity,
    });
  }

  reveal(now: number, jokerCounts: number[]) {
    if (this.target || !this.active) return;
    this.target = true; this.jokers = jokerCounts.map(n => n > 0);
    const first = Math.max(now, this.startedAt +
      (this.reduced ? 120 : this.fast ? LANDING.turboMinimumMs : LANDING.minimumMs));
    let jokerSum = 0, anticipationColumn = -1;
    for (let c = 0; c < 5; c++) {
      jokerSum += jokerCounts[c];
      if (jokerSum >= 2) { anticipationColumn = c; break; }
    }
    for (let c = 0; c < 5; c++) {
      let delay = this.reduced ? 0 : c * (this.fast ? LANDING.turboColumnMs : LANDING.columnMs);
      if (!this.reduced && anticipationColumn >= 0 && c > anticipationColumn)
        delay += (c - anticipationColumn) * (this.fast ? 200 : 560);
      else if (!this.reduced && anticipationColumn < 0 && c === 4)
        delay += this.fast ? LANDING.turboLastMs : LANDING.lastMs;
      this.reels[c].stopAt = first + delay;
    }
  }

  // Transfer a compositor-only wallet-wait nudge into the live strip phase.
  // CSS and strip travel then meet at exactly the same visible position.
  carryFeedback(offset: number) {
    if (!this.active || this.target) return;
    for (let c = 0; c < 5; c++) {
      this.reels[c].offset += offset;
      while (this.reels[c].offset >= LANDING.cell) {
        this.reels[c].offset -= LANDING.cell; this.callbacks.wrap(c);
      }
    }
  }

  cancel() {
    if (this.target || !this.active) return false;
    this.active = false;
    this.rest();
    return true;
  }

  snap() {
    if (!this.target || !this.active) return false;
    this.active = false;
    this.rest();
    return true;
  }

  private rest() {
    for (const reel of this.reels) Object.assign(reel, {
      phase: "rest", offset: 0, squashAt: Infinity,
    });
  }

  tick(now: number) {
    if (!this.active) return;
    const seconds = Math.min(64, Math.max(0, now - this.lastFrameAt)) / 1000;
    this.lastFrameAt = now;
    const speed = this.fast ? LANDING.turboSpeed : LANDING.speed;
    for (let c = 0; c < 5; c++) {
      const reel = this.reels[c];
      if (reel.phase === "rest") continue;
      if (reel.phase === "travel") {
        if (!this.reduced) {
          const ramp = unit((now - this.startedAt) / (this.fast ? LANDING.turboRampMs : LANDING.rampMs));
          reel.offset += speed * ramp * ramp * seconds;
          while (reel.offset >= LANDING.cell) {
            reel.offset -= LANDING.cell; this.callbacks.wrap(c);
          }
        }
        if (!this.target || now < reel.stopAt) continue;
        this.callbacks.prepare(c);
        // Keep the exact mid-cell offset. Only the target chain changes.
        reel.approachAt = now; reel.approachFrom = reel.offset;
        reel.approachMs = this.reduced ? 0 : Math.max(50, Math.min(140,
          (LANDING.cell - reel.offset) / speed * 1000));
        // Godot starts row squashes at brake start, before the final wrap.
        reel.squashAt = this.reduced ? Infinity : now;
        reel.phase = "approach";
      }
      if (reel.phase === "approach") {
        const u = reel.approachMs === 0 ? 1 : unit((now - reel.approachAt) / reel.approachMs);
        reel.offset = reel.approachFrom + (LANDING.cell - reel.approachFrom) * sineIn(u);
        if (u < 1) continue;
        this.callbacks.wrap(c);
        reel.offset = 0;
        reel.collisionAt = now;
        this.callbacks.collision(c, this.jokers[c]);
        reel.phase = this.reduced ? "rest" : "overshoot";
      }
      if (reel.phase === "overshoot") {
        const u = unit((now - reel.collisionAt) / LANDING.overshootMs);
        reel.offset = LANDING.cell * LANDING.overshootCells * sineOut(u);
        if (u < 1) continue;
        reel.phase = "settle";
      }
      if (reel.phase === "settle") {
        const u = unit((now - reel.collisionAt - LANDING.overshootMs) / LANDING.settleMs);
        reel.offset = LANDING.cell * LANDING.overshootCells * (1 - cubicOut(u));
        if (u === 1) reel.phase = "rest";
      }
    }
    if (this.target && this.reels.every(r => r.phase === "rest")) {
      this.active = false;
      this.callbacks.settled();
    }
  }

  squash(column: number, row: number, now: number): [number, number] {
    const factor = this.fast ? LANDING.turboBounceScale : 1;
    const elapsed = now - this.reels[column].squashAt - row * (this.fast ? LANDING.turboRowMs : LANDING.rowMs);
    if (this.reduced || elapsed < 0) return [1, 1];
    const attack = LANDING.squashMs * factor, release = LANDING.squashSettleMs * factor;
    const amount = elapsed < attack ? sineOut(unit(elapsed / attack)) :
      1 - cubicOut(unit((elapsed - attack) / release));
    return [1 + (LANDING.squashX - 1) * amount, 1 + (LANDING.squashY - 1) * amount];
  }
}
