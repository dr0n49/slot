import { describe, expect, it } from "vitest";

import { BIG_WIN_MIN, bigWinTier } from "../src/game/bigWin";

describe("bigWinTier", () => {
  it("returns null below the NICE threshold", () => {
    expect(bigWinTier(0)).toBeNull();
    expect(bigWinTier(5)).toBeNull();
    expect(bigWinTier(19.99)).toBeNull();
  });

  it("locks the NICE band [20, 50] — exact boundary stays on lower tier", () => {
    expect(bigWinTier(20)).toBe("nice");
    expect(bigWinTier(BIG_WIN_MIN)).toBe("nice");
    expect(bigWinTier(35)).toBe("nice");
    expect(bigWinTier(49.99)).toBe("nice");
    expect(bigWinTier(50)).toBe("nice");
  });

  it("locks the SUPER band (50, 100] — exact upper boundary stays SUPER", () => {
    expect(bigWinTier(50.01)).toBe("super");
    expect(bigWinTier(99.99)).toBe("super");
    expect(bigWinTier(100)).toBe("super");
  });

  it("locks the SENSATIONAL band (100, 500] — exact upper boundary stays SENSATIONAL", () => {
    expect(bigWinTier(100.01)).toBe("sensational");
    expect(bigWinTier(250)).toBe("sensational");
    expect(bigWinTier(499.99)).toBe("sensational");
    expect(bigWinTier(500)).toBe("sensational");
  });

  it("locks MAX above 500", () => {
    expect(bigWinTier(500.01)).toBe("max");
    expect(bigWinTier(50_000)).toBe("max");
  });

  it("round-cap hit forces MAX regardless of the amount", () => {
    expect(bigWinTier(5, true)).toBe("max");
    expect(bigWinTier(0, true)).toBe("max");
  });
});
