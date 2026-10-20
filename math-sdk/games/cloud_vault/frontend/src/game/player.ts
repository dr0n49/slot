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
  keys: boolean; // raid keys have landed on the vaults
};

export type WinLabel = { key: number; reel: number; row: number; x: number };
export type Plus = { key: number; reel: number; row: number };

export type Overlay =
  | { kind: "mystery"; outcome: string }
  | { kind: "intro"; feature: string; totalFs: number; freeSpins: boolean; minChest: number }
  | { kind: "keys"; feature: string }
  | { kind: "chests"; product: number; before: number; after: number; done: boolean }
  | { kind: "total"; feature: string; x: number }
  | { kind: "bigwin"; x: number }
  | { kind: "maxwin"; x: number };

export type View = {
  reels: () => Reel[];
  setReels: (r: Reel[]) => void;
  feature: () => FeatureState | null;
  setFeature: (f: FeatureState | null) => void;
  setRoundWin: (x: number) => void;
  setTumbleWin: (x: number | null) => void;
  setPanel: (x: number | null) => void; // win panel in the middle of the board
  setLabels: (l: WinLabel[]) => void;
  setHalos: (p: { reel: number; row: number }[]) => void;
  setPlus: (p: Plus[]) => void;
  setOverlay: (o: Overlay | null) => void;
  toast: (text: string) => void;
  sleep: (ms: number) => Promise<void>;
  tap: (ms: number) => Promise<void>; // waits for a tap or ms (auto-continue)
  sound: (name: string) => void;
};

const x100 = (v: unknown) => Number(v ?? 0) / 100;
const BIG_WIN_X = 20;
let labelKey = 1;

const isFreeSpins = (f: string) => f !== "raid" && f !== "storm";

export async function playBook(events: BookEvent[], view: View, cost: number): Promise<number> {
  let roundWin = 0;
  for (const ev of events) {
    switch (ev.type) {
      case "mysteryReveal": {
        view.setOverlay({ kind: "mystery", outcome: String(ev.outcome) });
        view.sound("mystery");
        await view.tap(2200);
        view.setOverlay(null);
        break;
      }
      case "featureStart": {
        const feature = String(ev.feature);
        const freeSpins = isFreeSpins(feature);
        const minChest = Number(ev.minChest);
        view.setFeature({
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
        });
        if (freeSpins) {
          view.setOverlay({ kind: "intro", feature, totalFs: Number(ev.totalFs), freeSpins, minChest });
          view.sound("feature");
          await view.tap(4000);
        } else {
          // Raid: keys fly onto every vault before the spin.
          view.setOverlay({ kind: "keys", feature });
          view.sound("feature");
          await view.sleep(1300);
          const f = view.feature();
          if (f) view.setFeature({ ...f, keys: true });
          await view.sleep(350);
        }
        view.setOverlay(null);
        break;
      }
      case "updateFreeSpin": {
        const f = view.feature();
        if (f) view.setFeature({ ...f, fs: Number(ev.amount), totalFs: Number(ev.total) });
        view.setTumbleWin(null);
        break;
      }
      case "reveal": {
        view.setHalos([]);
        view.setPlus([]);
        view.setLabels([]);
        view.setPanel(null);
        // Old symbols fall out, the board is empty for a beat, new ones drop in reel by reel.
        view.setReels(dropOut(view.reels()));
        view.sound("spin");
        await view.sleep(300);
        view.setReels(fromReveal(ev.board as { name: string }[][]));
        view.sound("drop");
        await view.sleep(820);
        view.setReels(settle(view.reels()));
        const halos: { reel: number; row: number }[] = [];
        (ev.board as { name: string }[][]).forEach((col, r) =>
          col.slice(1, -1).forEach((s, w) => s.name === "S" && halos.push({ reel: r, row: w })),
        );
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
        await view.sleep(950);
        break;
      }
      case "updateTumbleWin": {
        const x = x100(ev.amount);
        view.setTumbleWin(x);
        view.setPanel(x);
        break;
      }
      case "rowsBanked": {
        const f = view.feature();
        if (f) view.setFeature({ ...f, banked: ev.banked as boolean[][] });
        view.sound("bank");
        await view.sleep(260);
        break;
      }
      case "chestsUnlocked": {
        const f = view.feature();
        if (f) view.setFeature({ ...f, unlocked: ev.unlocked as boolean[] });
        view.toast((ev.reels as number[]).length > 1 ? "Vaults unlocked!" : "Vault unlocked!");
        view.sound("unlock");
        await view.sleep(700);
        break;
      }
      case "tumbleBoard": {
        const exploding = ev.explodingSymbols as { reel: number; row: number }[];
        view.setLabels([]);
        view.setReels(popWins(view.reels(), exploding));
        await view.sleep(340);
        view.setReels(applyTumble(view.reels(), exploding, ev.newSymbols as { name: string }[][]));
        view.sound("drop");
        await view.sleep(480);
        view.setReels(settle(view.reels()));
        break;
      }
      case "haloExtraSpins": {
        const f = view.feature();
        if (f) view.setFeature({ ...f, totalFs: Number(ev.totalFs) });
        const pos = ev.positions as { reel: number; row: number }[];
        view.setHalos(pos);
        view.setPlus(pos.slice(-Number(ev.count)).map((p) => ({ key: labelKey++, ...p })));
        view.sound("halo");
        await view.sleep(900);
        view.setPlus([]);
        break;
      }
      case "freeSpinTrigger": {
        const pos = (ev.positions as { reel: number; row: number }[]).map((p) => ({ reel: p.reel, row: p.row - 1 }));
        view.setHalos(pos);
        view.sound("trigger");
        await view.sleep(1500);
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
        const chests = ev.chests as { reel: number; mult: number }[];
        const before = x100(ev.winBefore);
        const after = x100(ev.winAfter);
        view.setPanel(null);
        view.setOverlay({ kind: "chests", product: 1, before, after, done: false });
        let product = 1;
        for (const c of chests) {
          const f = view.feature()!;
          const values = [...f.values];
          values[c.reel] = c.mult;
          view.setFeature({ ...f, values });
          product *= c.mult;
          view.setOverlay({ kind: "chests", product, before, after, done: false });
          view.sound("chest");
          await view.sleep(900);
        }
        view.setOverlay({ kind: "chests", product, before, after, done: true });
        view.sound("multiply");
        await view.tap(2400);
        view.setOverlay(null);
        break;
      }
      case "freeSpinEnd": {
        const f = view.feature();
        view.setOverlay({ kind: "total", feature: f?.feature ?? "bonus", x: x100(ev.amount) });
        view.sound("summary");
        await view.tap(4000);
        view.setOverlay(null);
        break;
      }
      case "wincap": {
        view.setOverlay({ kind: "maxwin", x: x100(ev.amount) });
        view.sound("maxwin");
        await view.tap(3500);
        view.setOverlay(null);
        break;
      }
      case "finalWin": {
        roundWin = x100(ev.amount);
        view.setRoundWin(roundWin);
        view.setTumbleWin(null);
        const f = view.feature();
        // Free spins already ended on the Total Win screen; big win celebrates base/raid wins.
        if (!f?.freeSpins && roundWin >= BIG_WIN_X * Math.max(1, cost / 10) && roundWin < 25000) {
          view.setOverlay({ kind: "bigwin", x: roundWin });
          view.sound("bigwin");
          await view.tap(3200);
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
