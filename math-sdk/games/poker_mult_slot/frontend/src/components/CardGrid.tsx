import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Card, Rank, Suit } from "../game/engine";
import { cardFaceUrl, jokerFaceUrl } from "../game/assets";
import { audio } from "../game/audio";
import { winGrade, beamStrokePx, beamOutlineExtraPx, type WinGrade } from "../game/winFx";

const COLS = 5;
const ROWS = 5;

type WinLine = { id: number; indices: number[] };

type Props = {
  /** 25 board cards, index r*5+c (row-major) */
  cards: Card[];
  dealKey: number;
  turbo?: boolean;
  /** Bump to force-snap all spinning reels (Stop button). */
  reelSkipKey?: number;
  /** Fired once when every column has snapped (natural or skip). */
  onReelsSettled?: () => void;
  /** Per-cell multiplier faces, length 25 */
  multipliers?: number[];
  /** Union of winning line cells — outlined once the deal settles */
  winIndices?: number[];
  /** Paying lines — gold beam ribbons (staggered) */
  winLines?: WinLine[];
  /** Ribbon on golden cells */
  goldCaption?: string;
  /** 3/4/5 goldens — scale-up lock before bonus continues */
  goldCelebrate?: boolean;
  /** True when this spin triggered FS (3+ gold) — keep goldens bright even off-line */
  bonusTriggered?: boolean;
  /** Cash win for this spin — punched on the winning cluster after stop */
  winCash?: number;
  /** Format cash for the field punch overlay */
  formatCash?: (n: number) => string;
  /** Stake-multiples for this spin — grades glow / sparks / shake */
  spinWinX?: number;
  /** Fired true when the "bonus could still drop" build-up starts, false when it ends. */
  onAnticipation?: (active: boolean) => void;
};

type GridGeom = {
  tw: number;
  th: number;
  gap: number;
  padY: number;
  w: number;
  h: number;
};

const RANK_CYCLE: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"];
const SUIT_CYCLE: Suit[] = ["S", "H", "D", "C"];

function randomCycleFace(): { rank: Rank; suit: Suit } {
  return {
    rank: RANK_CYCLE[(Math.random() * RANK_CYCLE.length) | 0],
    suit: SUIT_CYCLE[(Math.random() * SUIT_CYCLE.length) | 0],
  };
}

/**
 * Column-0 total spin (A+B+C). Later columns add stop-stagger only.
 */
export function reelSpinMs(turbo: boolean): number {
  return turbo ? 520 : 720;
}

/** Delay between adjacent columns starting phase C (L→R). */
export function columnStopGapMs(turbo: boolean): number {
  return turbo ? 70 : 100;
}

export function reelRampMs(turbo: boolean): number {
  return turbo ? 80 : 130;
}

export function reelDecelMs(turbo: boolean): number {
  return turbo ? 150 : 210;
}

/** Filler symbols below the finals — long enough that the strip never looks short. */
function reelFillerCount(turbo: boolean): number {
  return turbo ? 14 : 20;
}

/** Extra hold per remaining reel once two jokers are already down. */
function anticipationStepMs(turbo: boolean): number {
  return turbo ? 200 : 560;
}

export type AnticipationPlan = {
  /** Column freeze times (ms after the deal starts), anticipation stretch included. */
  stops: number[];
  /** True when 2 jokers have landed and at least one reel is still free to drop a third. */
  active: boolean;
  /** When the build-up begins = the moment the 2nd joker lands (ms). */
  startMs: number;
  /** Reels still spinning at that moment (they get the "hot" frame). */
  hotCols: number[];
};

/**
 * Column stop schedule + bonus anticipation.
 * At most one joker sits in a column, so once the 2nd joker has landed every
 * reel to its right can still bring the 3rd: those reels are held longer and
 * lit up ("hot") until they stop.
 */
export function anticipationPlan(cards: { golden?: boolean }[], turbo: boolean): AnticipationPlan {
  const spin = reelSpinMs(turbo);
  const colGap = columnStopGapMs(turbo);
  const step = anticipationStepMs(turbo);
  const stops: number[] = [];
  let jokers = 0;
  let annCol = -1;
  for (let c = 0; c < COLS; c++) {
    if (annCol < 0) {
      for (let r = 0; r < ROWS; r++) if (cards[r * COLS + c]?.golden) jokers += 1;
      // (a column holds at most one joker, so the count grows by ≤1 per column)
      if (jokers >= 2 && c < COLS - 1) annCol = c;
    }
    const extra = annCol >= 0 && c > annCol ? (c - annCol) * step : 0;
    stops.push(spin + c * colGap + extra);
  }
  if (annCol < 0) return { stops, active: false, startMs: 0, hotCols: [] };
  const hotCols: number[] = [];
  for (let c = annCol + 1; c < COLS; c++) hotCols.push(c);
  return { stops, active: true, startMs: stops[annCol], hotCols };
}

