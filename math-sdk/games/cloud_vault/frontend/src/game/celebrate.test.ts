import { describe, expect, it } from "vitest";
import { COUNT_MS, REVEAL_MS, playBook, winLevel, type FeatureState, type Overlay, type View } from "./player";

const feature: FeatureState = {
  feature: "bonus", rows: [0, 1, 2, 3, 4], minChest: 2,
  banked: Array.from({ length: 5 }, () => Array(5).fill(false)), unlocked: Array(5).fill(false),
  values: Array(5).fill(null), fs: 10, totalFs: 10, freeSpins: true, entryWin: 0, keys: false,
};

function harness(f: FeatureState | null) {
  const overlays: (Overlay | null)[] = [];
  const taps: number[] = [];
  const view: View = {
    reels: () => [], setReels: () => {}, feature: () => f, setFeature: (v) => { f = v; },
    setRoundWin: () => {}, setPanel: () => {}, setLabels: () => {}, setHalos: () => {}, setPlus: () => {},
    setAnticipation: () => {}, setOverlay: (o) => overlays.push(o), sleep: async () => {},
    // Every wait ends at once, as if the player tapped through.
    tap: async (ms) => { taps.push(ms); }, sound: () => {},
  };
  return { view, overlays, taps };
}

describe("win celebration", () => {
  it("uses the existing thresholds: big from 20× (bought rounds from half their cost)", () => {
    expect(winLevel(2, 1)).toBe("small");
    expect(winLevel(5, 1)).toBe("medium");
    expect(winLevel(20, 1)).toBe("big");
    expect(winLevel(49, 100)).toBe("medium");
    expect(winLevel(50, 100)).toBe("big");
    expect(winLevel(2, 100)).toBe("small");
  });

  it("a tap during the count shows the exact total at once, then the screen holds until the next tap", async () => {
    const h = harness(feature);
    await playBook([{ index: 0, type: "freeSpinEnd", amount: 1234 }], h.view, 1);
    const totals = h.overlays.filter((o): o is Extract<Overlay, { kind: "total" }> => o?.kind === "total");
    expect(totals.map((o) => [o.x, !!o.done])).toEqual([[12.34, false], [12.34, true]]);
    expect(totals[0].level).toBe("medium");
    expect(h.taps.slice(0, 2)).toEqual([REVEAL_MS + COUNT_MS.medium, Infinity]);
  });

  it("big win lands on the same amount and closes after its hold", async () => {
    const h = harness(null);
    await playBook([{ index: 0, type: "finalWin", amount: 2500 }], h.view, 1);
    expect(h.overlays.map((o) => o && o.kind === "bigwin" && [o.x, !!o.done])).toEqual([[25, false], [25, true], null]);
    expect(h.taps).toEqual([REVEAL_MS + COUNT_MS.big, 1600]);
  });

  it("no celebration below the big-win threshold", async () => {
    const h = harness(null);
    await playBook([{ index: 0, type: "finalWin", amount: 1900 }], h.view, 1);
    expect(h.overlays).toEqual([]);
  });
});
