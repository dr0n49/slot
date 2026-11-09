import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { fromReveal, popWins, type Reel } from "./board";
import { CLOUD, SPIN, cloudCollapseAt, spinEase } from "./presentation";
import { playBook, type View } from "./player";
import type { BookEvent } from "./rgs";

// Real books come from `npm run demo-books` (public/demo is gitignored); without them these tests skip.
const demoBooks = (mode: string) => join(__dirname, "../../public/demo", `books_${mode}.json`);
const hasDemo = (mode: string) => existsSync(demoBooks(mode));

it("lifts a spinning strip smoothly and brakes into its exact destination", () => {
  const turn = SPIN.liftMs / SPIN.inDuration;
  expect(spinEase(0)).toBeCloseTo(0);
  expect(spinEase(turn) * SPIN.rows).toBeCloseTo(-SPIN.liftRows);
  expect(spinEase(1)).toBeCloseTo(1);
  for (let k = turn; k < 0.99; k += 0.01) expect(spinEase(k + 0.01)).toBeGreaterThan(spinEase(k));
  expect(spinEase(1) - spinEase(0.99)).toBeLessThan(spinEase(0.51) - spinEase(0.5));
});

it.each([1, 0.45])("keeps the cloud cut covered with 1–25 popped cells at motion scale %s", (speed) => {
  const reels = fromReveal(Array.from({ length: 5 }, () => Array.from({ length: 7 }, () => ({ name: "H1" }))), false);
  const positions = Array.from({ length: 25 }, (_, i) => ({ reel: Math.floor(i / 5), row: i % 5 + 1 }));
  for (let count = 1; count <= 25; count++) {
    const popped = popWins(reels, positions.slice(0, count), speed).flatMap((r) => r.cells).filter((c) => c.pop);
    const cut = cloudCollapseAt(count, speed);
    expect(popped).toHaveLength(count);
    for (const c of popped) {
      expect(c.fxScale).toBe(speed);
      const peak = ((c.fxDelay ?? 0) + CLOUD.peak) * speed;
      const finish = ((c.fxDelay ?? 0) + CLOUD.finish) * speed;
      expect(cut).toBeGreaterThan(peak);
      expect(cut).toBeLessThan(finish);
    }
  }
});
it.skipIf(!hasDemo("base"))("waits for every falling cell, retains real payout and synchronizes landing sound with the completed fall", async () => {
  const books = JSON.parse(readFileSync(demoBooks("base"), 'utf8')).books;
  const book = books.find((b: { events: BookEvent[] }) => b.events.filter((e) => e.type === 'winInfo').length > 2 && !b.events.some((e) => e.type === 'featureStart'));
  for (const speed of [1, .45]) {
    let clock = 0, reels: Reel[] = [], fallingEnd = 0, falls = 0, cascade = false;
    const view = {
      reels: () => reels,
      setReels: (next: Reel[]) => {
        if (next.some((r) => r.cells.some((c) => c.pop))) cascade = true;
        const falling = next.flatMap((r) => r.cells).filter((c) => c.drop > 0);
        if (!falling.length && fallingEnd) { expect(clock + .001).toBeGreaterThanOrEqual(fallingEnd); fallingEnd = 0; }
        // Explicit durations identify reveal / tumble falls, not static idle state.
        if (falling.length && falling.some((c) => c.duration !== undefined)) {
          fallingEnd = clock + Math.max(...falling.map((c) => (c.delay ?? 0) + (c.duration ?? 0)));
          falls++;
        }
        reels = next;
      },
      feature: () => null, setFeature: () => {}, setRoundWin: () => {}, setPanel: () => {}, setLabels: () => {},
      setHalos: () => {}, setPlus: () => {}, setAnticipation: () => {}, setOverlay: () => {},
      sleep: async (ms: number, scale?: number) => { clock += ms * (scale ?? speed); },
      tap: async () => {}, sound: (name: string) => { if (name === "drop" && cascade && fallingEnd) { expect(clock + .001).toBeGreaterThanOrEqual(fallingEnd); cascade = false; } }, motionScale: () => speed,
    } as View;
    expect(await playBook(book.events, view, 1)).toBe(book.payoutMultiplier / 100);
    expect(falls).toBeGreaterThan(0);
  }
});
