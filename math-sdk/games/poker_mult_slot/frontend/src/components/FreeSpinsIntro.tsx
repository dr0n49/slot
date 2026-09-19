import { mathConfig } from "../game/engine";
import type { Copy } from "../game/social";

type Props = {
  copy: Copy;
  /** Awarded free-spin count (defaults to config fsCount). */
  count?: number;
};

/**
 * Short auto intro before the free-spin board takes over —
 * dim + scale/fade headline, no tap required.
 */
export function FreeSpinsIntro({ copy, count = mathConfig.fsCount }: Props) {
  return (
    <div
      className="fs-intro-overlay fixed inset-0 z-[68] flex items-center justify-center px-4 text-center"
      aria-live="polite"
      role="status"
    >
      <div className="fs-intro-panel">
        <p className="fs-intro-title">{copy.freeSpins}!</p>
        <p className="fs-intro-count">{copy.bootBonusCaption(count)}</p>
      </div>
    </div>
  );
}
