import { useEffect, useRef, useState } from "react";
import { assetUrl } from "../game/assets";

export type MascotMood = "idle" | "watch" | "hope" | "win" | "bigwin" | "bonus" | "sad";

type Props = {
  /** Bumps every deal. */
  dealKey: number;
  /** Stake-multiple of the spin now on the board (≤0 = no win). */
  spinWinX: number;
  /** ms after the deal starts until the result is revealed (reels stopped + pause). */
  revealMs: number;
  /** Bonus build-up in progress (2 jokers down, reels still spinning). */
  hope: boolean;
  /** Jokers locked in / bonus intro. */
  bonus: boolean;
  /** Hidden while the free-spins rail owns the side of the screen. */
  hidden?: boolean;
};

const BIG_X = 20;

/**
 * "La Muerta" — the Catrina from the queen card, watching the reels from the
 * left of the board. One image, all acting is CSS on the pose layer + a pair
 * of glowing eyes: idle breathing, tracks the spin, tenses up when a bonus
 * could still drop, cheers on wins, slumps after a missed bonus.
 */
export function Mascot({ dealKey, spinWinX, revealMs, hope, bonus, hidden }: Props) {
  const [mood, setMood] = useState<MascotMood>("idle");
  const timers = useRef<number[]>([]);
  const hadHope = useRef(false);
  const bonusRef = useRef(bonus);
  bonusRef.current = bonus;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearAll = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };

  // New deal → look at the reels, then react to the result once it is revealed.
  useEffect(() => {
    if (dealKey === 0) return;
    clearAll();
    hadHope.current = false;
    setMood("watch");
    later(() => {
      if (bonusRef.current) return; // the bonus effect owns the mood
      if (spinWinX > 0) {
        const big = spinWinX >= BIG_X;
        setMood(big ? "bigwin" : "win");
        later(() => setMood("idle"), big ? 3600 : 1900);
      } else if (hadHope.current) {
        setMood("sad");
        later(() => setMood("idle"), 1700);
      } else {
        setMood("idle");
      }
    }, revealMs);
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey]);

  useEffect(() => {
    if (hope) {
      hadHope.current = true;
      setMood("hope");
    }
  }, [hope]);

  useEffect(() => {
    if (bonus) {
      clearAll();
      setMood("bonus");
    } else {
      setMood((m) => (m === "bonus" ? "idle" : m));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonus]);

  useEffect(() => clearAll, []);

  return (
    <div className="mascot" data-mood={mood} data-hidden={hidden ? "1" : "0"} aria-hidden>
      <div className="mascot-aura" />
      <div className="mascot-sway">
        {/* key restarts the one-shot cheer whenever a new reaction starts */}
        <div className="mascot-pose" key={`${mood}-${dealKey}`}>
          <img
            className="mascot-img"
            src={assetUrl("assets/ui/catrina.png")}
            alt=""
            draggable={false}
          />
          <span className="mascot-eye is-l" />
          <span className="mascot-eye is-r" />
        </div>
      </div>
      <div className="mascot-shadow" />
    </div>
  );
}
