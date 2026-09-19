import { describe, expect, it } from "vitest";
import { computeStageFit } from "../src/components/GameStage";

describe("computeStageFit", () => {
  it("fills a 16:9 desktop with no leftover height or width", () => {
    const fit = computeStageFit(1920, 1080);
    expect(fit.orient).toBe("landscape");
    expect(fit.w * fit.scale).toBeCloseTo(1920);
    expect(fit.h * fit.scale).toBeCloseTo(1080);
  });

  it("fills a 16:10 laptop — the old letterbox case", () => {
    const fit = computeStageFit(1440, 900);
    expect(fit.orient).toBe("landscape");
    expect(fit.w * fit.scale).toBeCloseTo(1440);
    expect(fit.h * fit.scale).toBeCloseTo(900);
    expect(fit.h).toBeGreaterThan(675);
  });

  it("fills a tall phone without top/bottom bars", () => {
    const fit = computeStageFit(390, 844);
    expect(fit.orient).toBe("portrait");
    expect(fit.w * fit.scale).toBeCloseTo(390);
    expect(fit.h * fit.scale).toBeCloseTo(844);
    expect(fit.h).toBeGreaterThan(1200);
  });

  it("fills 425×812 the same way as 375×667 — width-scale, HUD at stage bottom", () => {
    const a = computeStageFit(425, 812);
    const b = computeStageFit(375, 667);
    expect(a.orient).toBe("portrait");
    expect(b.orient).toBe("portrait");
    expect(a.w).toBe(b.w);
    expect(a.w * a.scale).toBeCloseTo(425);
    expect(a.h * a.scale).toBeCloseTo(812);
  });

  it("keeps 320 / 375 / 425 on the same portrait design width so scale stays proportional", () => {
    const se = computeStageFit(320, 568);
    const mid = computeStageFit(375, 667);
    const wide = computeStageFit(425, 812);
    expect(se.orient).toBe("portrait");
    expect(mid.orient).toBe("portrait");
    expect(wide.orient).toBe("portrait");
    expect(se.w).toBe(675);
    expect(mid.w).toBe(675);
    expect(wide.w).toBe(675);
    expect(se.w * se.scale).toBeCloseTo(320);
    expect(mid.w * mid.scale).toBeCloseTo(375);
    expect(wide.w * wide.scale).toBeCloseTo(425);
    expect(mid.scale).toBeGreaterThan(se.scale);
    expect(wide.scale).toBeGreaterThan(mid.scale);
  });
});
