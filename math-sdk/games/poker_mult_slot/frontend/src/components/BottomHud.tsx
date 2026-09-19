import { useEffect, useRef, useState } from "react";
import type { Copy } from "../game/social";
import { CountUpAmount } from "./CountUpAmount";
import { AutoMark, HudBoltMark, InfoMark, MinusMark, PlusMark, SpeakerMark, SpinArrowMark } from "./marks";

export type HudWin =
  | { key: number; mode: "win"; amount: number }
  | { key: number; mode: "total"; label: string; amount: number }
  | { key: number; mode: "max"; text: string };

/** Shared WIN face — HUD center (landscape) or under the slot frame (portrait). */
export function HudWinFace({
  win,
  money,
  formatWin,
}: {
  win: HudWin | null;
  money: (n: number) => string;
  formatWin: (amount: string) => string;
}) {
  if (!win) return null;
  if (win.mode === "total") {
    return (
      <div key={win.key} className="hud-win-copy hud-win-total whitespace-nowrap">
        <span className="hud-win-label">{win.label}</span>
        <CountUpAmount
          value={win.amount}
          format={money}
          className="hud-win-amount tabular-nums"
        />
      </div>
    );
  }
  if (win.mode === "max") {
    return (
      <div key={win.key} className="result-reveal win-plaque">
        {win.text}
      </div>
    );
  }
  return (
    <div key={win.key} className="result-reveal win-plaque win-plaque-count">
      <WinLabelWithCount formatWin={formatWin} money={money} amount={win.amount} />
    </div>
  );
}

/** Keep localized "WIN {amount}" shape while the number ticks up. */
function WinLabelWithCount({
  amount,
  money,
  formatWin,
}: {
  amount: number;
  money: (n: number) => string;
  formatWin: (amount: string) => string;
}) {
  const final = money(amount);
  const template = formatWin("\u0000");
  const [left, right] = template.split("\u0000");
  return (
    <>
      {left}
      <CountUpAmount value={amount} format={money} />
      {right}
      {/* ensure layout matches final string width roughly */}
      <span className="sr-only">{formatWin(final)}</span>
    </>
  );
}

type Props = {
  balance: number;
  bet: number;
  anteBet: number | null;
  turbo: boolean;
  auto: boolean;
  /** Remaining autoplay spins (0 = not running; may be Infinity for endless). */
  autoLeft: number;
  busy: boolean;
  bonusActive: boolean;
  copy: Copy;
  win: HudWin | null;
  onMenu: () => void;
  onBuyBonus: () => void;
  soundOn: boolean;
  soundVol: number;
  onToggleSound: () => void;
  onSoundVolume: (v: number) => void;
  onBetDown: () => void;
  onBetUp: () => void;
  onSpin: () => void;
  onToggleTurbo: () => void;
  onToggleAuto: () => void;
};

