import { t } from "../i18n";
import "./replay.css";

export type ReplaySummary = {
  mode: string; // shown as given (mode names stay in their original language)
  baseBet: string;
  costMultiplier: string;
  totalCost: string;
  payoutMultiplier: string;
  totalWin: string;
};

/**
 * Stake Engine replay card: Mode, Base Bet, Cost Multiplier, Total Bet Cost, Payout Multiplier and Total Win, with
 * the button that plays the round. Shown before the replay starts and again when it ends (`again`), so the same
 * round can be watched once more. Social sessions get the social wording through `t`.
 */
export function ReplayCard({ s, again = false, disabled = false, onStart }: { s: ReplaySummary; again?: boolean; disabled?: boolean; onStart: () => void }) {
  const c = t.replayCard;
  return (
    <section className="rc" role="dialog" aria-modal="true" aria-labelledby="rc-title">
      <header className="rc-head">
        <span className="rc-badge">{t.replay}</span>
        <h1 id="rc-title" className="rc-title">{c.title}</h1>
      </header>
      <dl className="rc-table">
        <div className="rc-row rc-mode"><dt>{c.mode}</dt><dd>{s.mode}</dd></div>
        <div className="rc-group">
          <div className="rc-row"><dt>{c.baseBet}</dt><dd>{s.baseBet}</dd></div>
          <div className="rc-row"><dt>{c.costMultiplier}</dt><dd>{s.costMultiplier}</dd></div>
          <div className="rc-row rc-sum"><dt>{c.totalCost}</dt><dd>{s.totalCost}</dd></div>
        </div>
        <div className="rc-group rc-wins">
          <div className="rc-row"><dt>{c.payoutMultiplier}</dt><dd>{s.payoutMultiplier}</dd></div>
          <div className="rc-row rc-sum"><dt>{c.totalWin}</dt><dd>{s.totalWin}</dd></div>
        </div>
      </dl>
      <button className="rc-start" onClick={onStart} disabled={disabled} autoFocus>
        <svg viewBox="0 0 24 24" aria-hidden><path d="M7 4.5v15l12.5-7.5z" /></svg>
        {again ? c.again : c.start}
      </button>
      <p className="rc-note">{c.note}</p>
    </section>
  );
}
