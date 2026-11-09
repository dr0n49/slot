/**
 * Demo mode: plays real books sampled from the published lookup tables
 * (public/demo/books_<mode>.json, made by scripts/demo-books.mjs).
 * ?force=<criteria> (fs_bonus, fs_super, fs_epic, raid, …) picks a book of that criteria;
 * ?force=maxwin picks a capped book.
 */
import type { BookEvent } from "./rgs";
import type { ModeId } from "./modes";

type DemoBook = { w: number; criteria: string; forced?: boolean; payoutMultiplier: number; events: BookEvent[] };
type DemoFile = { mode: string; books: DemoBook[] };

const cache = new Map<ModeId, Promise<DemoFile>>();

function load(mode: ModeId): Promise<DemoFile> {
  if (!cache.has(mode)) {
    cache.set(
      mode,
      fetch(`./demo/books_${mode}.json`).then((r) => {
        // Release packages ship without demo books, so this means the page was opened without sessionID and rgs_url.
        if (!r.ok || r.headers?.get("content-type")?.includes("html")) {
          throw new Error(`demo books missing for ${mode}: no sessionID and rgs_url in the URL, and no demo books in this build`);
        }
        return r.json() as Promise<DemoFile>;
      }).catch((e) => {
        cache.delete(mode);
        throw e;
      }),
    );
  }
  return cache.get(mode)!;
}

/** Parse the large base demo file before play is offered, then reuse the existing book cache. */
export async function preloadDemoMode(mode: ModeId): Promise<void> { await load(mode); }
export async function preloadDemoBase(): Promise<void> { await preloadDemoMode("base"); }

export async function demoRound(mode: ModeId): Promise<{ payoutMultiplier: number; events: BookEvent[] }> {
  const file = await load(mode);
  const force = new URLSearchParams(location.search).get("force");
  // Repeat a real multi-group/cascade book for visual payout QA, local dev only.
  if (import.meta.env.DEV && force === "payout_multi") {
    const book = file.books.find((b) =>
      b.events.some((e) => e.type === "winInfo" && (e.wins as unknown[]).length > 1) &&
      b.events.filter((e) => e.type === "winInfo").length > 1,
    );
    if (book) return book;
  }
  if (force) {
    // bigwin: a base round that reaches the Big Win screen without a bonus (QA of the win screens in play).
    const pool = file.books.filter((b) => (force === "maxwin" ? b.payoutMultiplier >= 2_500_000
      : force === "bigwin" ? b.payoutMultiplier >= 2000 && !b.events.some((e) => e.type === "featureStart")
      : b.criteria === force));
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  const pool = file.books.filter((b) => !b.forced);
  const total = pool.reduce((s, b) => s + b.w, 0);
  let x = Math.random() * total;
  for (const b of pool) {
    x -= b.w;
    if (x <= 0) return b;
  }
  return pool[pool.length - 1];
}