/** Bottom bar: meters on the sides, win in the middle, spin on the right. */
export function BottomHud({
  balance,
  bet,
  anteBet,
  turbo,
  auto,
  autoLeft,
  busy,
  bonusActive,
  copy,
  win,
  onMenu,
  onBuyBonus,
  soundOn,
  soundVol,
  onToggleSound,
  onSoundVolume,
  onBetDown,
  onBetUp,
  onSpin,
  onToggleTurbo,
  onToggleAuto,
}: Props) {
  const hasAnte = anteBet != null && anteBet > 0;
  const stakeLabel = hasAnte ? copy.anteStake : copy.stake;
  const stakeValue = hasAnte ? anteBet! : bet;
  const [volOpen, setVolOpen] = useState(false);
  const soundWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!volOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!soundWrapRef.current?.contains(e.target as Node)) setVolOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [volOpen]);

  const openSound = () => {
    onToggleSound();
    setVolOpen(true);
  };

  return (
    <div className="hud-root relative z-[90] w-full shrink-0 overflow-visible pb-[env(safe-area-inset-bottom)]">
      <div className="hud-bar w-full overflow-visible">
        <div className="hud-inner relative mx-auto grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 overflow-visible px-6 py-3">
          <div className="hud-left flex min-w-0 items-center gap-2">
            <div className="hud-tools">
            <button
              type="button"
              onClick={onMenu}
              className="hud-chip-btn"
              aria-label="Game info"
            >
              <InfoMark className="h-[72%] w-[72%]" />
            </button>

            <div ref={soundWrapRef} className="hud-sound-wrap">
              {volOpen ? (
                <div className="hud-vol-pop" role="dialog" aria-label="Volume">
                  <button
                    type="button"
                    className="hud-vol-pop-btn"
                    onClick={onToggleSound}
                    aria-label={soundOn ? "Mute" : "Unmute"}
                  >
                    <SpeakerMark className="h-4 w-4 shrink-0" muted={!soundOn} />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(soundVol * 100)}
                    onChange={(e) => onSoundVolume(Number(e.target.value) / 100)}
                    className="hud-vol-slider"
                    style={{ ["--hud-vol" as string]: `${Math.round(soundVol * 100)}%` }}
                    aria-label="Volume"
                  />
                  <span className="hud-vol-num">{Math.round(soundVol * 100)}</span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={openSound}
                className={`hud-chip-btn ${soundOn ? "" : "is-muted"}`}
                aria-label={soundOn ? "Mute" : "Unmute"}
                title={soundOn ? "Mute" : "Unmute"}
              >
                <SpeakerMark className="h-[72%] w-[72%]" muted={!soundOn} />
              </button>
            </div>

            <button
              type="button"
              disabled={busy || bonusActive}
              onClick={onBuyBonus}
              className="hud-bonus-btn disabled:opacity-40"
            >
              {hasAnte ? copy.disable : copy.stormBonus}
            </button>

            </div>

            <div className="hud-meter text-left">
              <div className="hud-meter-label">{copy.balance}</div>
              <div className="hud-meter-value">{copy.money(balance)}</div>
            </div>
          </div>

          <div className="hud-win" aria-live="polite">
            <HudWinFace win={win} money={copy.money} formatWin={copy.win} />
          </div>

          <div className="hud-right ml-auto flex shrink-0 items-center justify-end gap-2 sm:gap-3">
            <div className="hud-stake">
            <div className="hud-meter text-right">
              <div className="hud-meter-label">{stakeLabel}</div>
              <div className="hud-meter-value">{copy.money(stakeValue)}</div>
            </div>

            <div className="hud-bet-col">
              <button
                type="button"
                disabled={busy || bonusActive}
                onClick={onBetUp}
                className="hud-icon-btn"
                aria-label="Increase stake"
              >
                <PlusMark className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>
              <button
                type="button"
                disabled={busy || bonusActive}
                onClick={onBetDown}
                className="hud-icon-btn"
                aria-label="Decrease stake"
              >
                <MinusMark className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>
            </div>

            </div>

            <div className="hud-spin-slot">
              <button
                type="button"
                disabled={busy && !auto}
                onClick={() => {
                  if (auto) onToggleAuto();
                  else onSpin();
                }}
                className="respin-btn hud-spin relative z-40 flex h-[100px] w-[100px] items-center justify-center rounded-full disabled:opacity-60"
                aria-label={auto ? "Stop autoplay" : "Spin"}
              >
                {autoLeft > 0 ? (
                  <span className="auto-count-badge tabular-nums">
                    {Number.isFinite(autoLeft) ? autoLeft : "∞"}
                  </span>
                ) : (
                  <SpinArrowMark className="spin-arrow h-full w-full" />
                )}
              </button>
            </div>

            <div className="hud-fx-row">
              <button
                type="button"
                onClick={onToggleTurbo}
                className={`hud-sq-btn ${turbo ? "is-on" : ""}`}
                aria-label="Turbo"
                title="Turbo"
              >
                <HudBoltMark className="h-[58%] w-[58%]" />
              </button>
              <button
                type="button"
                onClick={onToggleAuto}
                className={`hud-sq-btn ${auto ? "is-on" : ""}`}
                aria-label={copy.auto}
                title={copy.auto}
              >
                <AutoMark className="h-[70%] w-[70%]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
