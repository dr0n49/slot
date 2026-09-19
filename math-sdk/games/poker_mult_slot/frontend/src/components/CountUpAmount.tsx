import { useEffect, useState } from "react";

type Props = {
  value: number;
  format: (n: number) => string;
  /** ms — turbo callers can pass a shorter duration */
  durationMs?: number;
  className?: string;
};

/** Ease-out count-up from 0 → value (cash). */
export function CountUpAmount({ value, format, durationMs = 720, className }: Props) {
  const [shown, setShown] = useState(() => format(0));

  useEffect(() => {
    const target = Number(value) || 0;
    if (target <= 0) {
      setShown(format(0));
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setShown(format(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setShown(format(target));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, format, durationMs]);

  return <span className={className}>{shown}</span>;
}
