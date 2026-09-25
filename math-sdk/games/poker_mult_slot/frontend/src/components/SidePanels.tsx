import { useLayoutEffect, useRef, useState } from "react";
import { formatLinePay } from "../game/engine";
import type { Copy } from "../game/social";

const HAND_ROWS: Array<{ idx: number; name: (c: Copy) => string }> = [
  { idx: 9, name: (c) => c.royalFlush },
  { idx: 8, name: (c) => c.straightFlush },
  { idx: 7, name: (c) => c.fourOfAKind },
  { idx: 6, name: (c) => c.fullHouse },
  { idx: 5, name: (c) => c.flush },
  { idx: 4, name: (c) => c.straight },
  { idx: 3, name: (c) => c.threeOfAKind },
  { idx: 2, name: (c) => c.twoPair },
  { idx: 1, name: (c) => c.jacksOrBetter },
];

/** Localized hand name for a handIndex (1 = Jacks or Better … 9 = Royal Flush). */
export function handNameFor(copy: Copy, handIndex: number): string {
  return HAND_ROWS.find((h) => h.idx === handIndex)?.name(copy) ?? "";
}

/** A hand that paid on the last deal: its row lights up once the reels have stopped. */
export type HandHit = { handIndex: number; cash: number };

/**
 * Landscape-only side plaque next to the tall 5×5 board: hand pays on the
 * right. Portrait hides it
 * (CSS) — the phone layout has no spare width.
 *
 * Winning hands light up (background + yellow text) once App hands over `hits`, which it does only
 * after the reels have stopped, so the eye connects the board → the plaque.
 */
export function SidePanels({
  copy,
  hits = [],
  dealKey = 0,
  soft = false,
}: {
  copy: Copy;
  hits?: HandHit[];
  dealKey?: number;
  /** The spin paid less than the stake: keep the bulbs lit but skip the flare. */
  soft?: boolean;
}) {
  const hitMap = new Map<number, number>();
  for (const h of hits) hitMap.set(h.handIndex, (hitMap.get(h.handIndex) ?? 0) + h.cash);
  const winning = hitMap.size > 0;
  return (
    <>
      {/* stable element (no key): remounting would restart the marquee chase on every spin */}
      <aside
        className={`side-panel side-panel-right${winning ? " is-winning" : ""}${winning && soft ? " is-soft-win" : ""}`}
        aria-hidden
      >
        <MarqueeRing />
        <div className="side-panel-title">{copy.gameInfo.handsTitle}</div>
        <div className="side-hands">
          {HAND_ROWS.map((h) => {
            const hit = hitMap.has(h.idx);
            return (
              <div
                key={hit ? `${h.idx}-${dealKey}` : h.idx}
                className={`side-hand${h.idx === 9 ? " is-top" : ""}${hit ? " is-hit" : ""}`}
              >
                <span className="side-hand-name">{h.name(copy)}</span>
                <span className="side-hand-dots" />
                <span className="side-hand-pay">{formatLinePay(h.idx)}</span>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

type Bulb = { x: number; y: number; small: boolean; p: number };

/** Distance from the plaque's padding box to the centre line of the bulbs (border 2px + half the 20px plate). */
const BAND_OFFSET = 12;
const BULB_PITCH = 19; // px between a big bulb and the small lamp next to it
const COMETS = 2;

/**
 * Marquee lamps around the plaque: big yellow bulbs with a small red lamp between every two
 * (a big bulb sits on every corner). Every lamp owns a phase (--p) so two lit segments of lime
 * light run clockwise around the sign. Each side gets an even lamp count so big/small alternate
 * cleanly around the corners.
 */
function layoutBulbs(w: number, h: number): Bulb[] {
  const x0 = -BAND_OFFSET;
  const y0 = -BAND_OFFSET;
  const x1 = w + BAND_OFFSET;
  const y1 = h + BAND_OFFSET;
  const sides: Array<[number, number, number, number]> = [
    [x0, y0, x1, y0],
    [x1, y0, x1, y1],
    [x1, y1, x0, y1],
    [x0, y1, x0, y0],
  ];
  const raw: Array<Omit<Bulb, "p">> = [];
  for (const [ax, ay, bx, by] of sides) {
    const len = Math.hypot(bx - ax, by - ay);
    const k = Math.max(2, 2 * Math.round(len / (BULB_PITCH * 2)));
    for (let i = 0; i < k; i++) {
      const t = i / k;
      raw.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, small: raw.length % 2 === 1 });
    }
  }
  return raw.map((b, i) => ({ ...b, p: ((i / raw.length) * COMETS) % 1 }));
}

function MarqueeRing() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  useLayoutEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    // padding-box size: clientWidth/Height exclude the border, matching the ring's origin
    const read = () => setSize([el.clientWidth, el.clientHeight]);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const bulbs = size[0] > 0 ? layoutBulbs(size[0], size[1]) : [];
  return (
    <>
      <div className="mq-plate" />
      <div className="mq-face" />
      <div className="mq-glow" />
      <div ref={ref} className="mq-ring">
        {bulbs.map((b, i) => (
          <i
            key={i}
            className={`mq-bulb${b.small ? " is-sm" : ""}`}
            style={{ left: b.x, top: b.y, ["--p" as string]: b.p.toFixed(4) }}
          />
        ))}
      </div>
    </>
  );
}
