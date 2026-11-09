import { LOTUS, SPIN, TUMBLE, cloudCollapseAt, groupTiming, tumbleDelay, tumbleDuration } from "./presentation";
/** Plays one book's events onto the view. Amounts in books are × bet × 100. */
import { applyTumble, dropOut, markWins, popWins, refill, settle, type Reel } from "./board";
import { revealPlan } from "./reveal";
import type { BookEvent } from "./rgs";

export type FeatureState = {
  feature: string;
  rows: number[];
  minChest: number;
  banked: boolean[][];
  unlocked: boolean[];
  values: (number | null)[];
  fs: number;
  totalFs: number;
  freeSpins: boolean;
  entryWin: number; // paid before this feature; excluded from its lotus multiplier
  keys: boolean; // raid keys have landed on the chests
  done?: boolean; // round over: drop the feature look and the lotuses
  leaving?: boolean; // the bonus is closing: the lotuses fade out
  /** Presentation only: rows just banked (a light runs from them down to their lotus), the lotus that just became
   * ready, and the lotus being opened in the finale. Keys restart the one-shot animations. */
  fresh?: { reel: number; row: number }[];
  freshKey?: number;
  awoken?: number[];
  opening?: number | null;
  gathering?: boolean; // the opening lotus is still drawing in light, before it opens
};

export type WinLabel = { key: number; reel: number; row: number; x: number; ms?: number };
export type Plus = { key: number; reel: number; row: number };
/** Centre-of-board win panel; `mult` shows the chest product while chests open. `focus` zooms the scene in on the
 * board for the lotus finale; `fly` sends one lotus's multiplier from the lotus into the panel. */
export type Panel = { x: number; mult?: number; final?: boolean; focus?: boolean; fly?: { reel: number; mult: number; key: number } } | null;

export type Overlay =
  | { kind: "cloud" } // cloud wipe between the base world and the bonus world
  | { kind: "intro"; feature: string; totalFs: number; minChest: number; rows?: number }
  | { kind: "keys"; feature: string }
  | { kind: "total"; feature: string; x: number; level?: WinLevel; done?: boolean; values?: (number | null)[] }
  | { kind: "bigwin"; x: number; done?: boolean }
  | { kind: "maxwin"; x: number };

export type View = {
  reels: () => Reel[];
  setReels: (r: Reel[]) => void;
  feature: () => FeatureState | null;
  setFeature: (f: FeatureState | null) => void;
  setRoundWin: (x: number) => void;
  setPanel: (p: Panel) => void;
  setLabels: (l: WinLabel[]) => void;
  setHalos: (p: { reel: number; row: number }[]) => void;
  setPlus: (p: Plus[]) => void;
  setAnticipation: (reel: number | null) => void;
  setOverlay: (o: Overlay | null) => void;
  motionScale?: () => number;
  sleep: (ms: number, scale?: number) => Promise<void>;
  /** Quick stop: while on, a player tap ends every pending sleep at once and `slammed()` turns true until it is off. */
  slammable?: (on: boolean) => void;
  slammed?: () => boolean;
  tap: (ms: number) => Promise<void>; // waits for a tap or ms (auto-continue); Infinity = only a tap
  sound: (name: string) => void;
};

const x100 = (v: unknown) => Number(v ?? 0) / 100;
/** The bonus HUD and lotus reveal use feature winnings, excluding the trigger spin. */
export function featureWin(roundWin: number, feature: FeatureState): number {
  return Math.max(0, Math.round(roundWin * 100) - Math.round(feature.entryWin * 100)) / 100;
}

export const BIG_WIN_X = 20;
/** ms a finished free spin rests before the next one. */
export const FS_REST = 450;
/** How much a round's result is celebrated, on the existing thresholds: big from BIG_WIN_X × bet (bought rounds:
 * from half their cost, as the big-win screen). A small total gets a calm screen and a short count. */
