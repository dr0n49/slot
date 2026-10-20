/** Plays one book's events onto the view. Amounts in books are × bet × 100. */
import { applyTumble, dropOut, fromReveal, markWins, popWins, settle, type Reel } from "./board";
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
  keys: boolean; // raid keys have landed on the chests
  done?: boolean; // round over: keep chest values, drop the feature look
};

export type WinLabel = { key: number; reel: number; row: number; x: number };
export type Plus = { key: number; reel: number; row: number };
/** Centre-of-board win panel; `mult` shows the chest product while chests open. */
export type Panel = { x: number; mult?: number; final?: boolean } | null;

export type Overlay =
  | { kind: "mystery"; outcome: string }
  | { kind: "cloud" } // cloud wipe between the base world and the bonus world
  | { kind: "intro"; feature: string; totalFs: number; minChest: number }
  | { kind: "keys"; feature: string }
  | { kind: "total"; feature: string; x: number }
  | { kind: "bigwin"; x: number }
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
  setAnticipation: (on: boolean) => void;
  setOverlay: (o: Overlay | null) => void;
  sleep: (ms: number) => Promise<void>;
  tap: (ms: number) => Promise<void>; // waits for a tap or ms (auto-continue)
  sound: (name: string) => void;
};

const x100 = (v: unknown) => Number(v ?? 0) / 100;
export const BIG_WIN_X = 20;
let labelKey = 1;

const isFreeSpins = (f: string) => f !== "raid" && f !== "storm";

async function cloudWipe(view: View, during: () => void) {
  view.setOverlay({ kind: "cloud" });
  view.sound("transition");
  await view.sleep(650);
  during();
  await view.sleep(650);
}

export async function playBook(events: BookEvent[], view: View, cost: number): Promise<number> {
  let roundWin = 0;
  for (const ev of events) {
    switch (ev.type) {
      case "mysteryReveal": {
        view.setOverlay({ kind: "mystery", outcome: String(ev.outcome) });
        view.sound("mystery");
        await view.tap(2400);
        view.setOverlay(null);
        break;
      }
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
          view.setOverlay({ kind: "intro", feature, totalFs: Number(ev.totalFs), minChest });
          view.sound("feature");
          await view.tap(5000);
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
        if (f) view.setFeature({ ...f, fs: Number(ev.amount), totalFs: Number(ev.total) });
        view.setPanel(null);
        break;
      }
      case "reveal": {
        view.setHalos([]);
        view.setPlus([]);
        view.setLabels([]);
        view.setPanel(null);
        // Old symbols fall out, the reels stand empty for a beat, new ones drop in reel by reel.
        view.setReels(dropOut(view.reels()));
        view.sound("spin");
        await view.sleep(380);
        // Anticipation: with 2+ halos already down outside free spins, the later reels land slowly.
        const board = ev.board as { name: string }[][];
        const extra: number[] = [];
        let seen = 0;
        let slow = 0;
        board.forEach((col, r) => {
          if (!view.feature()?.freeSpins && seen >= 2) slow += 800;
          extra[r] = slow;
          seen += col.slice(1, -1).filter((s) => s.name === "S").length;
        });
        if (slow) {
          view.setAnticipation(true);
          view.sound("anticipation");
        }
        view.setReels(fromReveal(board, true, extra));
        view.sound("drop");
        await view.sleep(860 + slow);
        view.setAnticipation(false);
        view.setReels(settle(view.reels()));
        const halos: { reel: number; row: number }[] = [];
        board.forEach((col, r) => col.slice(1, -1).forEach((s, w) => s.name === "S" && halos.push({ reel: r, row: w })));
        if (halos.length) {
          view.setHalos(halos);
          view.sound("halo");
        }
        break;
      }
      case "winInfo": {
        const wins = ev.wins as {
          win: number;
          positions: { reel: number; row: number }[];
          meta: { overlay: { reel: number; row: number } };
        }[];
        view.setReels(markWins(view.reels(), wins.flatMap((w) => w.positions)));
        view.setLabels(
          wins.map((w) => ({ key: labelKey++, reel: w.meta.overlay.reel, row: w.meta.overlay.row - 1, x: x100(w.win) })),
        );
        view.sound("win");
        await view.sleep(1000);
        break;
      }
      case "updateTumbleWin": {
        view.setPanel({ x: x100(ev.amount) });
        break;
      }
      case "rowsBanked": {
        const f = view.feature();
        if (f) view.setFeature({ ...f, banked: ev.banked as boolean[][] });
        view.sound("bank");
        await view.sleep(240);
        break;
      }
      case "chestsUnlocked": {
        const f = view.feature();
        if (f) view.setFeature({ ...f, unlocked: ev.unlocked as boolean[] });
        view.sound("unlock");
        await view.sleep(800);
        break;
      }
      case "tumbleBoard": {
        const exploding = ev.explodingSymbols as { reel: number; row: number }[];
        view.setLabels([]);
        // Winning symbols burst into cloud puffs, then the column falls.
        view.setReels(popWins(view.reels(), exploding));
        view.sound("pop");
        await view.sleep(420);
        view.setReels(applyTumble(view.reels(), exploding, ev.newSymbols as { name: string }[][]));
        view.sound("drop");
        await view.sleep(500);
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
        // Chests open one by one; the centre panel shows the win and the growing product.
        const chests = ev.chests as { reel: number; mult: number }[];
        const before = x100(ev.winBefore);
        const after = x100(ev.winAfter);
        view.setLabels([]);
        view.setPanel({ x: before, mult: 1 });
        await view.sleep(500);
        let product = 1;
        for (const c of chests) {
          const f = view.feature()!;
          const values = [...f.values];
          values[c.reel] = c.mult;
          view.setFeature({ ...f, values });
          product *= c.mult;
          view.setPanel({ x: before, mult: product });
          view.sound("chest");
          await view.sleep(950);
        }
        view.setPanel({ x: after, final: true });
        view.sound("multiply");
        await view.sleep(1500);
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
        view.setOverlay({ kind: "total", feature: f?.feature ?? "bonus", x: x100(ev.amount) });
        view.sound("summary");
        await view.tap(5000);
        // Clouds carry the player back to the base world.
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
        if (!f?.freeSpins && roundWin >= BIG_WIN_X && roundWin < 25000 && cost < 100) {
          view.setOverlay({ kind: "bigwin", x: roundWin });
          view.sound("bigwin");
          await view.tap(4200);
          view.setOverlay(null);
        } else if (!f?.freeSpins && cost >= 100 && roundWin >= cost * 0.5 && roundWin < 25000) {
          view.setOverlay({ kind: "bigwin", x: roundWin });
          view.sound("bigwin");
          await view.tap(4200);
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
