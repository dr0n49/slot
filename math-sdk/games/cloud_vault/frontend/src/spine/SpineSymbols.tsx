import { useEffect, useRef } from "react";
import { Container, type Application } from "pixi.js";
import type { Spine } from "@esotericsoftware/spine-pixi-v8";
import type { Reel } from "../game/board";
import { loadRig, makeApp, makeSpine, spineDisabled } from "./runtime";

/** Book symbol → attachment in the symbols rig (symbol_slot). */
const ATTACH: Record<string, string> = {
  H1: "wand",
  H2: "harp",
  H3: "chalice",
  H4: "scroll_feather",
  L1: "heart",
  L2: "purple_gem",
  L3: "blue_gem",
  L4: "green_gem",
  S: "halo_card",
};
const ART = 512; // symbol attachment size in rig units
const FILL = 0.9; // symbol size relative to the cell

type Mode = "idle" | "win" | "halo" | "pop";
type Tween = { from: number; to: number; start: number; dur: number; ease: (k: number) => number; done?: () => void };
type Entry = { s: Spine; reel: number; row: number; pos: number; mode: Mode | null; out: boolean; tween?: Tween; dieAt?: number };

const easeOutBack = (k: number) => {
  const c = 1.2;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};
const easeIn = (k: number) => k * k * k;

/**
 * Renders the board's symbols as Spine skeletons over the DOM cells (which keep the gold
 * squares). Calls onLive(true) once the rig is running; on any failure the DOM symbols stay.
 */
export function SpineSymbols({
  reels,
  halos,
  onLive,
}: {
  reels: Reel[];
  halos: { reel: number; row: number }[];
  onLive: (live: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ app: Application; layer: Container; cells: Map<number, Entry> } | null>(null);
  const latest = useRef({ reels, halos });
  latest.current = { reels, halos };

  useEffect(() => {
    if (spineDisabled()) return;
    let cancelled = false;
    (async () => {
      try {
        await loadRig("symbols");
        if (cancelled || !host.current) return;
        const app = await makeApp(host.current);
        if (cancelled) return app.destroy(true);
        const layer = new Container();
        app.stage.addChild(layer);
        const cells = new Map<number, Entry>();
        ctx.current = { app, layer, cells };
        app.ticker.add(() => tick());
        sync();
        onLive(true);
      } catch (e) {
        console.warn("Symbol Spine unavailable, using DOM symbols", e);
        onLive(false);
      }
    })();
    return () => {
      cancelled = true;
      ctx.current?.app.destroy(true, { children: true });
      ctx.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => sync());

  function size() {
    const { width: w, height: h } = ctx.current!.app.screen;
    return { cw: w / 5, ch: h / 5 };
  }

  function setMode(e: Entry, m: Mode) {
    if (e.mode === m) return;
    e.mode = m;
    const st = e.s.state;
    if (m === "idle") {
      const t = st.setAnimation(0, "idle", true);
      t.trackTime = (e.s.x * 7 + e.row * 0.37) % 2; // spread the idle phase across the board
    } else if (m === "win") st.setAnimation(0, "win_pulse", true);
    else if (m === "halo") st.setAnimation(0, "halo_anticipation", true);
    else st.setAnimation(0, "destroy_cloud", false);
  }

  function sync() {
    const c = ctx.current;
    if (!c) return;
    const { reels: rs, halos: hs } = latest.current;
    const haloSet = new Set(hs.map((h) => `${h.reel}:${h.row}`));
    const now = performance.now();
    const seen = new Set<number>();
    rs.forEach((reel, r) =>
      reel.cells.forEach((cell, w) => {
        seen.add(cell.id);
        let e = c.cells.get(cell.id);
        if (!e) {
          const s = makeSpine("symbols");
          s.skeleton.setAttachment("symbol_slot", ATTACH[cell.sym] ?? "heart");
          c.layer.addChild(s);
          e = { s, reel: r, row: w, pos: w, mode: null, out: false };
          if (cell.drop > 0) {
            e.pos = w - cell.drop;
            e.tween = { from: w - cell.drop, to: w, start: now + (cell.delay ?? 0), dur: 140 + cell.drop * 65, ease: easeOutBack };
          }
          c.cells.set(cell.id, e);
        } else if (e.row !== w && !e.out) {
          // Survivor falling into the gap left by a tumble.
          e.tween = { from: e.pos, to: w, start: now, dur: 140 + Math.max(1, w - e.row) * 65, ease: easeOutBack };
        }
        e.reel = r;
        e.row = w;
        if (cell.out && !e.out) {
          e.out = true;
          const delay = r * 40 + (4 - w) * 16;
          e.tween = { from: e.pos, to: e.pos + 5.6, start: now + delay, dur: 340, ease: easeIn };
          e.dieAt = now + delay + 360;
        }
        if (cell.pop) {
          setMode(e, "pop");
          e.dieAt = now + 650;
        } else if (cell.win) setMode(e, "win");
        else if (haloSet.has(`${r}:${w}`)) setMode(e, "halo");
        else if (!e.out) setMode(e, "idle");
        const k = cell.dim ? 0.38 : 1;
        e.s.skeleton.color.set(k, k, k, 1);
      }),
    );
    // Cells that left the model: falling-out and bursting ones finish their motion first.
    for (const [id, e] of c.cells) {
      if (seen.has(id)) continue;
      if (e.dieAt === undefined) e.dieAt = now;
    }
  }

  function tick() {
    const c = ctx.current;
    if (!c) return;
    const now = performance.now();
    const { cw, ch } = size();
    const scale = (FILL * Math.min(cw, ch)) / ART;
    for (const [id, e] of c.cells) {
      if (e.dieAt !== undefined && now >= e.dieAt) {
        e.s.destroy();
        c.cells.delete(id);
        continue;
      }
      const t = e.tween;
      if (t) {
        const k = Math.min(1, Math.max(0, (now - t.start) / t.dur));
        e.pos = t.from + (t.to - t.from) * (now < t.start ? 0 : t.ease(k));
        if (k >= 1) e.tween = undefined;
      }
      e.s.scale.set(scale);
      e.s.x = (e.reel + 0.5) * cw;
      e.s.y = (e.pos + 0.5) * ch;
    }
  }

  return <div ref={host} className="spine-symbols" aria-hidden />;
}