/**
 * Freeze times per cell (column-shared). All columns start together;
 * phase-C / stop is staggered L→R, with the bonus-anticipation hold.
 */
export function dealDelaysMs(cards: { golden?: boolean }[], turbo: boolean): number[] {
  const { stops } = anticipationPlan(cards, turbo);
  const delays = new Array(cards.length).fill(0);
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) delays[r * COLS + c] = stops[c];
  }
  return delays;
}

/** Last column freeze. */
export function dealDurationMs(cards: { golden?: boolean }[], turbo: boolean): number {
  const delays = dealDelaysMs(cards, turbo);
  return Math.max(0, ...delays) + 16;
}

/**
 * Distance along the reel (0→travel) for a three-phase velocity profile:
 * ease-in ramp → constant → ease-out decel. No overshoot.
 */
function reelDistanceAt(
  tMs: number,
  durationMs: number,
  travel: number,
  rampMs: number,
  decelMs: number,
): number {
  if (travel <= 0 || durationMs <= 0) return travel;
  const t = Math.min(durationMs, Math.max(0, tMs));
  const ramp = Math.min(rampMs, durationMs * 0.35);
  const decel = Math.min(decelMs, durationMs * 0.45);
  const cruiseStart = ramp;
  const cruiseEnd = Math.max(cruiseStart, durationMs - decel);
  const cruiseDur = cruiseEnd - cruiseStart;
  // Linear velocity ramp/decel ⇒ area = vMax * (0.5*ramp + cruise + 0.5*decel)
  const denom = 0.5 * ramp + cruiseDur + 0.5 * (durationMs - cruiseEnd);
  const vMax = travel / Math.max(1e-6, denom);

  if (t <= ramp) {
    const u = t / Math.max(1e-6, ramp);
    // cubic ease-in on velocity share ≈ u² integrated → u³/3 scaled to 0.5*vMax*ramp
    return 0.5 * vMax * ramp * u * u;
  }
  const sRamp = 0.5 * vMax * ramp;
  if (t <= cruiseEnd) {
    return sRamp + vMax * (t - ramp);
  }
  const sCruise = sRamp + vMax * cruiseDur;
  const decelDur = durationMs - cruiseEnd;
  const u = (t - cruiseEnd) / Math.max(1e-6, decelDur);
  // cubic ease-out over remaining distance (lands exactly on travel, no bounce)
  const remaining = travel - sCruise;
  return sCruise + remaining * (1 - (1 - u) * (1 - u) * (1 - u));
}

/** Pause after the last column settles before any win FX (glow / line / dim). */
export function winFxPauseMs(turbo: boolean): number {
  return turbo ? 150 : 220;
}

/**
 * Time after the deal for post-settle pause + glow lead-in + every win beam.
 * Soft grade still draws a thin trail so horizontal-only pays aren't silent.
 */
export function beamRevealHoldMs(
  lineCount: number,
  turbo: boolean,
  grade: WinGrade | null = "mid",
): number {
  if (lineCount <= 0) return 0;
  const pause = winFxPauseMs(turbo) / 1000;
  const glowLead = turbo ? 0.12 : 0.2;
  const sweepStep = turbo ? 0.14 : 0.22;
  const drawSec = turbo ? 0.22 : 0.3;
  const lingerSec =
    grade === "soft" ? (turbo ? 0.28 : 0.4) : turbo ? 0.22 : 0.35;
  return Math.round(
    (pause + glowLead + (lineCount - 1) * sweepStep + drawSec + lingerSec) * 1000,
  );
}

function cellCenter(i: number, g: GridGeom): { x: number; y: number } {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  return {
    x: c * (g.tw + g.gap) + g.tw / 2,
    y: g.padY + r * (g.th + g.gap) + g.th / 2,
  };
}

