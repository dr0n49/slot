import { useEffect, useState } from "react";
import type { Copy } from "../game/social";

type Props = {
  amount: number;
  onContinue: () => void;
  copy: Copy;
};

/**
 * End-of-bonus summary, Cook Out composition: dim table (no card, no splat),
 * white TOTAL WIN over the big gold amount counting up in whole cents (≤1.8s),
 * tap-anywhere hint above the HUD.
 */
export function BonusCompleteOverlay({ amount, onContinue, copy }: Props) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const t0 = performance.now();
    const dur = 1800;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      // whole cents per frame — no wet fractional strings
      setShown(Math.round(amount * eased * 100) / 100);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [amount]);

  return (
    <button
      type="button"
      className="cele-overlay total-scrim fixed inset-0 z-[70] text-center"
      onClick={onContinue}
    >
      <div className="total-win-stack absolute inset-0 flex flex-col items-center justify-center px-4">
        <div className="total-win-label">{copy.totalWin}</div>
        <div className="total-win-amount tabular-nums">{copy.money(shown)}</div>
      </div>
      <div className="cta-hint total-win-cta">{copy.tapToContinue}</div>
    </button>
  );
}
