import { useEffect, useState } from "react";

type Props = {
  value: number;
  format: (n: number) => string;
  /** ms — turbo callers can pass a shorter duration */
  durationMs?: number;
  className?: string;
  /** C3: quiet tick every ~85 ms while the count is VISIBLE (pass audio.playCountTick). */
  onTick?: () => void;
  /** C3: fires exactly once when the count reaches its final value. */
  onCountEnd?: () => void;
};

const TICK_EVERY_MS = 85;

/** Ease-out count-up from 0 → value (cash). */
export function CountUpAmount({ value, format, durationMs = 720, className, onTick, onCountEnd }: Props) {
  const [shown, setShown] = useState(() => format(0));

  useEffect(() => {
    const target = Number(value) || 0;
    if (target <= 0) {
      setShown(format(0));
      return;
    }
    let raf = 0;
    let lastTick = -Infinity;
    let ended = false;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setShown(format(target * eased));
      if (onTick && now - lastTick >= TICK_EVERY_MS) {
        lastTick = now;
        onTick();
      }
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
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
  }, [value, format, durationMs, onTick, onCountEnd]);

  return <span className={className}>{shown}</span>;
}