/** Centers for a payline — shared by every direction. */
function lineCenters(indices: number[], g: GridGeom) {
  return indices.map((i) => cellCenter(i, g));
}

/**
 * SOURCE OF TRUTH — gold light-beam visual style (first shipped look / reference screenshot).
 * Do NOT restyle glow / gradient / opacity when fixing geometry bugs.
 *
 * Style lock:
 *  - stroked <path> with strokeLinecap="round" (no end circles / blur blobs)
 *  - gradient light gold → cream → light gold
 *  - soft halo: tight CSS drop-shadow on gold only (keeps #000 outline pure)
 *  - strokeOpacity ~0.65–0.75 so card art reads through
 *  - thin pure-black (#000000) under-stroke: +2–4 CSS px total (1–2px/side)
 *  - gold stroke is opaque so black only shows as the outer hairline rim
 *
 * Geometry-only fixes allowed: endpoint choice, axis-aligned cull nudges.
 */

/** Outward overhang past end-card centers — fraction of tile width (not line length). */
const BEAM_END_OVERHANG = 0.22;

function clampBeamPoint(p: { x: number; y: number }, g: GridGeom) {
  return {
    x: Math.min(g.w, Math.max(0, p.x)),
    y: Math.min(g.h, Math.max(0, p.y)),
  };
}

