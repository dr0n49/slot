import { SymbolArt, VaultArt } from "../art/Symbols";
import type { Reel } from "../game/board";
import type { FeatureState, WinLabel } from "../game/player";

type Props = {
  reels: Reel[];
  labels: WinLabel[];
  halos: { reel: number; row: number }[];
  feature: FeatureState | null;
  fmt: (x: number) => string;
};

export function Board({ reels, labels, halos, feature, fmt }: Props) {
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
                    c.pop ? "is-pop" : "",
                    haloSet.has(`${r}:${w}`) ? "is-halo" : "",
                  ].join(" ")}
                  style={{ top: `${w * 20}%`, ["--drop" as string]: c.drop }}
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
        const have = need.filter((w) => feature?.banked[r]?.[w]).length;
        return (
          <div key={r} className={`vault ${unlocked ? "unlocked" : ""} ${value ? "opened" : ""}`}>
            <VaultArt open={value !== null} unlocked={unlocked} />
            {value !== null ? (
              <span className="vault-value">{value}×</span>
            ) : feature ? (
              <span className="vault-pips">
                {need.map((w) => (
                  <i key={w} className={feature.banked[r]?.[w] ? "on" : ""} />
                ))}
              </span>
            ) : null}
            {feature && !unlocked && value === null && <span className="sr-only">{`${have}/${need.length}`}</span>}
          </div>
        );
      })}
    </div>
  );
}
