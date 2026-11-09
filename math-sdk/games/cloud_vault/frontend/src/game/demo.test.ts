import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
it("can retry a missing demo book instead of permanently caching a rejected load", async () => {
  vi.stubGlobal("location", { search: "" });
  const book = { w: 1, criteria: "base", payoutMultiplier: 0, events: [{ index: 0, type: "finalWin", amount: 0 }] };
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ books: [book] }) });
  vi.stubGlobal("fetch", fetcher);
  const { demoRound } = await import("./demo");
  await expect(demoRound("base")).rejects.toThrow("demo books missing");
  expect(await demoRound("base")).toEqual(book);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("parses the base book during loading and reuses it for the first spin", async () => {
  vi.stubGlobal("location", { search: "" });
  const book = { w: 1, criteria: "base", payoutMultiplier: 0, events: [] };
  let release!: (file: unknown) => void;
  const json = vi.fn(() => new Promise((resolve) => { release = resolve; }));
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json });
  vi.stubGlobal("fetch", fetcher);
  const { preloadDemoBase, demoRound } = await import("./demo");
  let ready = false;
  const pending = preloadDemoBase().then(() => { ready = true; });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(ready).toBe(false);
  release({ books: [book] }); await pending;
  expect(await demoRound("base")).toEqual(book);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(json).toHaveBeenCalledTimes(1);
});