/** Unit vector from `from` → `to`; tiny fallback keeps Chromium from culling H strokes. */
function unitToward(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

/**
 * Full payline polyline through every cell center, ends extended ~22% tile.
 * Multi-segment paths keep horizontal rows from collapsing to a zero-height
 * stroke (Chromium cull) the way a single H segment can.
 */
function beamPoints(indices: number[], g: GridGeom) {
  const pts = lineCenters(indices, g);
  if (pts.length < 2) return null;

  const overhang = g.tw * BEAM_END_OVERHANG;
  const outA = unitToward(pts[1], pts[0]);
  const outB = unitToward(pts[pts.length - 2], pts[pts.length - 1]);

  const a = clampBeamPoint(
    { x: pts[0].x + outA.x * overhang, y: pts[0].y + outA.y * overhang },
    g,
  );
  const b = clampBeamPoint(
    {
      x: pts[pts.length - 1].x + outB.x * overhang,
      y: pts[pts.length - 1].y + outB.y * overhang,
    },
    g,
  );

  // Tiny axis nudge so perfectly flat H/V strokes still get a paint box.
  const mid = pts.slice(1, -1).map((p) => {
    if (Math.abs(b.y - a.y) < 0.01) return { x: p.x, y: p.y + 0.35 };
    if (Math.abs(b.x - a.x) < 0.01) return { x: p.x + 0.35, y: p.y };
    return p;
  });
  const start =
    Math.abs(b.y - a.y) < 0.01
      ? { x: a.x, y: a.y + 0.35 }
      : Math.abs(b.x - a.x) < 0.01
        ? { x: a.x + 0.35, y: a.y }
        : a;
  const end =
    Math.abs(b.y - a.y) < 0.01
      ? { x: b.x, y: b.y + 0.35 }
      : Math.abs(b.x - a.x) < 0.01
        ? { x: b.x + 0.35, y: b.y }
        : b;

  return [start, ...mid, end];
}

function beamStrokePath(indices: number[], g: GridGeom): string {
  const pts = beamPoints(indices, g);
  if (!pts || pts.length < 2) return "";
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

function beamEndpoints(indices: number[], g: GridGeom) {
  const pts = beamPoints(indices, g);
  if (!pts || pts.length < 2) return null;
  return { a: pts[0], b: pts[pts.length - 1] };
}

function readGeom(el: HTMLElement): GridGeom {
  const cs = getComputedStyle(el);
  const tw = parseFloat(cs.getPropertyValue("--tile-w")) || 55.5;
  const th = parseFloat(cs.getPropertyValue("--tile-h")) || 78;
  const gap = parseFloat(cs.getPropertyValue("--grid-gap")) || 6;
  const padY = parseFloat(cs.getPropertyValue("--reel-pad-y")) || 16;
  const contentH = ROWS * th + (ROWS - 1) * gap;
  return {
    tw,
    th,
    gap,
    padY,
    w: COLS * tw + (COLS - 1) * gap,
    h: contentH + padY * 2,
  };
}

type StripFace = { rank: Rank; suit: Suit; golden?: boolean };

function ReelFace({
  card,
  mult,
  goldCaption,
  settled,
  className,
}: {
  card: StripFace;
  mult?: number;
  goldCaption?: string;
  settled: boolean;
  className?: string;
}) {
  const gold = !!card.golden && settled;
  const showMult = settled && !card.golden && (mult ?? 0) > 0;
  const redSuit = card.suit === "H" || card.suit === "D";
  return (
    <div
      className={`reel-symbol card-tile${gold ? " is-gold" : ""}${className ? ` ${className}` : ""}`}
      data-suit={card.suit}
      data-suit-tone={redSuit ? "red" : "black"}
      data-caption={gold ? goldCaption : undefined}
    >
      <div className={`card-face-static ${gold ? "bonus-card" : "card-face"}`}>
        <img
          src={gold ? jokerFaceUrl() : cardFaceUrl(card.rank, card.suit)}
          alt=""
          className="card-face-img"
          draggable={false}
          aria-hidden
        />
        {gold ? <span className="bonus-drop-flash" aria-hidden /> : null}
        {showMult ? <div className="bonus-ribbon bonus-ribbon-mult">×{Math.round(mult!)}</div> : null}
      </div>
    </div>
  );
}

/**
 * One vertical reel: strip scrolls TOP→BOTTOM (translateY increases),
 * three phases (ramp / cruise / decel), exact cell snap, no bounce/blur.
 *
 * Strip layout (top→bottom): [final×5, ...fillers].
 * Start Y = −fillers·pitch (finals above the window); end Y = 0 (finals seated).
 */
function ReelColumn({
  col,
  finals,
  mults,
  stopMs,
  dealKey,
  turbo,
  skipKey,
  goldCaption,
  winFxOn,
  winSet,
  goldCelebrate,
  bonusTriggered,
  hotFromMs,
  onColumnStop,
}: {
  col: number;
  finals: Card[];
  mults: number[];
  stopMs: number;
  dealKey: number;
  turbo: boolean;
  skipKey: number;
  goldCaption?: string;
  winFxOn: boolean;
  winSet: Set<number>;
  goldCelebrate?: boolean;
  bonusTriggered?: boolean;
  /** Set when this reel is held for the bonus build-up: ms after deal start the glow begins. */
  hotFromMs?: number;
  onColumnStop?: (col: number) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef(false);
  const onStopRef = useRef(onColumnStop);
  onStopRef.current = onColumnStop;
  // Read at deal time only: toggling TURBO must never restart a settled reel.
  const turboRef = useRef(turbo);
  turboRef.current = turbo;
  const stopMsRef = useRef(stopMs);
  stopMsRef.current = stopMs;
  const [settled, setSettled] = useState(false);
  const [strip] = useState<StripFace[]>(() => {
    const fillers: StripFace[] = Array.from({ length: reelFillerCount(turbo) }, () =>
      randomCycleFace(),
    );
    // Finals first (top of strip) so increasing translateY brings them down into view.
    return [
      ...finals.map((c) => ({ rank: c.rank, suit: c.suit, golden: c.golden })),
      ...fillers,
    ];
  });
  const fillerN = strip.length - ROWS;

  const land = (el: HTMLDivElement) => {
    if (settledRef.current) return;
    settledRef.current = true;
    el.style.transform = "translate3d(0, 0, 0)";
    setSettled(true);
    onStopRef.current?.(col);
  };

  useLayoutEffect(() => {
    const el = stripRef.current;
    const colEl = colRef.current;
    if (!el || !colEl) return;

    let alive = true;
    let raf = 0;
    settledRef.current = false;
    setSettled(false);

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cs = getComputedStyle(colEl.parentElement ?? colEl);
    const th = parseFloat(cs.getPropertyValue("--tile-h")) || 78;
    const gap = parseFloat(cs.getPropertyValue("--grid-gap")) || 6;
    const pitch = th + gap;
    const travel = fillerN * pitch;
    // Start with finals ABOVE the viewport; animate Y upward (less negative → 0) = symbols move down.
    const startY = -travel;
    const duration = Math.max(160, stopMsRef.current);
    const ramp = reelRampMs(turboRef.current);
    const decel = reelDecelMs(turboRef.current);

    if (reduce || travel <= 0 || dealKey === 0) {
      // Initial board paint — seated, no boot-time spin.
      el.style.transform = "translate3d(0, 0, 0)";
      settledRef.current = true;
      setSettled(true);
      return;
    }

    el.style.transform = `translate3d(0, ${startY}px, 0)`;
    const t0 = performance.now();

    const tick = (now: number) => {
      if (!alive || settledRef.current) return;
      const elapsed = now - t0;
      const dist = reelDistanceAt(elapsed, duration, travel, ramp, decel);
      const y = startY + dist; // increases toward 0
      el.style.transform = `translate3d(0, ${y}px, 0)`;
      if (elapsed < duration) {
        raf = requestAnimationFrame(tick);
      } else {
        land(el);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey, fillerN, col]);

  // Forced Stop — snap every still-spinning column to finals immediately.
  useLayoutEffect(() => {
    if (skipKey <= 0 || settledRef.current) return;
    const el = stripRef.current;
    if (!el) return;
    land(el);
  }, [skipKey, col]);

  return (
    <div ref={colRef} className="reel-col">
      {hotFromMs != null && !settled ? (
        <div
          className="reel-hot"
          aria-hidden
          style={
            {
              "--hot-delay": `${hotFromMs}ms`,
              "--hot-dur": `${Math.max(120, stopMs - hotFromMs)}ms`,
            } as CSSProperties
          }
        />
      ) : null}
      <div className="reel-viewport">
        <div ref={stripRef} className={`reel-strip${settled ? " is-settled" : " is-spinning"}`}>
          {strip.map((face, i) => {
            const isFinal = i < ROWS;
            const row = isFinal ? i : -1;
            const boardIdx = row >= 0 ? row * COLS + col : -1;
            const win = winFxOn && boardIdx >= 0 && winSet.has(boardIdx);
            const gold = isFinal && !!finals[row]?.golden;
            const dim =
              winFxOn &&
              boardIdx >= 0 &&
              !winSet.has(boardIdx) &&
              !(gold && bonusTriggered);
            const celebrate = gold && !!goldCelebrate && settled;
            return (
              <ReelFace
                key={`${dealKey}-${col}-${i}`}
                card={isFinal ? finals[row]! : face}
                mult={isFinal ? mults[row] : undefined}
                goldCaption={goldCaption}
                settled={settled && isFinal}
                className={[
                  isFinal ? "grid-cell relative" : "",
                  win ? "card-win is-win" : "",
                  dim ? "is-dim" : "",
                  celebrate ? "gold-celebrate" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Thin translucent payline trail — drawn after winning faces glow.
 */
function GoldBeams({
  winLines,
  dealKey,
  turbo,
  geom,
  grade,
  spinWinX,
}: {
  winLines: WinLine[];
  dealKey: number;
  turbo: boolean;
  geom: GridGeom;
  grade: WinGrade | null;
  spinWinX: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pxScale, setPxScale] = useState(1);

  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el || geom.w <= 0) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      setPxScale(w > 0 ? w / geom.w : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [geom.w, geom.h, dealKey]);

  if (winLines.length === 0 || geom.w <= 0) return null;

  const soft = grade === "soft";
  const big = grade === "big";
  const stroke = beamStrokePx(spinWinX, geom.tw);
  const outlineExtra = beamOutlineExtraPx(spinWinX) / Math.max(pxScale, 0.05);
  const outlineWidth = stroke + outlineExtra;
  const glowLead = turbo ? 0.12 : 0.2;
  const sweepStep = turbo ? 0.14 : 0.22;
  const drawDur = turbo ? 0.22 : 0.3;
  const uid = `gb-${dealKey}`;
  const gradeClass = soft ? " is-soft" : big ? " is-big" : " is-mid";
  const outlineOpacity = soft ? 0.55 : big ? 0.9 : 0.78;

  return (
    <svg
      ref={svgRef}
      className={`gold-beam-layer${gradeClass}`}
      viewBox={`0 0 ${geom.w} ${geom.h}`}
      width={geom.w}
      height={geom.h}
      overflow="visible"
      aria-hidden
    >
      <defs>
        {winLines.map((line) => {
          const ends = beamEndpoints(line.indices, geom);
          if (!ends) return null;
          const { a, b } = ends;
          let x2 = b.x;
          let y2 = b.y;
          if (Math.abs(x2 - a.x) < 0.01) x2 = a.x + 0.01;
          if (Math.abs(y2 - a.y) < 0.01) y2 = a.y + 0.01;
          return (
            <linearGradient
              key={`g-${line.id}`}
              id={`${uid}-grad-${line.id}`}
              gradientUnits="userSpaceOnUse"
              x1={a.x}
              y1={a.y}
              x2={x2}
              y2={y2}
            >
              <stop offset="0%" stopColor="#FFD84A" stopOpacity="0.92" />
              <stop offset="50%" stopColor="#FFF6C8" stopOpacity="1" />
              <stop offset="100%" stopColor="#FFD84A" stopOpacity="0.92" />
            </linearGradient>
          );
        })}
      </defs>

      {/* Outlines first — crossings stay dark under gold, no washout. */}
      {winLines.map((line, n) => {
        const d = beamStrokePath(line.indices, geom);
        if (!d) return null;
        const delay = `${glowLead + n * sweepStep}s`;
        return (
          <path
            key={`beam-out-${dealKey}-${line.id}`}
            className="gold-beam-outline"
            d={d}
            fill="none"
            stroke="#0A0610"
            strokeWidth={outlineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={outlineOpacity}
            pathLength={1}
            style={
              {
                ["--sweep-delay" as string]: delay,
                ["--draw-dur" as string]: `${drawDur}s`,
              } as CSSProperties
            }
          />
        );
      })}

      {/* Gold fills — equal opacity on every line, drawn after outlines. */}
      {winLines.map((line, n) => {
        const d = beamStrokePath(line.indices, geom);
        if (!d) return null;
        const delay = `${glowLead + n * sweepStep}s`;
        return (
          <path
            key={`beam-gold-${dealKey}-${line.id}`}
            className="gold-beam-path"
            d={d}
            fill="none"
            stroke={`url(#${uid}-grad-${line.id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            style={
              {
                ["--sweep-delay" as string]: delay,
                ["--draw-dur" as string]: `${drawDur}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </svg>
  );
}

/** 5×5 card grid slot: 5 horizontal paylines + 2 long diagonals. */
export function CardGrid({
  cards,
  dealKey,
  turbo,
  reelSkipKey = 0,
  onReelsSettled,
  multipliers = [],
  winIndices = [],
  winLines = [],
  goldCaption,
  goldCelebrate,
  bonusTriggered,
  winCash = 0,
  formatCash,
  spinWinX = 0,
  onAnticipation,
}: Props) {
  const winSet = new Set(winIndices);
  const hasWin = winIndices.length > 0;
  const grade: WinGrade | null = hasWin ? winGrade(spinWinX) : null;
  const plan = anticipationPlan(cards, !!turbo);
  const delays = dealDelaysMs(cards, !!turbo);
  const turboRef = useRef(!!turbo);
  turboRef.current = !!turbo;
  const gridRef = useRef<HTMLDivElement>(null);
  const onAnticipationRef = useRef(onAnticipation);
  onAnticipationRef.current = onAnticipation;
  const [hot, setHot] = useState(false);
  const stoppedColsRef = useRef(new Set<number>());
  const onReelsSettledRef = useRef(onReelsSettled);
  onReelsSettledRef.current = onReelsSettled;
  const [allReelsStopped, setAllReelsStopped] = useState(true);
  const [geom, setGeom] = useState<GridGeom>(() => ({
    tw: 55.5,
    th: 78,
    gap: 6,
    padY: 16,
    w: COLS * 55.5 + (COLS - 1) * 6,
    h: ROWS * 78 + (ROWS - 1) * 6 + 32,
  }));
  const [missPulse, setMissPulse] = useState(false);
  /** Win FX arms only after every column has settled + a short breath pause. */
  const [winFxOn, setWinFxOn] = useState(false);

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const update = () => setGeom(readGeom(el));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dealKey]);

  useEffect(() => {
    if (dealKey === 0) {
      setAllReelsStopped(true);
      return;
    }
    stoppedColsRef.current = new Set();
    setAllReelsStopped(false);
    setWinFxOn(false);
  }, [dealKey]);

  // Bonus build-up: 2 jokers are down and a reel can still bring the 3rd.
  useEffect(() => {
    setHot(false);
    if (dealKey === 0 || !plan.active) return;
    const endMs = plan.stops[COLS - 1];
    const t = window.setTimeout(() => {
      setHot(true);
      onAnticipationRef.current?.(true);
      audio.playAnticipation(endMs - plan.startMs);
    }, plan.startMs);
    return () => {
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey]);

  const handleColumnStop = (col: number) => {
    if (stoppedColsRef.current.has(col)) return;
    stoppedColsRef.current.add(col);
    audio.playReelStop(col);
    if (stoppedColsRef.current.size >= COLS) {
      audio.stopReelSpinLoop();
      audio.stopAnticipation();
      setHot(false);
      onAnticipationRef.current?.(false);
      setAllReelsStopped(true);
      onReelsSettledRef.current?.();
    }
  };

  useEffect(() => {
    if (!hasWin || !allReelsStopped) {
      if (!hasWin) setWinFxOn(false);
      return;
    }
    const wait = winFxPauseMs(!!turboRef.current);
    const t = window.setTimeout(() => setWinFxOn(true), wait);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey, hasWin, allReelsStopped]);

  // Soft “empty spin” sway after the deal when nothing paid.
  useEffect(() => {
    setMissPulse(false);
    if (hasWin || spinWinX > 0 || spinWinX < 0 || !allReelsStopped) return;
    const start = window.setTimeout(() => setMissPulse(true), 40);
    const end = window.setTimeout(() => setMissPulse(false), 920);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(end);
    };
  }, [dealKey, hasWin, spinWinX, allReelsStopped]);

  const sparkCount = winFxOn && grade === "big" ? 22 : 0;

  // Centroid of paying cells — punch the cash number on the cluster.
  const fieldPunch =
    winFxOn && winCash > 0 && formatCash && winIndices.length > 0
      ? (() => {
          let sx = 0;
          let sy = 0;
          for (const i of winIndices) {
            const c = i % COLS;
            const r = Math.floor(i / COLS);
            sx += c * (geom.tw + geom.gap) + geom.tw / 2;
            sy += geom.padY + r * (geom.th + geom.gap) + geom.th / 2;
          }
          const n = winIndices.length;
          return { x: sx / n, y: sy / n, label: formatCash(winCash) };
        })()
      : null;

  return (
    <div
      className={`playfield-board${winFxOn && grade === "big" ? " is-win-shake" : ""}`}
      data-celebrating={goldCelebrate ? "1" : "0"}
      data-win-grade={winFxOn ? grade ?? undefined : undefined}
    >
      <div className="card-grid-shell">
        <div
          ref={gridRef}
          className={`card-grid${winFxOn ? " is-win-reveal" : ""}${missPulse ? " is-miss-pulse" : ""}${hot ? " is-hot" : ""}`}
          data-turbo={turbo ? "1" : "0"}
          data-win-grade={winFxOn ? grade ?? undefined : undefined}
        >
          {Array.from({ length: COLS }, (_, c) => {
            const finals: Card[] = [];
            const mults: number[] = [];
            for (let r = 0; r < ROWS; r++) {
              const i = r * COLS + c;
              finals.push(cards[i]!);
              mults.push(multipliers[i] ?? 0);
            }
            return (
              <ReelColumn
                key={`${dealKey}-col-${c}`}
                col={c}
                finals={finals}
                mults={mults}
                stopMs={delays[c] ?? reelSpinMs(!!turbo)}
                dealKey={dealKey}
                turbo={!!turbo}
                skipKey={reelSkipKey}
                goldCaption={goldCaption}
                winFxOn={winFxOn}
                winSet={winSet}
                goldCelebrate={goldCelebrate}
                bonusTriggered={bonusTriggered}
                hotFromMs={plan.active && plan.hotCols.includes(c) ? plan.startMs : undefined}
                onColumnStop={handleColumnStop}
              />
            );
          })}
        </div>

        {winFxOn ? (
          <GoldBeams
            winLines={winLines}
            dealKey={dealKey}
            turbo={!!turbo}
            geom={geom}
            grade={grade}
            spinWinX={spinWinX}
          />
        ) : null}

        {fieldPunch ? (
          <div
            key={`field-win-${dealKey}`}
            className="field-win-punch"
            style={{ left: fieldPunch.x, top: fieldPunch.y }}
            aria-hidden
          >
            {fieldPunch.label}
          </div>
        ) : null}

        {sparkCount > 0 ? (
          <div className={`win-sparks win-sparks-${grade}`} aria-hidden>
            {Array.from({ length: sparkCount }, (_, i) => (
              <span
                key={`${dealKey}-spark-${i}`}
                className="win-spark"
                style={{ ["--spark-i" as string]: String(i), ["--spark-n" as string]: String(sparkCount) }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
