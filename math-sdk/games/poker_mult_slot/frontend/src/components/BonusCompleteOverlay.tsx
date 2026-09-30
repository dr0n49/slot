import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
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
 * bone TOTAL WIN over the gold amount counting up in whole cents (1.6s),
 * tap-anywhere hint above the HUD. In portrait the hint anchors to the board's
 * bottom strip (see useBoardAnchoredCta) so it never overlaps the HUD.
 * C3: a short chip-lock lands exactly when the count reaches the final amount.
 */
export function BonusCompleteOverlay({ amount, onContinue, copy }: Props) {
  const ctaStyle = useBoardAnchoredCta();
  const [resolved, setResolved] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const resolvedAt = useRef(resolved ? performance.now() : Infinity);
  const continued = useRef(false), locked = useRef(false);
  const continuation = useRef(onContinue);
  continuation.current = onContinue;
  const showFinal = useCallback(() => {
    if (!Number.isFinite(resolvedAt.current)) resolvedAt.current = performance.now();
    setResolved(true);
    if (!locked.current) { locked.current = true; audio.playChipLock(); }
  }, []);
  const advance = useCallback(() => {
    if (!Number.isFinite(resolvedAt.current)) { showFinal(); return; }
    if (continued.current || performance.now() - resolvedAt.current < 350) return;
    continued.current = true;
    continuation.current();
  }, [showFinal]);
  useEffect(() => {
    if (resolved) showFinal();
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) advance();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", showFinal);
    document.addEventListener("visibilitychange", showFinal);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", showFinal);
      document.removeEventListener("visibilitychange", showFinal);
    };
  }, [advance, showFinal]);

  return (
    <button
      type="button"
      className="cele-overlay total-scrim fixed inset-0 z-[70] text-center"
      data-resolved={resolved ? "1" : "0"}
      onClick={advance}
    >
      <div className="total-win-stack absolute inset-0 flex flex-col items-center justify-center px-4">
        <div className="total-win-label">{copy.totalWin}</div>
        <div className="total-win-amount tabular-nums">
          <CountUpAmount
            value={amount}
            format={copy.money}
            durationMs={1600}
            finishNow={resolved}
            onCountEnd={showFinal}
          />
        </div>
      </div>
      {/* B5: the hint renders through a BODY PORTAL — the overlay lives inside
          the scaled .game-stage, where position:fixed maps to the transformed
          box, not the viewport; the hook measures in screen space. */}
      {ctaStyle ? (
        createPortal(
          <div className="cta-hint total-win-cta" style={ctaStyle}>{copy.tapToContinue}</div>,
          document.body,
        )
      ) : (
        <div className="cta-hint total-win-cta">{copy.tapToContinue}</div>
      )}
    </button>
  );
}