export type WinLevel = "small" | "medium" | "big";
export function winLevel(x: number, cost: number): WinLevel {
  const k = cost >= 100 ? (x / cost) * 2 * BIG_WIN_X : x;
  return k >= BIG_WIN_X ? "big" : k >= 5 ? "medium" : "small";
}
export const COUNT_MS: Record<WinLevel, number> = { small: 900, medium: 1600, big: 2600 };
/** The screen's art opens first; the counter starts after it (Overlays' CountUp uses the same delay). */
export const REVEAL_MS = 650;
/** A win that climbs tiers counts longer, so each new tier gets its moment. */
export const bigWinMs = (x: number) => (x >= 75 ? 6000 : x >= 40 ? 4200 : COUNT_MS.big);
/** Count up, then land: a tap during the count jumps straight to the exact total; the screen then holds. */
async function celebrate(view: View, o: Extract<Overlay, { kind: "total" | "bigwin" }>, countMs: number, hold: number) {
  view.setOverlay(o);
  await view.tap(REVEAL_MS + countMs);
  view.setOverlay({ ...o, done: true });
  // The heroine answers the landed amount (no sound of its own; the screen's cue is already playing).
  if (o.kind === "total" && o.level !== "small") view.sound(o.level === "big" ? "landBig" : "landWin");
  await view.tap(hold);
}
let labelKey = 1;
let flyKey = 1;

/** A win amount is about 1.6 cells wide and half a cell tall (cell units). */
const LABEL_W = 1.6;
const LABEL_H = 0.5;
/** Where a new win amount goes so it never covers one already on the board: its own cell when free, otherwise the
 * nearest half-row step above or below that is clear (two groups paying side by side stack instead of overlapping). */
export function placeLabel(placed: { reel: number; row: number }[], reel: number, row: number): number {
  const free = (r: number) => placed.every((p) => Math.abs(p.reel - reel) >= LABEL_W || Math.abs(p.row - r) >= LABEL_H);
  for (const step of [0, -0.5, 0.5, -1, 1, -1.5, 1.5]) {
    const r = row + step;
    if (r >= -0.35 && r <= 4.35 && free(r)) return r;
  }
  return row;
}

const isFreeSpins = (f: string) => f !== "raid" && f !== "storm";

async function cloudWipe(view: View, during: () => void) {
  view.setOverlay({ kind: "cloud" });
  view.sound("transition");
  await view.sleep(650);
  during();
  await view.sleep(650);
}

/** A spin answers the press at once: the columns start leaving while the round is still being requested
 * (1.0.37 waited for the server's answer, so the board stood still for the whole round trip). The next
 * reveal picks the running spin up instead of starting another one. */
let prespun: { at: number; speed: number; reels: Reel[] } | null = null;
export function startSpin(view: View) {
  const speed = view.motionScale?.() ?? 1;
  const reels = view.reels();
  view.setHalos([]);
  view.setPlus([]);
  view.setLabels([]);
  view.setPanel(null);
  view.setAnticipation(null);
  view.setReels(dropOut(reels, speed));
  view.sound("spin");
  prespun = { at: performance.now(), speed, reels };
}
/** The round failed before any reveal: the symbols that left fall back in. */
export function cancelSpin(view: View) {
  if (!prespun) return;
  view.setReels(refill(prespun.reels));
  prespun = null;
}

