import { t } from "../i18n";
import { useLayoutEffect, useRef, useState } from "react";
import { KeyArt, SymbolArt } from "../art/Symbols";
import { SpineBoard } from "../spine/SpineBoard";
import { WinAmount } from "./WinAmount";
import type { Reel } from "../game/board";
import type { FeatureState, Panel, Plus, WinLabel } from "../game/player";

type Props = {
  active?: boolean;
  reels: Reel[];
  labels: WinLabel[];
  halos: { reel: number; row: number }[];
  plus: Plus[];
  panel: Panel;
  feature: FeatureState | null;
  keys: boolean; // raid keys hovering over the empty board
  anticipation: number | null;
  fmt: (x: number, reference?: number) => string; // plain number, no currency symbol
};

/** The framed 5×5 board. Positioned by the stage; the frame art sits on top of the cells. */
export function Board({ active = true, reels, labels, halos, plus, panel, feature, keys, anticipation, fmt }: Props) {
  const haloSet = new Set(halos.map((h) => `${h.reel}:${h.row}`));
  const live = feature && !feature.done;
  const [spineOn, setSpineOn] = useState(false);
  return (
    <div className={`frame-box ${spineOn ? "spine-on" : ""} ${feature && !feature.done ? "has-blooms" : ""} ${panel?.focus ? "focus" : ""}`}>
      <SpineBoard
        active={active}
        reels={reels}
        halos={halos}
        feature={feature}
        anticipation={anticipation}
        winKey={labels[0]?.key ?? 0}
        hush={!!panel?.focus}
        onLive={setSpineOn}
      />
      <div className="board">
        {reels.map((reel, r) => (
          <div className={`reel ${anticipation === r ? "reel-active" : ""}`} data-reel={r} key={r}>
            {live &&
              feature.rows.map((w) => {
                const fresh = feature.fresh?.some((p) => p.reel === r && p.row === w);
                return <span key={fresh ? `${w}:${feature.freshKey}` : w} className={`row-gold ${feature.banked[r]?.[w] ? "on" : ""} ${fresh ? "fresh" : ""}`} style={{ top: `${w * 20}%` }} />;
              })}
            {reel.cells.map((c, w) => (
              <div
                key={c.id}
                data-symbol={c.sym}
                data-row={w}
                className={[
                  "cell",
                  c.win ? "is-win" : "",
                  c.dim ? "is-dim" : "",
                  c.pop ? "is-pop" : "",
                  c.out ? "is-out" : "",
                  haloSet.has(`${r}:${w}`) ? "is-halo" : "",
                ].join(" ")}
                style={{
                  top: `${w * 20}%`,
                  ["--drop" as string]: c.drop,
                  ["--fx-scale" as string]: c.fxScale ?? 1,
                  ["--fx-delay" as string]: `${(c.fxDelay ?? 0) * (c.fxScale ?? 1)}ms`,
                  ["--delay" as string]: `${c.delay ?? 0}ms`,
                  ["--duration" as string]: `${c.duration ?? 140 + c.drop * 65}ms`,
                  ["--out-duration" as string]: `${c.outDuration ?? 340}ms`,
                  ["--out-delay" as string]: `${c.outDelay ?? r * 40 + (4 - w) * 16}ms`,
                }}
              >
                <div className="sym">
                  <SymbolArt sym={c.sym} />
                </div>
                {c.pop && <img className="puff" src="./fx/reference_cloud/puff_center.png" alt="" />}
              </div>
            ))}
          </div>
        ))}
        {labels.map((l) => (
          <div key={l.key} className="win-label" style={{ left: `${Math.min(84, Math.max(16, l.reel * 20 + 10))}%`, top: `${l.row * 20 + 10}%`, ["--label-enter" as string]: `${Math.min(260, (l.ms ?? 700) * .4)}ms` }}>
            <WinAmount x={l.x} fmt={fmt} ms={l.ms} />
          </div>
        ))}
        {plus.map((p) => (
          <div key={p.key} className="plus-card" style={{ left: `${p.reel * 20 + 10}%`, top: `${p.row * 20 + 10}%` }}>
            <img src="./symbols/S.webp" alt="" />
            <b>+1</b>
          </div>
        ))}
        {keys && (
          <div className="raid-keys">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} style={{ ["--i" as string]: i }}>
                <KeyArt />
              </span>
            ))}
          </div>
        )}
        {panel && panel.x > 0 && (
          <div className={`win-panel ${panel.final ? "final" : ""} ${panel.focus ? "collect" : ""}`}>
            {panel.mult && panel.mult > 1 ? <i key={panel.mult} className="mult">x{panel.mult.toLocaleString("en-US")}</i> : null}
            {/* One counter for the whole finale: it counts up to the win, then from the win to the multiplied total. */}
            <span><WinAmount x={panel.x} fmt={fmt} ms={panel.final ? 1500 : 600} /></span>
          </div>
        )}
      </div>
      {anticipation !== null && (
        <div className="reel-light" data-anticipation-reel={anticipation} style={{ ["--reel" as string]: anticipation }} aria-hidden>
          <i className="reel-light-shaft" /><i className="reel-light-glints" />
        </div>
      )}
      <img className="frame-art" src="./art/frame_v25.webp" alt="" draggable={false} />
      {feature && !feature.done && <Blooms feature={feature} />}
      {panel?.fly && <MultFly key={panel.fly.key} reel={panel.fly.reel} mult={panel.fly.mult} />}
    </div>
  );
}

