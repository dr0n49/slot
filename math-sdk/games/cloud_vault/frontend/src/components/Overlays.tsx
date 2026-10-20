import type React from "react";
import { FEATURE_TITLE, MAX_WIN, MODES, type ModeId, type ModeInfo } from "../game/modes";
import type { Overlay } from "../game/player";
import { KeyArt } from "../art/Symbols";

export function OverlayView({ o, fmt, onTap }: { o: Overlay; fmt: (x: number) => string; onTap: () => void }) {
  if (o.kind === "intro") {
    return (
      <div className={`overlay full ov-intro ${o.feature}`} onClick={onTap}>
        <div className="full-inner">
          <h1 className="full-title">{FEATURE_TITLE[o.feature]}</h1>
          <div className="intro-chests">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} style={{ ["--i" as string]: i }}>
                <img src="./art/chest_closed.png" alt="" />
                {o.minChest > 2 && <b>x{o.minChest}</b>}
              </span>
            ))}
          </div>
          <p className="full-big">{o.totalFs} free spins</p>
          <p className="full-sub">{introText(o.feature)}</p>
          <small className="full-hint">Tap to continue</small>
        </div>
      </div>
    );
  }
  if (o.kind === "total") {
    return (
      <div className="overlay full ov-total" onClick={onTap}>
        <div className="full-inner">
          <div className="total-crest" aria-hidden>
            <img src="./art/chest_open.png" alt="" />
          </div>
          <h1 className="full-title">Total win</h1>
          <p className="full-big">{fmt(o.x)}</p>
          <small className="full-hint">Tap to continue</small>
        </div>
      </div>
    );
  }
  if (o.kind === "keys") {
    return (
      <div className="overlay ov-keys" aria-hidden>
        <div className="keys-row">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ ["--i" as string]: i }}>
              <KeyArt />
            </span>
          ))}
        </div>
        <p className="keys-title">{FEATURE_TITLE[o.feature]}</p>
      </div>
    );
  }
  return (
    <div className={`overlay ov-${o.kind}`} onClick={onTap}>
      <div className="ov-card">
        {o.kind === "mystery" && (
          <>
            <h2>Mystery</h2>
            <p className="ov-big">{o.outcome === "none" ? "No feature" : FEATURE_TITLE[o.outcome]}</p>
          </>
        )}
        {o.kind === "chests" && (
          <>
            <h2>Vaults open</h2>
            <p className="ov-big">x{o.product.toLocaleString("en-US")}</p>
            <p>
              {fmt(o.before)} {o.done ? <>→ <b>{fmt(o.after)}</b></> : null}
            </p>
          </>
        )}
        {o.kind === "bigwin" && (
          <>
            <h2>{tier(o.x)}</h2>
            <p className="ov-big">{fmt(o.x)}</p>
          </>
        )}
        {o.kind === "maxwin" && (
          <>
            <h2>Max win</h2>
            <p className="ov-big">{MAX_WIN.toLocaleString("en-US")}×</p>
            <p>{fmt(o.x)}</p>
          </>
        )}
      </div>
    </div>
  );
}

const tier = (x: number) => (x >= 1000 ? "Legendary win" : x >= 250 ? "Epic win" : x >= 75 ? "Mega win" : "Big win");

function introText(f: string) {
  switch (f) {
    case "bonus":
      return "Win every row of a reel to unlock its vault. Unlocked vaults multiply together at the end.";
    case "super":
      return "Every row of a reel unlocks its vault — and every vault is worth at least 5×.";
    case "epic":
      return "Only the middle three rows are needed, and every vault is worth at least 5×.";
    case "raid":
      return "One spin: a win on a reel's middle row unlocks its vault.";
    case "storm":
      return "One spin: a win on a reel's middle row unlocks its vault, worth at least 5×.";
    default:
      return "";
  }
}

