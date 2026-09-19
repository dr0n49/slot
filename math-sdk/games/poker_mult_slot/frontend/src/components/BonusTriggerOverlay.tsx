import { assetUrl } from "../game/assets";
import { mathConfig } from "../game/engine";
import type { Copy } from "../game/social";
import { CeleWord } from "./Celebration";

type Props = {
  onContinue: () => void;
  copy: Copy;
};

/** Bonus trigger — CONGRATULATIONS → YOU HAVE WON → spins cloud → tap. */
export function BonusTriggerOverlay({ onContinue, copy }: Props) {
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
            src={assetUrl("assets/ui/ink-plate.svg")}
            alt=""
            className="fs-cloud-img"
            draggable={false}
            aria-hidden
          />
          <span className="fs-cloud-num tabular-nums">{mathConfig.fsCount}</span>
        </div>
        <p className="cele-caption">{copy.freeSpins}</p>
        <div className="cta-hint cele-hint">{copy.tapToContinue}</div>
      </div>
    </button>
  );
}
