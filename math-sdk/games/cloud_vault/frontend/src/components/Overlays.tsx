import type React from "react";
import { useEffect, useState } from "react";
import { KeyArt } from "../art/Symbols";
import { FEATURE_TITLE, MAX_WIN, MODES, type ModeId, type ModeInfo } from "../game/modes";
import type { Overlay } from "../game/player";
import { isRu, t } from "../i18n";

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
          <p className="full-big">{t.freeSpinsN(o.totalFs)}</p>
          <p className="full-sub">{t.featureIntro[o.feature]}</p>
          <small className="full-hint">{t.tapToContinue}</small>
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
          <h1 className="full-title">{t.totalWin}</h1>
          <p className="full-big">
            <CountUp to={o.x} fmt={fmt} />
          </p>
          <small className="full-hint">{t.tapToContinue}</small>
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
            <h2>{t.mystery}</h2>
            <p className="ov-big">{o.outcome === "none" ? t.noFeature : FEATURE_TITLE[o.outcome]}</p>
          </>
        )}
        {o.kind === "chests" && (
          <>
            <h2>{t.vaultsOpen}</h2>
            <p className="ov-big">x{o.product.toLocaleString("en-US")}</p>
            <p>
              {fmt(o.before)} {o.done ? <>→ <b>{fmt(o.after)}</b></> : null}
            </p>
          </>
        )}
        {o.kind === "bigwin" && (
          <>
            <h2>{tier(o.x)}</h2>
            <p className="ov-big">
              <CountUp to={o.x} fmt={fmt} />
            </p>
          </>
        )}
        {o.kind === "maxwin" && (
          <>
            <h2>{t.maxWin}</h2>
            <p className="ov-big">{MAX_WIN.toLocaleString("en-US")}×</p>
            <p>{fmt(o.x)}</p>
          </>
        )}
      </div>
    </div>
  );
}

/** Animated count-up of a win amount (in × bet). */
function CountUp({ to, fmt, ms = 1600 }: { to: number; fmt: (x: number) => string; ms?: number }) {
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

const tier = (x: number) => (x >= 1000 ? t.legendaryWin : x >= 250 ? t.epicWin : x >= 75 ? t.megaWin : t.bigWin);

export function BuyMenu({
  active,
  canBuy,
  bet,
  fmtCash,
  onToggle,
  onBuy,
  onClose,
  hidden,
}: {
  hidden?: (m: ModeInfo) => boolean;
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
      <p>{t.blurbs[m.id] ?? m.blurb}</p>
      <div className="price">{fmtCash(bet * m.cost)}</div>
      {m.kind === "buy" ? (
        <button disabled={!canBuy} onClick={() => onBuy(m.id)}>
          {t.buy}
        </button>
      ) : (
        <button className="ghost" disabled={!canBuy} onClick={() => onToggle(active === m.id ? "base" : m.id)}>
          {active === m.id ? t.deactivate : t.activate}
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
        <h2>{t.features}</h2>
        <div className="cards">{MODES.filter((m) => m.kind !== "spin" && !hidden?.(m)).map(card)}</div>
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

const RULES = isRu
  ? {
      intro:
        "Слот 5×5 с выплатами за кластеры и каскадами. Кластер — 5 и более одинаковых символов, соединённых по горизонтали или вертикали. Платит каждый кластер; выигрышные символы исчезают, сверху падают новые, пока образуются кластеры. Диких символов нет. RTP 96,00% во всех режимах. Максимальный выигрыш — 25 000× ставки.",
      pay: "Таблица выплат (× ставки)",
      vaultsH: "Сундуки",
      vaults:
        "Под каждым барабаном стоит сундук. Сундуки активны в бесплатных вращениях и рейдах, но не в обычной игре. Ряд барабана считается выигранным, когда его символ входит в выигрышный кластер; выигранные ряды сохраняются до конца раунда. Когда барабан выиграл нужные ряды, его сундук открывается. В конце раунда каждый открытый сундук показывает 2×, 3×, 4×, 5×, 6×, 7×, 8×, 9×, 10×, 25×, 50× или 100×, и выигрыш раунда умножается на все эти множители вместе. Закрытый сундук считается как 1×.",
      fsH: "Бесплатные вращения",
      fs: "3, 4 или 5 нимбов дают Cloud Bonus, Super Cloud или Epic Cloud — 10 бесплатных вращений. Каждый нимб в бесплатных вращениях добавляет 1 вращение. В Cloud Bonus и Super Cloud сундук открывается после выигрыша всех 5 рядов барабана; в Epic Cloud достаточно трёх средних рядов. В Super Cloud, Epic Cloud и Thunder Raid каждый сундук минимум 5×.",
      featH: "Режимы",
      fine: "Неисправность аннулирует все выплаты и игры. Прерванный раунд продолжится при следующем открытии игры.",
    }
  : {
      intro:
        "5×5 cluster pays with tumbles. A cluster is 5 or more matching symbols touching horizontally or vertically. Every cluster pays; winning symbols are removed and new ones fall in until no cluster forms. No wilds. RTP 96.00% in every mode. Max win 25,000× the bet.",
      pay: "Paytable (× bet)",
      vaultsH: "Vaults",
      vaults:
        "A vault sits under every reel. Vaults are live in free spins and raids, never in normal spins. A reel's row is won when one of its symbols is part of a winning cluster; won rows stay won for the rest of the round. When a reel has won the rows its feature requires, its vault unlocks. At the end of the round every unlocked vault reveals 2×, 3×, 4×, 5×, 6×, 7×, 8×, 9×, 10×, 25×, 50× or 100×, and the round win is multiplied by all of them together. A locked vault counts as 1×.",
      fsH: "Free spins",
      fs: "3, 4 or 5 Halos award Cloud Bonus, Super Cloud or Epic Cloud with 10 free spins. Every Halo that lands during free spins adds 1 free spin. Cloud Bonus and Super Cloud unlock a vault when all 5 rows of its reel have won; Epic Cloud needs only the middle three rows. In Super Cloud, Epic Cloud and Thunder Raid every unlocked vault is worth at least 5×.",
      featH: "Features",
      fine: "Malfunction voids all pays and plays. Interrupted rounds resume when the game is reopened.",
    };

export function InfoModal({
  onClose,
  Sym,
  soundOn,
  turbo,
  onSound,
  onTurbo,
}: {
  onClose: () => void;
  Sym: (p: { sym: string }) => React.ReactElement;
  soundOn: boolean;
  turbo: boolean;
  onSound: () => void;
  onTurbo: () => void;
}) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-body info" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>{t.settings}</h2>
        <div className="settings">
          <button className={soundOn ? "on" : ""} onClick={onSound}>
            {t.sound}: {soundOn ? t.on : t.off}
          </button>
          <button className={turbo ? "on" : ""} onClick={onTurbo}>
            {t.turbo}: {turbo ? t.on : t.off}
          </button>
        </div>
        <h2>{t.rules}</h2>
        <p>{RULES.intro}</p>
        <h3>{RULES.pay}</h3>
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
        <h3>{RULES.vaultsH}</h3>
        <p>{RULES.vaults}</p>
        <h3>{RULES.fsH}</h3>
        <p>{RULES.fs}</p>
        <h3>{RULES.featH}</h3>
        <ul>
          {MODES.filter((m) => m.kind !== "spin").map((m) => (
            <li key={m.id}>
              <b>{m.title}</b> ({m.cost}×) — {t.blurbs[m.id] ?? m.blurb}
            </li>
          ))}
        </ul>
        <p className="fine">{RULES.fine}</p>
      </div>
    </div>
  );
}
