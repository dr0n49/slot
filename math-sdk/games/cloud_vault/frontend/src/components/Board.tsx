import { KeyArt, SymbolArt } from "../art/Symbols";
import type { Reel } from "../game/board";
import type { FeatureState, Plus, WinLabel } from "../game/player";

type Props = {
  reels: Reel[];
  labels: WinLabel[];
  halos: { reel: number; row: number }[];
  plus: Plus[];
  panel: number | null;
  feature: FeatureState | null;
  fmt: (x: number) => string;
};

export function Board({ reels, labels, halos, plus, panel, feature, fmt }: Props) {
  const haloSet = new Set(halos.map((h) => `${h.reel}:${h.row}`));
  return (
    <div className="board-wrap">
      <div className="board">
        {reels.map((reel, r) => (
          <div className="reel" key={r}>
            {reel.cells.map((c, w) => {
              const required = feature?.rows.includes(w);
              const banked = feature?.banked[r]?.[w];
              return (
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
                    ["--out-delay" as string]: `${r * 45 + (4 - w) * 18}ms`,
                  }}
                >
                  {feature && required && <span className={`row-mark ${banked ? "on" : ""}`} />}
                  <div className="sym">
                    <SymbolArt sym={c.sym} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {labels.map((l) => (
          <div key={l.key} className="win-label" style={{ left: `${l.reel * 20 + 10}%`, top: `${l.row * 20 + 10}%` }}>
            {fmt(l.x)}
          </div>
        ))}
        {plus.map((p) => (
          <div key={p.key} className="plus-one" style={{ left: `${p.reel * 20 + 10}%`, top: `${p.row * 20 + 10}%` }}>
            +1
          </div>
        ))}
        {panel !== null && panel > 0 && (
          <div className="win-panel" key={Math.round(panel * 100)}>
            {fmt(panel)}
          </div>
        )}
      </div>
      <Vaults feature={feature} />
    </div>
  );
}

function Vaults({ feature }: { feature: FeatureState | null }) {
  return (
    <div className={`vaults ${feature ? "live" : "idle"}`}>
      {Array.from({ length: 5 }, (_, r) => {
        const unlocked = !!feature?.unlocked[r];
        const value = feature?.values[r] ?? null;
        const need = feature?.rows ?? [];
        return (
          <div key={r} className={`vault ${unlocked ? "unlocked" : ""} ${value ? "opened" : ""}`}>
            <img
              className="vault-art"
              src={value !== null ? "./art/chest_open.png" : "./art/chest_closed.png"}
              alt=""
              draggable={false}
            />
            {feature?.keys && value === null && (
              <span className="vault-key" style={{ ["--i" as string]: r }}>
                <KeyArt />
              </span>
            )}
            {value !== null ? (
              <span className="vault-value">x{value}</span>
            ) : feature && feature.minChest > 2 ? (
              <span className="vault-min">x{feature.minChest}</span>
            ) : null}
            {feature && value === null && (
              <span className="vault-pips">
                {need.map((w) => (
                  <i key={w} className={feature.banked[r]?.[w] ? "on" : ""} />
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