/** A lotus's multiplier flying in an arc from the lotus into the centre panel. Positions are read from the DOM, in
 * the frame box's own (unscaled) units, so the flight stays right while the box is zoomed. */
function MultFly({ reel, mult }: { reel: number; mult: number }) {
  const el = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fly = el.current;
    const box = fly?.parentElement;
    const from = box?.querySelector(`.bloom-vessel[data-reel="${reel}"] .bloom-art`);
    const to = box?.querySelector(".win-panel");
    if (!fly || !box || !from || !to) return;
    const b = box.getBoundingClientRect();
    const k = box.offsetWidth ? b.width / box.offsetWidth : 1;
    const centre = (r: DOMRect) => ({ x: (r.left + r.width / 2 - b.left) / k, y: (r.top + r.height / 2 - b.top) / k });
    const a = centre(from.getBoundingClientRect());
    const z = centre(to.getBoundingClientRect());
    fly.style.left = `${a.x}px`;
    fly.style.top = `${a.y}px`;
    const dx = z.x - a.x;
    const dy = z.y - a.y;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    fly.animate(
      [
        { transform: "translate(-50%, -50%) scale(.4)", opacity: 0 },
        { transform: "translate(-50%, -50%) scale(1.5)", opacity: 1, offset: 0.18 },
        { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - box.offsetHeight * 0.12}px)) scale(1.25)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 0.2 },
      ],
      { duration: 560, easing: "cubic-bezier(.45, 0, .55, 1)", fill: "forwards" },
    );
  }, [reel]);
  return <div ref={el} className="mult-fly" aria-hidden>×{mult}</div>;
}

function Blooms({ feature }: { feature: FeatureState }) {
  return (
    <div className={`chests bloom-bank ${feature.leaving ? "leaving" : ""}`} aria-label={t.rules.chestsTitle}>
      {Array.from({ length: 5 }, (_, r) => {
        const unlocked = !!feature.unlocked[r];
        const value = feature.values[r] ?? null;
        const state = value !== null ? "open" : unlocked ? "ready" : "closed";
        const charged = feature.rows.filter((row) => feature.banked[r]?.[row]).length;
        const fed = feature.fresh?.some((p) => p.reel === r);
        const awoken = feature.awoken?.includes(r);
        const side = feature.opening != null && feature.opening !== r;
        const gathering = feature.opening === r && !!feature.gathering && value === null;
        return (
          <div key={r} data-reel={r} data-bloom-state={state} style={{ ["--r" as string]: r }}
            className={`chest bloom-vessel ${state} ${charged ? "charging" : ""} ${side ? "aside" : ""} ${feature.opening === r ? "opening" : ""} ${gathering ? "gathering" : ""}`}>
            {(fed || awoken) && <span key={`acc${feature.freshKey}`} className={`bloom-accent ${awoken ? "awoken" : "fed"}`} aria-hidden />}
            {/* Before it opens, light is drawn in from all around the lotus. */}
            {gathering && <span className="bloom-gather" aria-hidden>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ ["--a" as string]: `${i * 45 + r * 11}deg` }} />)}</span>}
            <span className="bloom-halo" aria-hidden />
            {state === "open" && (
              <span className="bloom-burst" aria-hidden>
                <span className="bloom-ring" />{/* the ring only: no petals fly out (no falling petals anywhere) */}
              </span>
            )}
            <span className="bloom-progress" role="progressbar" aria-label={`Lotus ${r + 1}`} aria-valuemin={0} aria-valuemax={feature.rows.length} aria-valuenow={charged}>
              {feature.rows.map((row) => <i key={row} className={feature.banked[r]?.[row] ? "on" : ""} />)}
            </span>
            <img
              key={state === "open" ? "open" : "shut"}
              className="chest-art bloom-art"
              src={`./art/bloom/lotus_${state === "open" ? "open" : state === "ready" ? "ready" : "closed"}.webp`}
              alt=""
              draggable={false}
            />
            {feature.keys && !feature.done && value === null && (
              <span className="chest-key bloom-key">
                <KeyArt />
              </span>
            )}
            {value !== null ? (
              <span className={`bloom-value ${value >= 100 ? "long" : ""}`}>×{value}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
