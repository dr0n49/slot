import { mathConfig } from "../game/engine";
import type { Copy } from "../game/social";
import type { CSSProperties } from "react";

type Props = {
  copy: Copy;
  /** Awarded free-spin count (defaults to config fsCount). */
  count?: number;
  durationMs: number;
  resolved: boolean;
};

/**
 * Short auto intro before the free-spin board takes over —
 * dim + scale/fade headline, no tap required.
 */
export function FreeSpinsIntro({ copy, count = mathConfig.fsCount, durationMs, resolved }: Props) {
  return (
    <div
      className={`fs-intro-overlay${resolved ? " is-resolved" : ""} fixed inset-0 z-[68] flex items-center justify-center px-4 text-center`}
      style={{ "--fs-intro-duration": `${durationMs}ms` } as CSSProperties}
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
