import type { Copy } from "../game/social";
import { audio } from "../game/audio";
import { CountUpAmount } from "./CountUpAmount";
import { useBoardAnchoredCta } from "./useBoardAnchoredCta";

type Props = {
  amount: number;
  onContinue: () => void;
  copy: Copy;
};

/**
 * End-of-bonus summary, Cook Out composition: dim table (no card, no splat),
 * white TOTAL WIN over the big gold amount counting up in whole cents (≤1.8s),
 * tap-anywhere hint above the HUD. In portrait the hint anchors to the board's
 * bottom strip (see useBoardAnchoredCta) so it never overlaps the HUD.
 * C3: a short chip-lock lands exactly when the count reaches the final amount.
 */
export function BonusCompleteOverlay({ amount, onContinue, copy }: Props) {
  const ctaStyle = useBoardAnchoredCta();

  return (
    <button
      type="button"
      className="cele-overlay total-scrim fixed inset-0 z-[70] text-center"
      onClick={onContinue}
    >
      <div className="total-win-stack absolute inset-0 flex flex-col items-center justify-center px-4">
        <div className="total-win-label">{copy.totalWin}</div>
        <div className="total-win-amount tabular-nums">
          <CountUpAmount
            value={amount}
            format={copy.money}
            durationMs={1800}
            onCountEnd={audio.playChipLock}
          />
        </div>
      </div>
      <div className="cta-hint total-win-cta" style={ctaStyle}>{copy.tapToContinue}</div>
    </button>
  );
}
