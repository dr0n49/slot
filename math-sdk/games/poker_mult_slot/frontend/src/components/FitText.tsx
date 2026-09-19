import { useCallback, useEffect, useLayoutEffect, useRef, type ElementType, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Longest allowed text block, in lines. The font shrinks until it fits. */
  maxLines?: number;
  /** Never shrink below this share of the CSS font size. */
  min?: number;
  /** Try to keep the text on ONE line (down to `oneLineMin`) before wrapping it. */
  oneLine?: boolean;
  as?: ElementType;
};

/**
 * Text that always stays inside its box: starts at the CSS font-size and steps
 * down until it neither runs wider than the box nor needs more than `maxLines`
 * lines. Localised strings vary wildly in length (МНОЖИТЕЛИ vs MULTIPLIERS vs
 * 乘数), so nothing here is tuned to one language.
 */
export function FitText({ children, className, maxLines = 1, min = 0.45, oneLine = false, as: Tag = "div" }: Props) {
  const ref = useRef<HTMLElement | null>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.fontSize = "";
    const cs = getComputedStyle(el);
    const base = parseFloat(cs.fontSize);
    if (!Number.isFinite(base) || base <= 0) return;
    const lhRaw = parseFloat(cs.lineHeight);
    const lhRatio = Number.isFinite(lhRaw) ? lhRaw / base : 1.3;
    let size = base;
    const overflows = () => {
      if (el.scrollWidth > el.clientWidth + 0.5) return true;
      return el.scrollHeight > size * lhRatio * maxLines + 1.5;
    };
    const shrink = (floor: number) => {
      let guard = 0;
      while (overflows() && size > floor + 0.01 && guard++ < 60) {
        size = Math.max(floor, size * 0.95);
        el.style.fontSize = `${size}px`;
      }
    };
    el.style.whiteSpace = "";
    if (oneLine && maxLines > 1) {
      // A single line, a little smaller, reads better than a broken word.
      el.style.whiteSpace = "nowrap";
      shrink(base * 0.72);
      if (!overflows()) return;
      el.style.whiteSpace = "";
      size = base;
      el.style.fontSize = "";
    }
    shrink(base * min);
  }, [maxLines, min, oneLine]);

  useLayoutEffect(() => {
    fit();
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fit());
    if (el.parentElement) ro.observe(el.parentElement);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
