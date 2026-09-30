import { useLayoutEffect, useState } from "react";
import { isLiteFx } from "../game/fxMode";
import { createPortal } from "react-dom";
import { BONUS_BEATS } from "./bonusBeats";

export type BankBeat = { rev: number; indices: number[]; add: number };

/** One collected thread for the engine's eligible bank increment. No currency. */
export function BankCollection({ beat }: { beat: BankBeat }) {
  const [path, setPath] = useState<string>();
  const lite = isLiteFx();
  useLayoutEffect(() => {
    const board = document.querySelector(".godot-board")?.getBoundingClientRect();
    const bank = document.querySelector(".bank-cloud-value")?.getBoundingClientRect();
    if (!board || !bank || !beat.indices.length) return;
    // Match the scene's immutable 800×1146 card geometry. Only eligible
    // winning, non-Joker multiplier cells supplied by the React owner count.
    const sx = beat.indices.reduce((n, i) => n + 40 + i % 5 * 146 + 67, 0) / beat.indices.length;
    const sy = beat.indices.reduce((n, i) => n + 72 + Math.floor(i / 5) * 205 + 94, 0) / beat.indices.length;
    const x = board.x + sx * board.width / 800, y = board.y + sy * board.height / 1146;
    const bx = bank.x + bank.width / 2, by = bank.y + bank.height / 2;
    setPath(`M ${x} ${y} Q ${(x + bx) / 2} ${Math.min(y, by) - 24} ${bx} ${by}`);
  }, [beat]);
  if (!path || matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  return createPortal(<svg className="bank-collection" aria-hidden data-rev={beat.rev} data-add={beat.add}>
    <path d={path} pathLength={1} className="bank-collection-thread" />
    {Array.from({ length: lite ? 3 : 6 }, (_, i) => <circle key={i} r={i ? 1 : 2.3}
      className="bank-collection-fleck" style={{ offsetPath: `path('${path}')`, animationDelay: `${i * 9}ms`, animationDuration: `${BONUS_BEATS.bank-i*9}ms` }} />)}
  </svg>, document.body);
}
