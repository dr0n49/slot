import type React from "react";
import { useEffect, useState } from "react";
import { CrestArt, KeyArt } from "../art/Symbols";
import { FEATURE_TITLE, MAX_WIN, MODES, type ModeId, type ModeInfo } from "../game/modes";
import type { Overlay } from "../game/player";
import { t } from "../i18n";

/* ---------------------------------------------------------------- shared bits */

export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg className={`logo ${className}`} viewBox="0 0 320 210" aria-label="Sky Drop">
      <defs>
        <linearGradient id="logoGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset=".45" stopColor="#ffd448" />
          <stop offset=".75" stopColor="#e8930c" />
          <stop offset="1" stopColor="#fff0a0" />
        </linearGradient>
        <linearGradient id="logoWing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset="1" stopColor="#d99a1c" />
        </linearGradient>
      </defs>
      <g stroke="#3b2205" strokeWidth="4" strokeLinejoin="round">
        <path d="M118 60 C80 20 40 26 18 52 C46 46 66 54 78 70 C52 66 36 76 30 92 C56 80 80 84 104 100Z" fill="url(#logoWing)" />
        <path d="M202 60 C240 20 280 26 302 52 C274 46 254 54 242 70 C268 66 284 76 290 92 C264 80 240 84 216 100Z" fill="url(#logoWing)" />
        <path d="M160 6 L170 26 L160 34 L150 26Z" fill="#7cd8ff" />
      </g>
      <g fontFamily="Georgia, 'Times New Roman', serif" fontWeight="900" textAnchor="middle" paintOrder="stroke" stroke="#3b2205" strokeLinejoin="round">
        <text x="160" y="96" fontSize="70" strokeWidth="12" fill="url(#logoGold)" letterSpacing="4">
          SKY
        </text>
        <text x="160" y="180" fontSize="100" strokeWidth="14" fill="url(#logoGold)" letterSpacing="2">
          DROP
        </text>
      </g>
      <g fontFamily="Georgia, serif" fontWeight="900" textAnchor="middle" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2">
        <text x="160" y="96" fontSize="70" letterSpacing="4">SKY</text>
        <text x="160" y="180" fontSize="100" letterSpacing="2">DROP</text>
      </g>
    </svg>
  );
}

