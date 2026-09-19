import { useEffect, useRef, useState } from "react";

import { assetUrl } from "../game/assets";
import type { Copy } from "../game/social";

type Props = {
  spinsLeft: number;
  /** Running sum of all × landed during this bonus */
  bank: number;
  copy: Copy;
};

/**
 * Left rail during free spins: the ivory cartoon cloud carries the running
 * ×bank (wakes with the first multiplier, same cloud as the 10-spins trigger,
 * smaller), and the candy tile shows the spins left.
 */
export function BonusBanner({ spinsLeft, bank, copy }: Props) {
  const bankShow = Math.max(0, Math.round(bank));
  const hasBank = bankShow > 0;
  const digits = String(bankShow).length;
  const digitClass =
    digits >= 4 ? "is-digits-4" : digits === 3 ? "is-digits-3" : digits === 2 ? "is-digits-2" : "is-digits-1";

  const [strike, setStrike] = useState(false);
  const prevBank = useRef(bank);
  useEffect(() => {
    const grew = bank > prevBank.current;
    prevBank.current = bank;
    if (!grew) return;
    setStrike(true);
    const t = setTimeout(() => setStrike(false), 750);
    return () => clearTimeout(t);
  }, [bank]);

  return (
    <aside className="bonus-side-panel pointer-events-none absolute left-2 top-16 z-[50] w-[7.75rem] sm:left-4 sm:top-20 sm:w-[10rem]">
      <div className="bonus-side-stack flex flex-col items-center gap-3.5 sm:gap-5">
        <div className={`bank-cloud ${hasBank ? "bank-cloud-live" : "bank-cloud-empty"} ${strike ? "bank-strike" : ""}`}>
          <img
            src={assetUrl("assets/ui/ink-plate.svg")}
            alt=""
            className="bank-cloud-img"
            draggable={false}
            aria-hidden
          />
          <span className={`bank-cloud-value tabular-nums ${digitClass}`}>×{bankShow}</span>
        </div>

        <div className="spins-plaque w-full">
          <div className="spins-plaque-inner">
            <div className="spins-caption">{copy.freeSpinsLeft}</div>
            <div className="spins-remaining leading-none tabular-nums">{spinsLeft}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
