import { afterEach, expect, it, vi } from "vitest";
vi.mock("../spine/runtime", () => ({ loadRig: vi.fn().mockResolvedValue(undefined), spineDisabled: vi.fn(() => false) }));
import { loadRig, spineDisabled } from "../spine/runtime";
import { preloadVisuals, VISUAL_IMAGES } from "./preload";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.mocked(spineDisabled).mockReturnValue(false); vi.mocked(loadRig).mockResolvedValue(undefined); });
function images(failure: "network" | "decode" | null = null) {
  const decoded: string[] = [];
  class ImageStub {
    srcValue = "";
    onload?: () => void;
    onerror?: () => void;
    set src(value: string) { this.srcValue = value; queueMicrotask(() => failure === "network" && value.includes("ui/logo") ? this.onerror?.() : this.onload?.()); }
    decode() { decoded.push(this.srcValue); return failure === "decode" && this.srcValue.includes("ui/logo") ? Promise.reject(new Error("decode failed")) : Promise.resolve(); }
  }
  vi.stubGlobal("Image", ImageStub);
  vi.stubGlobal("document", { fonts: { ready: Promise.resolve(), load: () => Promise.resolve([]) } });
  return decoded;
}
it("does not finish while a welcome card is downloaded but not decoded", async () => {
  images();
  let release!: () => void;
  vi.stubGlobal("document", { fonts: { ready: new Promise<void>((resolve) => { release = resolve; }), load: () => Promise.resolve([]) } });
  const progress: number[] = [];
  let ready = false;
  const loading = preloadVisuals((done, total) => progress.push(done / total)).then(() => { ready = true; });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(ready).toBe(false);
  expect(progress.at(-1)).toBeLessThan(1);
  release(); await loading;
  expect(ready).toBe(true); expect(progress.at(-1)).toBe(1);
});
it("rejects a welcome frame that cannot be downloaded instead of exposing empty cards", async () => {
  images("network");
  vi.stubGlobal("location", { href: "https://cdn.example/game/" });
  await expect(preloadVisuals(() => {})).rejects.toThrow(/ui\/logo/);
});
it("starts when a downloaded image refuses an early decode (it decodes on first paint)", async () => {
  images("decode");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await expect(preloadVisuals(() => {})).resolves.toBeUndefined();
});
it("downloads an image again once after a dropped connection", async () => {
  let failed = false;
  class ImageStub {
    onload?: () => void;
    onerror?: () => void;
    set src(value: string) { queueMicrotask(() => { if (value.includes("ui/logo") && !failed) { failed = true; this.onerror?.(); } else this.onload?.(); }); }
    decode() { return Promise.resolve(); }
  }
  vi.stubGlobal("Image", ImageStub);
  vi.stubGlobal("document", { fonts: { ready: Promise.resolve(), load: () => Promise.resolve([]) } });
  vi.stubGlobal("location", { href: "https://cdn.example/game/" });
  await expect(preloadVisuals(() => {})).resolves.toBeUndefined();
  expect(failed).toBe(true);
});
it("finishes when a bundled font fails to load (the text falls back, the game still starts)", async () => {
  images();
  vi.stubGlobal("document", { fonts: { ready: Promise.resolve(), load: () => Promise.reject(new DOMException("font failed", "NetworkError")) } });
  await expect(preloadVisuals(() => {})).resolves.toBeUndefined();
});
it("decodes the complete fallback artwork when Spine is unavailable", async () => {
  const decoded = images();vi.mocked(loadRig).mockRejectedValue(new Error("no WebGL"));
  await preloadVisuals(() => {});
  expect(decoded.sort()).toEqual([...VISUAL_IMAGES].sort());
  expect(new Set(decoded).size).toBe(VISUAL_IMAGES.length);
});

it("decodes the English titles and no localized pack", async () => {
  const decoded = images();
  await preloadVisuals(() => {});
  expect(decoded.filter((src) => src.includes("/localized/"))).toHaveLength(0);
  expect(decoded).toContain("./art/screens/v5/titles/total-win.webp");
  expect(new Set(decoded).size).toBe(decoded.length);
});