export async function playBook(events: BookEvent[], view: View, cost: number): Promise<number> {
  let roundWin = 0;
  for (const ev of events) {
    switch (ev.type) {
      case "mysteryReveal":
        // The actual featureStart (if any) introduces the result directly.
        break;
      case "featureStart": {
        const feature = String(ev.feature);
        const freeSpins = isFreeSpins(feature);
        const minChest = Number(ev.minChest);
        const state: FeatureState = {
          feature,
          rows: ev.rowsRequired as number[],
          minChest,
          banked: Array.from({ length: 5 }, () => Array(5).fill(false)),
          unlocked: Array(5).fill(false),
          values: Array(5).fill(null),
          fs: 0,
          totalFs: freeSpins ? Number(ev.totalFs) : 0,
          freeSpins,
          entryWin: roundWin,
          keys: false,
        };
        if (freeSpins) {
          // Clouds sweep in, the bonus world appears behind them, then the intro card.
          await cloudWipe(view, () => {
            view.setFeature(state);
            view.setHalos([]);
            view.setLabels([]);
            view.setPanel(null);
          });
          view.setOverlay({ kind: "intro", feature, totalFs: Number(ev.totalFs), minChest, rows: (ev.rowsRequired as number[]).length });
          view.sound("feature");
          await view.tap(Infinity); // the bonus intro waits for the player
          view.sound("enter");
          view.setOverlay(null);
        } else {
          // Raid: the board empties and golden keys drop into every chest.
          view.setFeature(state);
          view.setReels(dropOut(view.reels()));
          view.setOverlay({ kind: "keys", feature });
          view.sound("feature");
          await view.sleep(1500);
          view.setFeature({ ...state, keys: true });
          view.setOverlay(null);
          await view.sleep(300);
        }
        break;
      }
      case "updateFreeSpin": {
        const f = view.feature();
        // A finished free spin rests a moment before the next one starts.
        if (f && Number(ev.amount) > 1) await view.sleep(FS_REST);
        if (f) view.setFeature({ ...f, fs: Number(ev.amount), totalFs: Number(ev.total) });
        view.setPanel(null);
        break;
      }
      case "reveal": {
        view.setHalos([]);
        view.setPlus([]);
        view.setLabels([]);
        view.setPanel(null);
        // Freeze this reveal's tempo: toggling turbo cannot cut off a scheduled landing.
        const early = prespun;
        prespun = null;
        const speed = early?.speed ?? view.motionScale?.() ?? 1;
        // A tap during the spin stops it: every symbol lands at once (presentation only; the board is the book's).
        view.slammable?.(true);
        view.setAnticipation(null);
        if (!early) {
          view.setReels(dropOut(view.reels(), speed));
          view.sound("spin");
        }
        const sinceStart = early ? performance.now() - early.at : 0;
        await view.sleep(Math.max(0, SPIN.refillAt * speed - sinceStart), 1);
        const plan = revealPlan(ev.board as { name: string }[][], !view.feature()?.freeSpins, speed);
        view.setReels(plan.reels);
        let elapsed = 0;
        let lit: number | null = null;
        let haloCount = 0;
        for (const step of plan.steps) {
          await view.sleep(step.at - elapsed, 1);
          if (view.slammed?.()) break;
          elapsed = step.at;
          if (step.halos.length !== haloCount) {
            haloCount = step.halos.length;
            view.setHalos(step.halos);
            view.sound("halo");
          }
          if (step.reel !== lit) {
            lit = step.reel;
            view.setAnticipation(lit);
            if (lit !== null) view.sound("anticipation");
          }
          if (step.landed) view.sound("land");
        }
        if (view.slammed?.()) {
          view.slammable?.(false);
          const halos = plan.steps.at(-1)?.halos ?? [];
          view.setAnticipation(null);
          view.setHalos(halos);
          view.setReels(settle(view.reels(), true));
          view.sound(halos.length ? "halo" : "land");
          await view.sleep(SPIN.landing * speed, 1); // the touch-down
          break;
        }
        await view.sleep(plan.duration - elapsed, 1);
        view.slammable?.(false);
        view.setAnticipation(null);
        view.setReels(settle(view.reels()));
        break;
      }
      case "winInfo": {
        view.setPanel(null);
        const wins = ev.wins as {
          win: number;
          positions: { reel: number; row: number }[];
          meta: { overlay: { reel: number; row: number } };
        }[];
        const speed = view.motionScale?.() ?? 1;
        const timing = groupTiming(speed);
        // One group at a time: it lights up and its amount appears on it, then the next one. With every group lit
        // at once and the amounts 140 ms apart, a player could not tell which amount belonged to which flowers.
        const lit: { reel: number; row: number }[] = [];
        const labels: WinLabel[] = [];
        for (let i = 0; i < wins.length; i++) {
          const w = wins[i];
          lit.push(...w.positions);
          view.setReels(markWins(view.reels(), lit, speed));
          view.sound("win");
          await view.sleep(timing.lead, 1);
          const reel = w.meta.overlay.reel;
          labels.push({ key: labelKey++, reel, row: placeLabel(labels, reel, w.meta.overlay.row - 1), x: x100(w.win), ms: timing.count });
          view.setLabels([...labels]);
          if (i < wins.length - 1) await view.sleep(timing.groupGap, 1);
        }
        await view.sleep(timing.hold, 1);
        break;
      }
      case "updateTumbleWin": {
        // This is the current spin's cascade subtotal; roundWin is the total
        // from completed spins. Keep ordinary payouts in the HUD, off the board.
        view.setPanel(null);
        view.setRoundWin(roundWin + x100(ev.amount));
        break;
      }
      case "rowsBanked": {
        const f = view.feature();
        if (f) {
          const banked = ev.banked as boolean[][];
          const fresh = banked.flatMap((col, reel) => col.map((on, row) => (on && !f.banked[reel]?.[row] ? { reel, row } : null)).filter((p) => p !== null));
          view.setFeature({ ...f, banked, fresh, freshKey: flyKey++ });
        }
        view.sound("bank");
        await view.sleep(240);
        break;
      }
      case "chestsUnlocked": {
        const f = view.feature();
        if (f) {
          const unlocked = ev.unlocked as boolean[];
          view.setFeature({ ...f, unlocked, awoken: unlocked.flatMap((on, r) => (on && !f.unlocked[r] ? [r] : [])), freshKey: flyKey++ });
        }
        view.sound("unlock");
        await view.sleep(800);
        break;
      }
      case "tumbleBoard": {
        const exploding = ev.explodingSymbols as { reel: number; row: number }[];
        view.setPanel(null);
        // Cloud peak covers the cut; surviving cells and incoming symbols then land together.
        const speed = view.motionScale?.() ?? 1;
        view.setReels(popWins(view.reels(), exploding, speed));
        view.sound("pop");
        await view.sleep(cloudCollapseAt(exploding.length, speed), 1);
        view.setLabels([]);
        // The emptied cells stay empty for a beat, so the eye reads what went before the next fall.
        await view.sleep(TUMBLE.breath * speed, 1);
        let fallEnds = 0;
        const next = applyTumble(view.reels(), exploding, ev.newSymbols as { name: string }[][]).map((reel, r) => ({
          ...reel,
          cells: reel.cells.map((c, row) => {
            if (!c.drop) return c;
            const delay = tumbleDelay(r, row, speed);
            const duration = tumbleDuration(c.drop, speed);
            fallEnds = Math.max(fallEnds, delay + duration);
            return { ...c, delay, duration };
          }),
        }));
        view.setReels(next);
        await view.sleep(fallEnds, 1);
        view.sound("drop");
        await view.sleep(TUMBLE.settle * speed, 1); // the touch-down settles before the next win lights
        view.setReels(settle(view.reels()));
        break;
      }
      case "haloExtraSpins": {
        const f = view.feature();
        if (f) view.setFeature({ ...f, totalFs: Number(ev.totalFs) });
        const pos = ev.positions as { reel: number; row: number }[];
        view.setHalos(pos);
        view.setPlus(pos.slice(-Number(ev.count)).map((p) => ({ key: labelKey++, ...p })));
        view.sound("plusone");
        await view.sleep(1300);
        view.setPlus([]);
        break;
      }
      case "freeSpinTrigger": {
        const pos = (ev.positions as { reel: number; row: number }[]).map((p) => ({ reel: p.reel, row: p.row - 1 }));
        view.setHalos(pos);
        view.sound("trigger");
        await view.sleep(1600);
        break;
      }
      case "setWin":
        break;
      case "setTotalWin": {
        roundWin = x100(ev.amount);
        view.setRoundWin(roundWin);
        break;
      }
      case "chestsOpen": {
        // The finale: the scene zooms in on the board, the win gathers in the centre panel, then each lotus in four
        // beats that never overlap: it draws in light → opens → its multiplier lands and rests → the multiplier
        // flies into the panel. Finally the total counts up from the win to the multiplied win.
        const chests = ev.chests as { reel: number; mult: number }[];
        const before = x100(ev.winBefore);
        const after = x100(ev.winAfter);
        view.setLabels([]);
        view.setPanel({ x: before, mult: 1, focus: true });
        await view.sleep(800);
        let product = 1;
        for (const c of chests) {
          // Only this lotus is lit; the others step back.
          view.setFeature({ ...view.feature()!, opening: c.reel, gathering: true });
          await view.sleep(LOTUS.gather);
          const f = view.feature()!;
          const values = [...f.values];
          values[c.reel] = c.mult;
          view.setFeature({ ...f, values, opening: c.reel, gathering: false });
          view.sound("chest");
          await view.sleep(LOTUS.open);
          view.setPanel({ x: before, mult: product, focus: true, fly: { reel: c.reel, mult: c.mult, key: flyKey++ } });
          await view.sleep(LOTUS.fly);
          product *= c.mult;
          view.setPanel({ x: before, mult: product, focus: true });
          await view.sleep(LOTUS.land);
        }
        const g = view.feature();
        if (g) view.setFeature({ ...g, opening: null });
        view.setPanel({ x: after, final: true, focus: true });
        view.sound("multiply");
        await view.sleep(1900);
        view.setPanel({ x: after, final: true });
        await view.sleep(500);
        break;
      }
      case "wincap": {
        view.setOverlay({ kind: "maxwin", x: x100(ev.amount) });
        view.sound("maxwin");
        await view.tap(4500);
        view.setOverlay(null);
        break;
      }
      case "freeSpinEnd": {
        const f = view.feature();
        const x = x100(ev.amount);
        const level = winLevel(x, cost);
        view.sound("summary");
        // Total Win waits for the player once the amount has landed.
        // The lotuses of the round as they ended (real values only; unopened ones stay closed).
        await celebrate(view, { kind: "total", feature: f?.feature ?? "bonus", x, level, values: f?.values }, COUNT_MS[level], Infinity);
        // Clouds carry the player back to the base world. The lotuses fade as the clouds come in and are gone under
        // them, so no part-filled lotus suggests its progress carries over into the next spins.
        const ending = view.feature();
        if (ending) view.setFeature({ ...ending, leaving: true });
        await cloudWipe(view, () => {
          const g = view.feature();
          if (g) view.setFeature({ ...g, done: true });
          view.setPanel(null);
        });
        view.setOverlay(null);
        break;
      }
      case "finalWin": {
        roundWin = x100(ev.amount);
        view.setRoundWin(roundWin);
        const f = view.feature();
        // Free spins end on the Total Win screen; big wins celebrate base and raid rounds.
        if (!f?.freeSpins && roundWin < 25000 && (cost < 100 ? roundWin >= BIG_WIN_X : roundWin >= cost * 0.5)) {
          view.sound("bigwin");
          await celebrate(view, { kind: "bigwin", x: roundWin }, bigWinMs(roundWin), 1600);
          view.setOverlay(null);
        }
        break;
      }
      default:
        break;
    }
  }
  view.setHalos([]);
  view.setPlus([]);
  view.setLabels([]);
  return roundWin;
}
