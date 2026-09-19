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

/**
 * Landscape-only side plaque next to the tall 5×5 board: hand pays on the
 * right. Portrait hides it
 * (CSS) — the phone layout has no spare width.
 */
export function SidePanels({ copy }: { copy: Copy }) {
  return (
    <>
      <aside className="side-panel side-panel-right" aria-hidden>
        <MarqueeRing />
        <div className="side-panel-title">{copy.gameInfo.handsTitle}</div>
        <div className="side-hands">
          {HAND_ROWS.map((h) => (
            <div key={h.idx} className={`side-hand${h.idx === 9 ? " is-top" : ""}`}>
              <span className="side-hand-name">{h.name(copy)}</span>
              <span className="side-hand-dots" />
              <span className="side-hand-pay">{formatLinePay(h.idx)}</span>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

type Bulb = { x: number; y: number; small: boolean; p: number };

/** Half of the red band's width + the plaque border: how far the bulb line sits outside the padding box. */
const BAND_OFFSET = 8.5;
const BULB_PITCH = 26; // px between two big bulbs
/** Chasing lights around the plaque: every bulb owns a phase, so a few bright groups run clockwise. */
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
    const k = Math.max(2, Math.round(len / BULB_PITCH));
    for (let i = 0; i < k; i++) {
      const t0 = i / k;
      const t1 = (i + 0.5) / k;
      raw.push({ x: ax + (bx - ax) * t0, y: ay + (by - ay) * t0, small: false });
      raw.push({ x: ax + (bx - ax) * t1, y: ay + (by - ay) * t1, small: true });
    }
  }
  return raw.map((b, i) => ({ ...b, p: ((i / raw.length) * COMETS) % 1 }));
}
const COMETS = 2;

function MarqueeRing() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  useLayoutEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const read = () => setSize([el.clientWidth, el.clientHeight]);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const bulbs = size[0] > 0 ? layoutBulbs(size[0], size[1]) : [];
  return (
    <div ref={ref} className="mq-ring">
      {bulbs.map((b, i) => (
        <i
          key={i}
          className={`mq-bulb${b.small ? " is-sm" : ""}`}
          style={{ left: b.x, top: b.y, ["--p" as string]: b.p.toFixed(4) }}
        />
      ))}
    </div>
  );
}
