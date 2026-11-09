import type { ReactNode } from "react";
import { AutoplayIcon } from "../art/AutoplayIcon";
import "./betbar.css";

/**
 * The bet bar: a neutral, game-independent HUD in the layout most Stake Engine studios share
 * (Valkyrie, Massive, Titan, Twist, Uppercut, Paperclip). Landscape: one full-width strip — menu,
 * feature, balance, win … − bet +, autoplay, spin, turbo. Portrait: a control row round the spin
 * (menu, −, spin, +, autoplay; feature and turbo above the corners) over a Balance | Bet | Win strip.
 * Win is always shown. Everything is laid out by one CSS grid (betbar.css), so it carries to other games:
 * the game passes values and handlers, and a `feature` slot for its own buy button.
 */
export type BetBarProps = {
  labels: { balance: string; win: string; bet: string; menu: string; spin: string; autoStop: string; autoplay: string; turbo: string; increase: string; decrease: string };
  balance: string | null; // null hides it (replays)
  win: ReactNode;
  winLabel?: string; // e.g. "Total win" in free spins
  winning: boolean; // highlights the win value
  bet: { label: string; value: string; sub?: string };
  /** Free spins: the bet cell shows the spins left and the bet controls, spin and autoplay step aside. */
  freeSpins?: { label: string; left: number } | null;
  canDecrease: boolean;
  canIncrease: boolean;
  betLocked: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  spin: { show: boolean; disabled: boolean; spinning: boolean; autoLeft: number; onClick: () => void } | null;
  auto: { disabled: boolean; active: boolean; onClick: () => void } | null;
  turbo: { on: boolean; onClick: () => void } | null;
  menu: { open: boolean; onClick: (e: React.MouseEvent) => void };
  feature?: ReactNode;
  onTapStats?: () => void;
};

const Minus = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M6 12h12" /></svg>;
const Plus = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M6 12h12M12 6v12" /></svg>;
const Burger = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
const Close = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>;
const Bolt = () => <svg viewBox="0 0 24 24" aria-hidden><path className="fill" d="M13.5 2 5 13.5h6L10 22l9-12h-6.2z" /></svg>;

export function BetBar(p: BetBarProps) {
  const fs = p.freeSpins;
  const showBetControls = !fs && !!p.spin;
  return (
    <div className={`bb ${fs ? "bb-fs" : ""}`} role="group" aria-label="Bet bar">
      <button className="bb-btn bb-menu" onClick={p.menu.onClick} aria-expanded={p.menu.open} aria-controls="audio-menu" aria-label={p.labels.menu}>
        {p.menu.open ? <Close /> : <Burger />}
      </button>
      <div className="bb-feature">{p.feature}</div>

      {p.balance !== null && (
        <div className="bb-stat bb-balance">
          <small>{p.labels.balance}</small>
          <b>{p.balance}</b>
        </div>
      )}
      <div className={`bb-stat bb-win ${p.winning ? "on" : ""}`} onClick={p.onTapStats}>
        <small>{p.winLabel ?? p.labels.win}</small>
        <b>{p.win}</b>
      </div>

      <div className="bb-stat bb-bet">
        {fs ? (
          <>
            <small>{fs.label}</small>
            <b>{fs.left}</b>
          </>
        ) : (
          <>
            <small>{p.bet.label}</small>
            <b>{p.bet.value}</b>
            {p.bet.sub && <em>{p.bet.sub}</em>}
          </>
        )}
      </div>
      {showBetControls && (
        // Landscape stacks them small beside the bet (+ over −); portrait lays them either side of the spin.
        <div className="bb-steps">
          <button className="bb-btn bb-inc" disabled={p.betLocked || !p.canIncrease} onClick={p.onIncrease} aria-label={p.labels.increase}><Plus /></button>
          <button className="bb-btn bb-dec" disabled={p.betLocked || !p.canDecrease} onClick={p.onDecrease} aria-label={p.labels.decrease}><Minus /></button>
        </div>
      )}

      {!fs && p.auto && (
        <button className={`bb-btn bb-auto ${p.auto.active ? "on" : ""}`} disabled={p.auto.disabled} onClick={p.auto.onClick} aria-label={p.labels.autoplay} aria-pressed={p.auto.active}>
          <AutoplayIcon />
        </button>
      )}
      {!fs && p.spin?.show && (
        <button className={`bb-spin ${p.spin.spinning ? "spinning" : ""} ${p.spin.autoLeft > 0 ? "auto" : ""}`} onClick={p.spin.onClick} disabled={p.spin.disabled}
          aria-label={p.spin.autoLeft > 0 ? p.labels.autoStop : p.labels.spin}>
          {p.spin.autoLeft > 0 ? (
            <span className="bb-auto-left">{p.spin.autoLeft}</span>
          ) : (
            <svg viewBox="10 10 80 80" aria-hidden>
              <path d="M20.5 45A30 30 0 0 1 72 30" />
              <path className="head" d="M81.5 21.3L62.5 38.7L85.4 44.6Z" />
              <path d="M79.5 55A30 30 0 0 1 28 70" />
              <path className="head" d="M18.5 78.7L37.5 61.3L14.6 55.4Z" />
            </svg>
          )}
        </button>
      )}
      {p.turbo && (
        <button className={`bb-btn bb-turbo ${p.turbo.on ? "on" : ""}`} onClick={p.turbo.onClick} aria-label={p.labels.turbo} aria-pressed={p.turbo.on}>
          <Bolt />
        </button>
      )}
    </div>
  );
}
