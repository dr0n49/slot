import { SymbolArt } from "../art/Symbols";
import { t } from "../i18n";

/** Start screen: logo, three feature cards, press to start (also unlocks audio). */
export function Splash({ ready, replay, onStart }: { ready: boolean; replay: boolean; onStart: () => void }) {
  const cards: [string, string[]][] = [
    ["chest", t.intro.a],
    ["rows", t.intro.b],
    ["mult", t.intro.c],
  ];
  return (
    <div className={`splash ${ready ? "ready" : ""}`} onClick={() => ready && onStart()}>
      <img className="sky" src="./art/bg.jpg" alt="" aria-hidden draggable={false} />
      <div className="splash-inner">
        <header className="splash-logo">
          <span>Cloud</span>
          <b>Vault</b>
        </header>
        <div className="splash-cards">
          {cards.map(([k, [title, text]], i) => (
            <div className="splash-card" key={k} style={{ ["--i" as string]: i }}>
              <div className="splash-art">
                {k === "chest" && <img src="./art/chest_closed.png" alt="" />}
                {k === "rows" && (
                  <div className="mini-board">
                    {Array.from({ length: 5 }, (_, r) => (
                      <span key={r} className={r === 2 ? "on" : ""}>
                        <SymbolArt sym={r === 2 ? "H2" : "L1"} />
                      </span>
                    ))}
                  </div>
                )}
                {k === "mult" && (
                  <div className="mult-stack">
                    <img src="./art/chest_open.png" alt="" />
                    <b>x25</b>
                  </div>
                )}
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <button className="splash-start" disabled={!ready}>
          {ready ? (replay ? t.playReplay : t.pressToStart) : "…"}
        </button>
      </div>
    </div>
  );
}
