import type React from "react";
import { useEffect, useState } from "react";
import { KeyArt } from "../art/Symbols";
import { FEATURE_TITLE, MAX_WIN, MODES, type ModeId, type ModeInfo } from "../game/modes";
import type { Overlay } from "../game/player";
import { bigWinTier, titleOf } from "../spine/SpineScreens";
import { t } from "../i18n";

/* ---------------------------------------------------------------- shared bits */

export function Logo({ className = "" }: { className?: string }) {
  return <img className={`logo ${className}`} src="./art/ui/logo.png" alt="Sky Drop" draggable={false} />;
}

/** Animated count-up of an amount, formatted by `fmt`. */
export function CountUp({ to, fmt, ms = 1800, digits = false }: { to: number; fmt: (v: number) => string; ms?: number; digits?: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      // Round mid-count values to the final amount's precision so no extra decimals flash by.
      const q = to >= 1 ? 0.01 : 0.0001;
      setV(k >= 1 ? to : Math.round((to * (1 - Math.pow(1 - k, 3))) / q) * q);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return digits ? <Digits text={fmt(v)} /> : <>{fmt(v)}</>;
}

const DIGIT_FILE: Record<string, string> = { ".": "dot", ",": "comma", x: "x", "×": "x" };
/** A number drawn with the gold digit images (anything else falls back to text). */
export function Digits({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`digits ${className}`} aria-label={text}>
      {[...text].map((ch, i) =>
        /[0-9]/.test(ch) || DIGIT_FILE[ch] ? (
          <img key={i} className={`dg dg-${DIGIT_FILE[ch] ?? "n"}`} src={`./art/ui/digit_${DIGIT_FILE[ch] ?? ch}.png`} alt="" draggable={false} />
        ) : ch === " " ? (
          <i key={i} className="dg-space" />
        ) : (
          <b key={i} className="dg-text">
            {ch}
          </b>
        ),
      )}
    </span>
  );
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
          {m.art === "chests5" && <img className="ribbon-img" src="./art/ui/ribbon_5x_minimum.png" alt="5x minimum" />}
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

/**
 * Win / bonus screens. With Spine running, titles, chest, crest, banner and clouds are animated
 * by SpineScreens on top of these placeholders (class `spine-art` hides the DOM art); the numbers
 * and texts always stay DOM.
 */
export function OverlayView({ o, fmtX, onTap, spineArt }: { o: Overlay; fmtX: (x: number) => string; onTap: () => void; spineArt: boolean }) {
  const art = spineArt ? "spine-art" : "";
  const title = titleOf(o);
  const titleImg = title ? <img className="title-img" src={`./art/ui/${title}.png`} alt={title.replace(/_/g, " ")} draggable={false} /> : null;
  switch (o.kind) {
    case "cloud":
      return (
        <div className={`overlay cloud-wipe ${art}`} aria-hidden>
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
        <div className={`overlay fs-intro ${o.feature} ${art}`} onClick={onTap}>
          {titleImg}
          <div className="intro-banner">
            <img className="plaque" src="./art/ui/banner_plaque.png" alt="" />
            {Array.from({ length: 5 }, (_, i) => (
              <img key={i} className="bchest" src="./art/chest_open.png" alt="" style={{ ["--i" as string]: i }} />
            ))}
            {o.minChest > 2 && <img className="ribbon-img" src="./art/ui/ribbon_5x_minimum.png" alt={`${o.minChest}x minimum`} />}
          </div>
          <div className="fs-title">
            <Digits text={String(o.totalFs)} />
            <img className="free-spins-img" src="./art/ui/title_free_spins.png" alt="free spins" draggable={false} />
          </div>
          <p className="intro-sub">{t.featureSub[o.feature]}</p>
          <small className="press">{t.tapToContinue}</small>
        </div>
      );
    case "total":
      return (
        <div className={`overlay total-win ${art}`} onClick={onTap}>
          <div className="crest">
            <img src="./art/ui/crest.png" alt="" draggable={false} />
          </div>
          {titleImg}
          <p className="big-number">
            <CountUp to={o.x} fmt={fmtX} digits />
          </p>
          <small className="press">{t.tapToContinue}</small>
        </div>
      );
    case "bigwin": {
      const k = bigWinTier(o.x);
      return (
        <div className={`overlay big-win ${k} ${art}`} onClick={onTap}>
          {titleImg}
          {k === "epic" && <img className="bw-chest" src="./art/ui/chest_treasure.png" alt="" draggable={false} />}
          <p className="big-number">
            <CountUp to={o.x} fmt={fmtX} ms={2600} digits />
          </p>
        </div>
      );
    }
    case "maxwin":
      return (
        <div className={`overlay big-win max ${art}`} onClick={onTap}>
          {titleImg}
          <img className="bw-chest" src="./art/ui/chest_treasure.png" alt="" draggable={false} />
          <p className="big-number">
            <Digits text={`${MAX_WIN.toLocaleString("en-US")}x`} />
          </p>
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
