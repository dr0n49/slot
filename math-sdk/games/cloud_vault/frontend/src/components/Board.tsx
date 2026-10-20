import { useState } from "react";
import { KeyArt, SymbolArt } from "../art/Symbols";
import { SpineSymbols } from "../spine/SpineSymbols";
import type { Reel } from "../game/board";
import type { FeatureState, Panel, Plus, WinLabel } from "../game/player";

type Props = {
  reels: Reel[];
  labels: WinLabel[];
  halos: { reel: number; row: number }[];
  plus: Plus[];
  panel: Panel;
  feature: FeatureState | null;
  keys: boolean; // raid keys hovering over the empty board
  fmt: (x: number) => string; // plain number, no currency symbol
};

/** The framed 5×5 board. Positioned by the stage; the frame art sits on top of the cells. */
export function Board({ reels, labels, halos, plus, panel, feature, keys, fmt }: Props) {
  const haloSet = new Set(halos.map((h) => `${h.reel}:${h.row}`));
  const live = feature && !feature.done;
  const [spineOn, setSpineOn] = useState(false);
  return (
    <div className="frame-box">
      <div className={`board ${spineOn ? "spine-on" : ""}`}>
        <SpineSymbols reels={reels} halos={halos} onLive={setSpineOn} />
        {reels.map((reel, r) => (
          <div className="reel" key={r}>
            {live &&
              feature.rows.map((w) => (
                <span key={w} className={`row-gold ${feature.banked[r]?.[w] ? "on" : ""}`} style={{ top: `${w * 20}%` }} />
              ))}
            {reel.cells.map((c, w) => (
              <div
                key={c.id}
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
                  ["--delay" as string]: `${c.delay ?? 0}ms`,
                  ["--out-delay" as string]: `${r * 40 + (4 - w) * 16}ms`,
                }}
              >
                <div className="sym">
                  <SymbolArt sym={c.sym} />
                </div>
                {c.pop && <img className="puff" src={`./fx/cloud${(c.id % 5) + 1}.png`} alt="" />}
              </div>
            ))}
          </div>
        ))}
        {labels.map((l) => (
          <div key={l.key} className="win-label" style={{ left: `${l.reel * 20 + 10}%`, top: `${l.row * 20 + 10}%` }}>
            {fmt(l.x)}
          </div>
        ))}
        {plus.map((p) => (
          <div key={p.key} className="plus-card" style={{ left: `${p.reel * 20 + 10}%`, top: `${p.row * 20 + 10}%` }}>
            <img src="./art/portrait.png" alt="" />
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
          <div className={`win-panel ${panel.final ? "final" : ""}`}>
            {panel.mult && panel.mult > 1 ? <i className="mult">x{panel.mult.toLocaleString("en-US")}</i> : null}
            <span key={Math.round(panel.x * 100)}>{fmt(panel.x)}</span>
          </div>
        )}
      </div>
      <img className="frame-art" src="./art/frame.png" alt="" draggable={false} />
      {feature && <Chests feature={feature} />}
    </div>
  );
}

function Chests({ feature }: { feature: FeatureState }) {
  return (
    <div className="chests">
      {Array.from({ length: 5 }, (_, r) => {
        const unlocked = !!feature.unlocked[r];
        const value = feature.values[r] ?? null;
        return (
          <div key={r} className={`chest ${unlocked ? "unlocked" : ""} ${value ? "opened" : ""}`}>
            <img
              className="chest-art"
              src={unlocked || value !== null ? "./art/chest_open.png" : "./art/chest_closed.png"}
              alt=""
              draggable={false}
            />
            {feature.keys && !feature.done && value === null && (
              <span className="chest-key">
                <KeyArt />
              </span>
            )}
            {value !== null ? (
              <span className="chest-value">x{value}</span>
            ) : !feature.done && feature.minChest > 2 ? (
              <span className="chest-min">x{feature.minChest}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
