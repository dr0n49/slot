import type { Copy } from "../game/social";
import { handNameFor } from "./SidePanels";
import type { GodotWinLine } from "./SlotGame";

type Props = {
  lines: GodotWinLine[];
  copy: Copy;
  turbo: boolean;
};

/**
 * Per-line win labels over the Godot board: localized hand name + cash.
 *
 * Drawn here rather than inside Godot so every language renders: Godot's
 * label font is a Latin-only Oswald subset (Cyrillic, CJK, Arabic, Hindi
 * would show as empty boxes), while the browser falls back per glyph to a
 * system font. Godot still decides WHERE each label goes (nx/ny, normalized
 * over the iframe) and the exact cents per line, so labels always add up to
 * the booked win. Sizes are in cqh of the board box (.godot-board).
 */
export function WinLineLabels({ lines, copy, turbo }: Props) {
  const stagger = turbo ? 0.05 : 0.12;
  const placed = lines.filter((l) => l.nx != null && l.ny != null);
  if (placed.length === 0) return null;
  return (
    <div className="win-line-labels" aria-hidden>
      {placed.map((l, i) => {
        const mult = l.multFactor > 1 ? `  ×${Math.round(l.multFactor)}` : "";
        return (
          <div
            key={`${l.lineId}-${i}`}
            className="win-line-label"
            style={{
              left: `${(l.nx ?? 0.5) * 100}%`,
              top: `${(l.ny ?? 0.5) * 100}%`,
              animationDelay: `${i * stagger}s`,
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