/** Animated count-up of an amount, formatted by `fmt`. */
export function CountUp({ to, fmt, ms = 1800 }: { to: number; fmt: (v: number) => string; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{fmt(v)}</>;
}

function Pips({ n }: { n: number }) {
  return (
    <div className="pips" aria-label={`Volatility ${n} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} className={i < n ? "on" : ""}>
          ϟ
        </i>
      ))}
    </div>
  );
}

function ModeArt({ m }: { m: ModeInfo }) {
  switch (m.art) {
    case "halos":
    case "halos2":
      return (
        <div className={`mode-art halos ${m.art}`}>
          {[0, 1, 2].map((i) => (
            <img key={i} src="./art/portrait.png" alt="" />
          ))}
        </div>
      );
    case "key":
      return (
        <div className="mode-art keys one">
          <span>
            <KeyArt />
          </span>
        </div>
      );
    case "keys":
      return (
        <div className="mode-art keys">
          {[0, 1, 2].map((i) => (
            <span key={i}>
              <KeyArt />
            </span>
          ))}
        </div>
      );
    case "chests":
    case "chests5":
      return (
        <div className={`mode-art m-chests ${m.art === "chests5" ? "chests5" : ""}`}>
          {[0, 1, 2].map((i) => (
            <img key={i} src="./art/chest_open.png" alt="" />
          ))}
          {m.art === "chests5" && <b className="ribbon">5x {t.minimum}</b>}
        </div>
      );
    case "mystery":
      return (
        <div className="mode-art mystery">
          <b>???</b>
        </div>
      );
    default:
      return null;
  }
}

/* ---------------------------------------------------------------- round screens */

const tier = (x: number) => (x >= 75 ? "epic" : x >= 40 ? "mega" : "big");
const tierTitle = (k: string) => (k === "epic" ? t.epicWin : k === "mega" ? t.megaWin : t.bigWin);

export function OverlayView({ o, fmtX, onTap }: { o: Overlay; fmtX: (x: number) => string; onTap: () => void }) {
  switch (o.kind) {
    case "cloud":
      return (
        <div className="overlay cloud-wipe" aria-hidden>
          <img className="cw c1" src="./fx/cloud1.png" alt="" />
          <img className="cw c2" src="./fx/cloud2.png" alt="" />
          <img className="cw c3" src="./fx/cloud4.png" alt="" />
          <img className="cw c4" src="./fx/cloud3.png" alt="" />
          <img className="cw c5" src="./fx/cloud5.png" alt="" />
        </div>
      );
    case "keys":
      return null; // keys are drawn on the board itself
    case "intro":
      return (
        <div className={`overlay fs-intro ${o.feature}`} onClick={onTap}>
          <h1 className="cyan-title">{FEATURE_TITLE[o.feature]}</h1>
          <div className="intro-banner">
            {Array.from({ length: 5 }, (_, i) => (
              <img key={i} src="./art/chest_open.png" alt="" style={{ ["--i" as string]: i }} />
            ))}
            {o.minChest > 2 && <b className="ribbon">{o.minChest}x {t.minimum}</b>}
          </div>
          <p className="cyan-title small">{t.freeSpinsN(o.totalFs)}</p>
          <p className="intro-sub">{t.featureSub[o.feature]}</p>
          <small className="press">{t.tapToContinue}</small>
        </div>
      );
    case "total":
      return (
        <div className="overlay total-win" onClick={onTap}>
          <div className="crest">
            <CrestArt />
          </div>
          <h1 className="gold-title">{t.totalWin}</h1>
          <p className="big-number">
            <CountUp to={o.x} fmt={fmtX} />
          </p>
          <small className="press">{t.tapToContinue}</small>
        </div>
      );
    case "bigwin": {
      const k = tier(o.x);
      return (
        <div className={`overlay big-win ${k}`} onClick={onTap}>
          <h1 className={`win-title ${k}`}>{tierTitle(k)}</h1>
          <div className="bw-clouds">
            <img src="./fx/cloud2.png" alt="" />
            <img src="./fx/cloud1.png" alt="" />
            <img src="./fx/cloud5.png" alt="" />
          </div>
          {k !== "big" && <img className="bw-chest" src="./art/chest_open.png" alt="" />}
          <p className="big-number">
            <CountUp to={o.x} fmt={fmtX} ms={2600} />
          </p>
        </div>
      );
    }
    case "maxwin":
      return (
        <div className="overlay big-win max" onClick={onTap}>
          <h1 className="win-title max">{t.maxWin}</h1>
          <img className="bw-chest" src="./art/chest_open.png" alt="" />
          <p className="big-number">{MAX_WIN.toLocaleString("en-US")}x</p>
          <p className="max-amount">{fmtX(o.x)}</p>
        </div>
      );
    case "mystery":
      return (
        <div className="overlay mystery-reveal" onClick={onTap}>
          <div className="mystery-card">
            <b className="q">???</b>
            <h2>{o.outcome === "none" ? t.noFeature : FEATURE_TITLE[o.outcome]}</h2>
          </div>
        </div>
      );
  }
}

/* ---------------------------------------------------------------- feature menu */

export function BuyMenu({
  active,
  bet,
  balance,
  canStep,
  fmtCash,
  hidden,
  onPick,
  onBet,
  onClose,
}: {
  active: ModeId;
  bet: number;
  balance: number;
  canStep: [boolean, boolean];
  fmtCash: (v: number) => string;
  hidden: (m: ModeInfo) => boolean;
  onPick: (m: ModeInfo) => void;
  onBet: (dir: -1 | 1) => void;
  onClose: () => void;
}) {
  const card = (m: ModeInfo) => (
    <button key={m.id} className={`mode-card ${m.kind} ${active === m.id ? "active" : ""}`} onClick={() => onPick(m)}>
      <ModeArt m={m} />
      <Pips n={m.power} />
      <h3>{m.title}</h3>
      <div className="price">{fmtCash(bet * m.cost)}</div>
      <span className={`mode-btn ${m.kind}`}>{active === m.id ? t.disable : m.kind === "buy" ? t.buy : t.activate}</span>
    </button>
  );
  const visible = MODES.filter((m) => m.kind !== "spin" && !hidden(m));
  const top = visible.filter((m) => ["extra_chance", "super_chance", "raid", "storm"].includes(m.id));
  const bottom = visible.filter((m) => ["bonus", "super", "mystery"].includes(m.id));
  return (
    <div className="dim-screen" onClick={onClose}>
      <button className="x-close" onClick={onClose} aria-label={t.close}>
        ✕
      </button>
      <div className="mode-grid" onClick={(e) => e.stopPropagation()}>
        <div className="mode-row">{top.map(card)}</div>
        <div className="mode-row">{bottom.map(card)}</div>
        <div className="mini-hud">
          <div>
            <small>{t.balance}</small>
            <b>{fmtCash(balance)}</b>
          </div>
          <button className="arrow down" disabled={!canStep[0]} onClick={() => onBet(-1)} aria-label="Lower bet" />
          <div>
            <small>{t.bet}</small>
            <b>{fmtCash(bet)}</b>
          </div>
          <button className="arrow up" disabled={!canStep[1]} onClick={() => onBet(1)} aria-label="Raise bet" />
        </div>
      </div>
    </div>
  );
}

export function ConfirmCard({
  m,
  price,
  onConfirm,
  onClose,
}: {
  m: ModeInfo;
  price: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="dim-screen" onClick={onClose}>
      <button className="x-close" onClick={onClose} aria-label={t.close}>
        ✕
      </button>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-art">
          <ModeArt m={m} />
        </div>
        <Pips n={m.power} />
        <h3>{m.title}</h3>
        <p>{t.modeText[m.id]}</p>
        <div className="price">{price}</div>
        <button className="confirm-btn" onClick={onConfirm} autoFocus>
          {t.confirm}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- autoplay & menu */

const AUTO_COUNTS = [10, 25, 50, 100, 500];

export function AutoplayPanel({ onStart, onClose }: { onStart: (n: number) => void; onClose: () => void }) {
  const [n, setN] = useState(25);
  return (
    <div className="dim-screen light" onClick={onClose}>
      <div className="auto-panel" onClick={(e) => e.stopPropagation()}>
        <h3>{t.autoplay}</h3>
        <div className="auto-counts">
          {AUTO_COUNTS.map((c) => (
            <button key={c} className={c === n ? "on" : ""} onClick={() => setN(c)}>
              {c}
            </button>
          ))}
        </div>
        <p>
          {n} {t.spins}
        </p>
        <button className="confirm-btn" onClick={() => onStart(n)}>
          {t.autoStart}
        </button>
      </div>
    </div>
  );
}

export function MenuPopover({
  fx,
  music,
  onFx,
  onMusic,
  onInfo,
}: {
  fx: number;
  music: number;
  onFx: (v: number) => void;
  onMusic: (v: number) => void;
  onInfo: () => void;
}) {
  return (
    <div className="menu-pop" onClick={(e) => e.stopPropagation()}>
      <button className="menu-row" onClick={onInfo}>
        <span className="ico">i</span> {t.info}
      </button>
      <label className="menu-row">
        <span className="ico" aria-hidden>
          🔊
        </span>
        <input type="range" min={0} max={1} step={0.05} value={fx} onChange={(e) => onFx(Number(e.target.value))} aria-label="Sound volume" />
      </label>
      <label className="menu-row">
        <span className="ico" aria-hidden>
          ♫
        </span>
        <input type="range" min={0} max={1} step={0.05} value={music} onChange={(e) => onMusic(Number(e.target.value))} aria-label="Music volume" />
      </label>
    </div>
  );
}

/* ---------------------------------------------------------------- rules */

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
const SIZES = ["5 - 5", "6 - 6", "7 - 7", "8 - 8", "9 - 9", "10 - 10", "11 - 11", "12 - 25"];

export function InfoPage({ onClose, Sym, version }: { onClose: () => void; Sym: (p: { sym: string }) => React.ReactElement; version: string }) {
  const r = t.rules;
  return (
    <div className="info-page" onClick={onClose}>
      <button className="x-close" onClick={onClose} aria-label={t.close}>
        ✕
      </button>
      <div className="info-scroll" onClick={(e) => e.stopPropagation()}>
        <h2>{r.title}</h2>
        <p>{r.intro}</p>
        <h2>{r.payTitle}</h2>
        {[PAYS.slice(0, 4), PAYS.slice(4)].map((group, g) => (
          <div className="pay-group" key={g}>
            {group.map(([s, row]) => (
              <div className="pay-col" key={s}>
                <div className="pay-sym">
                  <Sym sym={s} />
                </div>
                <div className="pay-box">
                  {row.map((v, i) => (
                    <span key={i}>
                      {SIZES[i]} | {v}x
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
        <h2>{r.waysTitle}</h2>
        <div className="ways-grid" aria-hidden>
          {Array.from({ length: 25 }, (_, i) => (
            <i key={i} className={[6, 7, 8, 12, 17].includes(i) ? "on" : ""} />
          ))}
        </div>
        <p>{r.ways}</p>
        <h2>{r.featTitle}</h2>
        <div className="feat-img">
          <Sym sym="S" />
        </div>
        <h3>{r.chestsTitle}</h3>
        {r.chests.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="feat-img portrait">
          <img src="./art/portrait.png" alt="" />
        </div>
        {r.halo.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p>{r.mystery}</p>
        <h2>{r.modesTitle}</h2>
        <ul className="mode-list">
          {MODES.filter((m) => m.kind !== "spin").map((m) => (
            <li key={m.id}>
              <b>{m.title}</b> — {m.cost}x. {t.modeText[m.id]} RTP 96.00%, max win 25,000x.
            </li>
          ))}
        </ul>
        <h2>{r.controlsTitle}</h2>
        <ul className="controls">
          {r.controls.map(([k, v]) => (
            <li key={k}>
              <b>{k}</b> — {v}
            </li>
          ))}
        </ul>
        <h2>{r.generalTitle}</h2>
        {r.general.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="version">v{version}</p>
      </div>
    </div>
  );
}
