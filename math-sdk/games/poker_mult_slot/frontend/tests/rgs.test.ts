import { describe, expect, it } from "vitest";

import { payoutDollarsFromRound, payoutXFromRound, type RgsRound } from "../src/game/rgs";

const API = 1_000_000;

describe("booked RGS payout", () => {
  it("prefers event winX over the integer payoutMultiplier cents field", () => {
    const round: RgsRound = {
      payout: 16 * API,
      payoutMultiplier: 1600,
      events: [{ type: "winInfo", winX: 16, totalWin: 1600 }],
    };
    expect(payoutXFromRound(round, 1)).toBe(16);
    expect(payoutDollarsFromRound(round, 1)).toBe(16);
  });

  it("reads integer payoutMultiplier as cents of × when events are missing", () => {
    const round: RgsRound = { payoutMultiplier: 1600 };
    expect(payoutXFromRound(round, 1)).toBe(16);
    expect(payoutDollarsFromRound(round, 2)).toBe(32);
  });

  it("uses wallet payout cash / UI bet, not × the 20× buy cost", () => {
    const round: RgsRound = { payout: 70 * API, amount: 1 * API };
    expect(payoutDollarsFromRound(round, 1)).toBe(70);
    expect(payoutXFromRound(round, 1)).toBe(70);
  });
});
