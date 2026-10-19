/** Plays one book's events onto the view. Amounts in books are × bet × 100. */
import { applyTumble, fromReveal, markWins, popWins, settle, type Reel } from "./board";
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
};

export type WinLabel = { key: number; reel: number; row: number; x: number };

export type Overlay =
  | { kind: "mystery"; outcome: string }
  | { kind: "intro"; feature: string; totalFs: number; freeSpins: boolean }
  | { kind: "chests"; product: number; before: number; after: number; done: boolean }
  | { kind: "summary"; feature: string; x: number }
  | { kind: "bigwin"; x: number }
  | { kind: "maxwin"; x: number };

export type View = {
  reels: () => Reel[];
  setReels: (r: Reel[]) => void;
  feature: () => FeatureState | null;
  setFeature: (f: FeatureState | null) => void;
  setRoundWin: (x: number) => void;
  setTumbleWin: (x: number | null) => void;
  setLabels: (l: WinLabel[]) => void;
  setHalos: (p: { reel: number; row: number }[]) => void;
  setOverlay: (o: Overlay | null) => void;
  toast: (text: string) => void;
  sleep: (ms: number) => Promise<void>;
  tap: (ms: number) => Promise<void>; // waits for a tap or ms (auto-continue)
  sound: (name: string) => void;
};

const x100 = (v: unknown) => Number(v ?? 0) / 100;
const BIG_WIN_X = 20;
let labelKey = 1;

export async function playBook(events: BookEvent[], view: View, cost: number): Promise<number> {
  let roundWin = 0;
  let tumble = 0;
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
        const freeSpins = feature !== "raid" && feature !== "storm";
        view.setFeature({
          feature,
          rows: ev.rowsRequired as number[],
          minChest: Number(ev.minChest),
          banked: Array.from({ length: 5 }, () => Array(5).fill(false)),
          unlocked: Array(5).fill(false),
          values: Array(5).fill(null),
          fs: 0,
          totalFs: freeSpins ? Number(ev.totalFs) : 0,
          freeSpins,
        });
        view.setOverlay({ kind: "intro", feature, totalFs: Number(ev.totalFs), freeSpins });
        view.sound("feature");
        await view.tap(freeSpins ? 2600 : 1600);
        view.setOverlay(null);
        break;
      }
      case "updateFreeSpin": {
        const f = view.feature();
        if (f) view.setFeature({ ...f, fs: Number(ev.amount), totalFs: Number(ev.total) });
        tumble = 0;
        view.setTumbleWin(null);
        break;
      }
      case "reveal": {
        view.setHalos([]);
        view.setLabels([]);
        view.setReels(fromReveal(ev.board as { name: string }[][]));
        view.sound("drop");
        await view.sleep(620);
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
        const wins = ev.wins as { win: number; positions: { reel: number; row: number }[]; meta: { overlay: { reel: number; row: number } } }[];
        let reels = view.reels();
        reels = markWins(reels, wins.flatMap((w) => w.positions));
        view.setReels(reels);
        view.setLabels(wins.map((w) => ({ key: labelKey++, reel: w.meta.overlay.reel, row: w.meta.overlay.row - 1, x: x100(w.win) })));
        view.sound("win");
        await view.sleep(900);
        break;
      }
      case "updateTumbleWin": {
        tumble = x100(ev.amount);
        view.setTumbleWin(tumble);
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
        await view.sleep(320);
        view.setReels(applyTumble(view.reels(), exploding, ev.newSymbols as { name: string }[][]));
        view.sound("drop");
        await view.sleep(480);
        view.setReels(settle(view.reels()));
        break;
      }
      case "haloExtraSpins": {
        const f = view.feature();
        if (f) view.setFeature({ ...f, totalFs: Number(ev.totalFs) });
        view.setHalos(ev.positions as { reel: number; row: number }[]);
        view.toast(`+${ev.count} free spin${Number(ev.count) > 1 ? "s" : ""}`);
        view.sound("halo");
        await view.sleep(800);
        break;
      }
      case "freeSpinTrigger": {
        const pos = (ev.positions as { reel: number; row: number }[]).map((p) => ({ reel: p.reel, row: p.row - 1 }));
        view.setHalos(pos);
        view.sound("trigger");
        await view.sleep(1400);
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
        view.setOverlay({ kind: "summary", feature: f?.feature ?? "bonus", x: x100(ev.amount) });
        view.sound("summary");
        await view.tap(3000);
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
        if (roundWin >= BIG_WIN_X * Math.max(1, cost / 10) && roundWin < 25000) {
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
  view.setLabels([]);
  return roundWin;
}
