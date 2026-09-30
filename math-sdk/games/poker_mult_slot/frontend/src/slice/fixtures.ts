import { playRound, reseed, type SpinResult } from "../game/engine";
import type { RevealPayload } from "../components/SlotGame";

export type FixtureName = "multi" | "nice" | "art";
const fixtures = new Map<FixtureName, SpinResult>();
// Every board comes directly from the unchanged engine. No cards/pays injected.
reseed(6);
fixtures.set("multi", playRound().base);
for (let seed = 1; !fixtures.has("nice") || !fixtures.has("art"); seed++) {
  if (seed > 200000) throw new Error("Slice fixture search exhausted");
  reseed(seed);
  const spin = playRound().base;
  if (!fixtures.has("nice") && spin.spinWinX >= 20 && spin.spinWinX <= 50)
    fixtures.set("nice", spin);
  if (!fixtures.has("art") && spin.goldCount > 0 && spin.goldCount < 3 &&
    spin.cards.some(c => c.rank === "A" && !c.golden) &&
    spin.cards.some(c => c.rank === "Q" && c.suit === "H" && !c.golden))
    fixtures.set("art", spin);
}
export function fixture(name: FixtureName): SpinResult {
  return fixtures.get(name)!;
}
export function payload(spin: SpinResult, rev: number): RevealPayload {
  return {
    cards: spin.cards, multipliers: spin.multipliers, winIndices: spin.winIndices,
    shownX: spin.spinWinX, bet: 1, rev,
    lines: (spin.lines ?? []).map(l => ({ id: l.id, hand_index: l.handIndex,
      win_x: l.winX, mult_factor: l.multFactor })),
  };
}