export function BuyMenu({
  active,
  canBuy,
  bet,
  fmtCash,
  onToggle,
  onBuy,
  onClose,
}: {
  active: ModeId;
  canBuy: boolean;
  bet: number;
  fmtCash: (v: number) => string;
  onToggle: (m: ModeId) => void;
  onBuy: (m: ModeId) => void;
  onClose: () => void;
}) {
  const card = (m: ModeInfo) => (
    <div key={m.id} className={`buy-card ${active === m.id ? "active" : ""}`}>
      <div className="pips">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} className={i < m.power ? "on" : ""} />
        ))}
      </div>
      <h3>{m.title}</h3>
      <p>{m.blurb}</p>
      <div className="price">{fmtCash(bet * m.cost)}</div>
      {m.kind === "buy" ? (
        <button disabled={!canBuy} onClick={() => onBuy(m.id)}>
          Buy
        </button>
      ) : (
        <button className="ghost" disabled={!canBuy} onClick={() => onToggle(active === m.id ? "base" : m.id)}>
          {active === m.id ? "Deactivate" : "Activate"}
        </button>
      )}
    </div>
  );
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-body buy-grid" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>Features</h2>
        <div className="cards">{MODES.filter((m) => m.kind !== "spin").map(card)}</div>
      </div>
    </div>
  );
}

const PAYS: [string, number[]][] = [
  ["H1", [2, 3.5, 6, 10, 16, 28, 45, 75]],
  ["H2", [1.2, 2, 3, 5, 8, 14, 22, 35]],
  ["H3", [0.8, 1.2, 2, 3, 5, 8, 12, 20]],
  ["H4", [0.5, 0.8, 1.2, 2, 3, 5, 8, 12]],
  ["L1", [0.3, 0.5, 0.8, 1.3, 2, 3.5, 5.5, 9]],
  ["L2", [0.3, 0.5, 0.8, 1.3, 2, 3.5, 5.5, 9]],
  ["L3", [0.2, 0.3, 0.5, 0.8, 1.2, 2, 3, 5]],
  ["L4", [0.2, 0.3, 0.5, 0.8, 1.2, 2, 3, 5]],
];
const SIZES = ["5", "6", "7", "8", "9", "10", "11", "12+"];

export function InfoModal({ onClose, Sym }: { onClose: () => void; Sym: (p: { sym: string }) => React.ReactElement }) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-body info" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>Game rules</h2>
        <p>
          5×5 cluster pays with tumbles. A cluster is 5 or more matching symbols touching horizontally or vertically.
          Every cluster pays; winning symbols are removed and new ones fall in until no cluster forms. No wilds.
          RTP 96.00% in every mode. Max win 25,000× the bet.
        </p>
        <h3>Paytable (× bet)</h3>
        <div className="paytable">
          {PAYS.map(([s, row]) => (
            <div className="pay-row" key={s}>
              <span className="pay-sym">
                <Sym sym={s} />
              </span>
              {row.map((v, i) => (
                <span key={i}>
                  <small>{SIZES[i]}</small>
                  {v}×
                </span>
              ))}
            </div>
          ))}
        </div>
        <h3>Vaults</h3>
        <p>
          A vault sits under every reel. Vaults are live in free spins and raids, never in normal spins. A reel's row is
          won when one of its symbols is part of a winning cluster; won rows stay won for the rest of the round. When a
          reel has won the rows its feature requires, its vault unlocks. At the end of the round every unlocked vault
          reveals 2×, 3×, 4×, 5×, 6×, 7×, 8×, 9×, 10×, 25×, 50× or 100×, and the round win is multiplied by all of them
          together. A locked vault counts as 1×.
        </p>
        <h3>Free spins</h3>
        <p>
          3, 4 or 5 Halos award Cloud Bonus, Super Cloud or Epic Cloud with 10 free spins. Every Halo that lands during
          free spins adds 1 free spin. Cloud Bonus and Super Cloud unlock a vault when all 5 rows of its reel have won;
          Epic Cloud needs only the middle three rows. In Super Cloud, Epic Cloud and Thunder Raid every unlocked vault is
          worth at least 5×.
        </p>
        <h3>Features</h3>
        <ul>
          {MODES.filter((m) => m.kind !== "spin").map((m) => (
            <li key={m.id}>
              <b>{m.title}</b> ({m.cost}× bet) — {m.blurb}
            </li>
          ))}
        </ul>
        <p className="fine">
          Malfunction voids all pays and plays. Interrupted rounds resume when the game is reopened.
        </p>
      </div>
    </div>
  );
}
