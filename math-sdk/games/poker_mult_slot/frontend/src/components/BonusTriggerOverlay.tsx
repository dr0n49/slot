import { createPortal } from "react-dom";
import { assetUrl } from "../game/assets";
import { mathConfig } from "../game/engine";
import type { Copy } from "../game/social";
import { CeleWord } from "./Celebration";
import { useBoardAnchoredCta } from "./useBoardAnchoredCta";

type Props = {
  onContinue: () => void;
  copy: Copy;
};

/** Bonus trigger — CONGRATULATIONS → YOU HAVE WON → spins cloud → tap.
 *  In portrait the hint anchors to the board's bottom strip
 *  (see useBoardAnchoredCta) so it never overlaps the HUD. */
export function BonusTriggerOverlay({ onContinue, copy }: Props) {
  const ctaStyle = useBoardAnchoredCta();
  return (
    <button
      type="button"
      className="cele-overlay cele-overlay-dim fixed inset-0 z-[70] flex items-center justify-center px-4 text-center"
      onClick={onContinue}
    >
      <div className="relative z-10 flex flex-col items-center">
        <CeleWord variant="congrats">{copy.congratulations}</CeleWord>
        <p className="cele-sub">{copy.youWon}</p>
        <div className="fs-cloud splash-settle">
          <img
            src={assetUrl("assets/ui/bank-plate.svg")}
            alt=""
            className="fs-cloud-img"
            draggable={false}
            aria-hidden
          />
          <span className="fs-cloud-num tabular-nums">{mathConfig.fsCount}</span>
        </div>
        <p className="cele-caption">{copy.freeSpins}</p>
      </div>
      {/* B5: body portal — see BonusCompleteOverlay (fixed-position hints must
          not be children of the scaled .game-stage). */}
      {ctaStyle ? (
        createPortal(
          <div className="cta-hint cele-hint" style={ctaStyle}>{copy.tapToContinue}</div>,
          document.body,
        )
      ) : (
        <div className="cta-hint cele-hint">{copy.tapToContinue}</div>
      )}
    </button>
  );
}
