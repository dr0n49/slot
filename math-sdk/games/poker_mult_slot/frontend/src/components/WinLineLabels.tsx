import { useEffect, useMemo, useState } from "react";
import type { Copy } from "../game/social";
import { handNameFor } from "./SidePanels";
import type { GodotWinLine } from "./SlotGame";

type Props = {
  lines: GodotWinLine[];
  copy: Copy;
  turbo: boolean;
  /** B2: a skipped presentation hold snaps every label in at once (the
   *  staggered pop would otherwise keep hand names appearing for ~1 s). */
  instant?: boolean;
  compact?: boolean;
};

/**
 * Localized hand names and cash over either board renderer.
 *
 * Drawn here rather than inside Godot so every language renders: Godot's
 * label font is a Latin-only Oswald subset (Cyrillic, CJK, Arabic, Hindi
 * would show as empty boxes), while the browser falls back per glyph to a
 * system font. The renderer supplies each anchor (nx/ny) and exact cents,
 * so all resolved labels add up to
 * the booked win. Sizes are in cqh of the board box (.godot-board).
 */
export function WinLineLabels({ lines, copy, turbo, instant, compact }: Props) {
  const reduced=useMemo(()=>matchMedia("(prefers-reduced-motion: reduce)").matches,[]);
  const [focus,setFocus]=useState(0);
  const all=!!instant||turbo||reduced||lines.length<=1;
  useEffect(()=>{
    if(all){setFocus(2);return}
    const second=window.setTimeout(()=>setFocus(1),350);
    const resolved=window.setTimeout(()=>setFocus(2),600);
    return()=>{window.clearTimeout(second);window.clearTimeout(resolved)};
  },[all]);
  const ordered=lines.filter((l) => l.nx != null && l.ny != null).sort((a,b)=>b.cents-a.cents);
  const placed=all||focus>=2?ordered:ordered.slice(focus,focus+1);
  if (placed.length === 0) return null;
  return (
    <div className={`win-line-labels${compact ? " is-compact" : ""}`} aria-hidden>
      {placed.map((l, i) => {
        const mult = l.multFactor > 1 ? `  ×${Math.round(l.multFactor)}` : "";
        return (
          <div
            key={`${l.lineId}-${i}`}
            className="win-line-label"
            style={{
              left: `${(l.nx ?? 0.5) * 100}%`,
              top: `${(l.ny ?? 0.5) * 100}%`,
              animationDelay: "0s",
            }}
          >
            <span className="win-line-name">
              {handNameFor(copy, l.handIndex)}
              {mult}
            </span>
            <span className="win-line-cash tabular-nums">{copy.money(l.cash)}</span>
          </div>
        );
      })}
    </div>
  );
}
