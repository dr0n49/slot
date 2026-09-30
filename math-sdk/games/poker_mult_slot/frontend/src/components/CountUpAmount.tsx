import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  format: (n: number) => string;
  /** ms — turbo callers can pass a shorter duration */
  durationMs?: number;
  className?: string;
  /** Skip/interruption shows the exact value in this render and cancels ticks. */
  finishNow?: boolean;
  /** Cumulative bonus totals continue from the amount already visible. */
  continueFromCurrent?: boolean;
  /** C3: quiet tick every ~85 ms while the count is VISIBLE (pass audio.playCountTick). */
  onTick?: () => void;
  /** C3: fires exactly once when the count reaches its final value. */
  onCountEnd?: () => void;
};

const TICK_EVERY_MS = 85;

/** Ease-out count-up from 0 → value (cash). */
export function CountUpAmount({ value, format, durationMs = 720, className, finishNow, continueFromCurrent, onTick, onCountEnd }: Props) {
  const [shown, setShown] = useState(() => format(0));
  const shownValue = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    if (finishNow) {
      shownValue.current = target;
      setShown(format(target));
      return;
    }
    if (target <= 0) {
      shownValue.current = 0;
      setShown(format(0));
      return;
    }
    const from = continueFromCurrent ? shownValue.current : 0;
    // A new bonus/reset replaces the old total immediately, never counts down.
    if (continueFromCurrent && from >= target) {
      shownValue.current = target;
      setShown(format(target));
      return;
    }
    let raf = 0;
    let lastTick = -Infinity;
    let ended = false;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      shownValue.current = from + (target - from) * eased;
      setShown(format(shownValue.current));
      if (onTick && now - lastTick >= TICK_EVERY_MS) {
        lastTick = now;
        onTick();
      }
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        shownValue.current = target;
        setShown(format(target));
        if (!ended) {
          ended = true;
          onCountEnd?.();
        }
      }
    };
    raf = requestAnimationFrame(tick);
    // Unmount (skip, next spin) stops the ticks with the count itself.
    return () => cancelAnimationFrame(raf);
  }, [value, format, durationMs, finishNow, continueFromCurrent, onTick, onCountEnd]);

  return <span className={className}>{finishNow ? format(Number(value) || 0) : shown}</span>;
}
