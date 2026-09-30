import { useEffect, useMemo, useRef, useState } from "react";
import { audio } from "../game/audio";
import {
  BIG_WIN_ANTICIPATION_MS,
  BIG_WIN_COUNT_MS,
  BIG_WIN_HOLD_MS,
  bigWinLadder,
  bigWinStepCash,
  type BigWinTier,
} from "../game/bigWin";
import type { Copy } from "../game/social";
import { isLiteFx } from "../game/fxMode";
import { CeleConfetti, CeleSparkField, CeleSplat, CeleWord } from "./Celebration";

/** B4: lite-fx keeps a cheap reward beat — this many simple sparks per tier. */
const LITE_SPARKS: Record<BigWinTier, number> = { nice: 6, super: 8, sensational: 8, max: 12 };

type Props = {
  tier: BigWinTier;
  /** Cash amount for THIS spin (already in wallet units) */
  amount: number;
  /** Stake × for this spin — drives per-step cash caps */
  spinWinX: number;
  copy: Copy;
  turbo?: boolean;
  /** Tap-to-skip and end-of-ladder both land here */
  onDone: () => void;
};

const WORD_OF: Record<BigWinTier, (copy: Copy) => string> = {
  nice: (c) => c.bigWinNice,
  super: (c) => c.bigWinSuper,
  sensational: (c) => c.bigWinSensational,
  max: (c) => c.bigWinMax,
};

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const t = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** Heavier ease for the final rung — slows hard into the last digits. */
function easeOutQuint(t: number) {
  return 1 - Math.pow(1 - t, 5);
}

/**
 * Stepped Big Win ladder (one overlay, no return to the board):
 * NICE → SUPER → SENSATIONAL → MAX. Each step: optional anticipation,
 * word punch + SFX, count-up, hold (grows with tier). Tap skips to end.
 */
export function BigWinOverlay({ tier, amount, spinWinX, copy, turbo, onDone }: Props) {
  const ladder = bigWinLadder(tier);
  const [shown, setShown] = useState(0);
  const [displayTier, setDisplayTier] = useState<BigWinTier>(ladder[0] ?? tier);
  const [stepKey, setStepKey] = useState(0);
  const [anticipate, setAnticipate] = useState(false);
  const [finished, setFinished] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** Read once: lite-fx swaps the celebration for a cheap transform/opacity beat. */
  const lite = useMemo(() => isLiteFx(), []);
  const reduced = useMemo(() => matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const doneRef = useRef(false);
  const skipRef = useRef(false);
  const resolvedAtRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  // Tracks the last tier the ladder loop has already played a sting for, so a
  // tap-to-skip that lands mid-step doesn't layer a second playBigWin(tier)
  // on top of the one the loop just fired for that same step.
  const lastStingTierRef = useRef<BigWinTier | null>(null);

  const dismiss = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    abortRef.current?.abort();
    if (lite) {
      // B4: soft 140 ms fade-out instead of a hard unmount (120–160 ms window).
      setLeaving(true);
      window.setTimeout(onDone, reduced ? 80 : 140);
      return;
    }
    onDone();
  };

  const jumpToEnd = () => {
    skipRef.current = true;
    resolvedAtRef.current=performance.now();
    abortRef.current?.abort();
    setAnticipate(false);
    setShown(amount);
    setDisplayTier(tier);
    setStepKey((n) => n + 1);
    setFinished(true);
    if (lastStingTierRef.current !== tier) {
      lastStingTierRef.current = tier;
      audio.playBigWin(tier);
    }
  };

  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("cele")) {
      setShown(amount);
      setDisplayTier(tier);
      setFinished(true);
      return;
    }
    if(reduced){jumpToEnd();return}

    const ac = new AbortController();
    abortRef.current = ac;
    skipRef.current = false;

    const countTo = (from: number, to: number, durMs: number, heavy: boolean) =>
      new Promise<void>((resolve, reject) => {
        if (ac.signal.aborted) {
          reject(new DOMException("aborted", "AbortError"));
          return;
        }
        const t0 = performance.now();
        let raf = 0;
        const ease = heavy ? easeOutQuint : easeOutCubic;
        const tick = (now: number) => {
          if (ac.signal.aborted) {
            cancelAnimationFrame(raf);
            reject(new DOMException("aborted", "AbortError"));
            return;
          }
          const k = Math.min(1, (now - t0) / durMs);
          const v = from + (to - from) * ease(k);
          setShown(Math.round(v * 100) / 100);
          if (k < 1) raf = requestAnimationFrame(tick);
          else {
            setShown(to);
            resolve();
          }
        };
        raf = requestAnimationFrame(tick);
        ac.signal.addEventListener(
          "abort",
          () => {
            cancelAnimationFrame(raf);
            reject(new DOMException("aborted", "AbortError"));
          },
          { once: true },
        );
      });

    const run = async () => {
      let fromCash = 0;
      try {
        for (let i = 0; i < ladder.length; i++) {
          if (skipRef.current) return;
          const step = ladder[i];
          const isFirst = i === 0;
          const isLast = i === ladder.length - 1;
          const toCash = bigWinStepCash(step, tier, spinWinX, amount);

          // Anticipation beat before every upgrade after NICE
          if (!isFirst) {
            setAnticipate(true);
            await sleep(BIG_WIN_ANTICIPATION_MS, ac.signal);
            setAnticipate(false);
          }

          setDisplayTier(step);
          setStepKey((n) => n + 1);
          lastStingTierRef.current = step;
          audio.playBigWin(step);

          const countMs = turbo ? (isLast ? 800 : 150) : BIG_WIN_COUNT_MS[step];
          await countTo(fromCash, toCash, countMs, isLast);
          fromCash = toCash;

          const holdMs = turbo ? (isLast ? 350 : 0) : BIG_WIN_HOLD_MS[step];
          if(holdMs>0)await sleep(holdMs, ac.signal);
        }
        setFinished(true);
      } catch {
        if (!skipRef.current && !doneRef.current) {
          /* aborted by unmount */
        }
      }
    };

    void run();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!finished) return;
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("cele")) return;
    // Short settle after skip / natural end, then close — overlay stays up
    // through the whole ladder so the board never flashes through.
    const t = window.setTimeout(dismiss, skipRef.current ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const onClick = () => {
    if (doneRef.current) return;
    if (!finished&&!skipRef.current) {
      jumpToEnd();
      return;
    }
    if(skipRef.current&&performance.now()-resolvedAtRef.current<350)return;
    dismiss();
  };

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.code!=="Space"&&event.key!==" ")return;
      const tag=(event.target as HTMLElement|null)?.tagName;
      if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT")return;
      event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)onClick();
    };
    const onResize=()=>{if(!doneRef.current&&!skipRef.current)jumpToEnd()};
    const onVisibility=()=>{if(document.hidden)onResize()};
    window.addEventListener("keydown",onKey,true);window.addEventListener("resize",onResize);
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{window.removeEventListener("keydown",onKey,true);window.removeEventListener("resize",onResize);document.removeEventListener("visibilitychange",onVisibility)};
  },[finished]);

  return (
    <button
      type="button"
      data-tier={displayTier}
      data-anticipate={anticipate ? "1" : "0"}
      className={`cele-overlay bigwin-overlay fixed inset-0 z-[65] flex flex-col items-center justify-center gap-3 p-4 text-center${anticipate ? " is-anticipate" : ""}${leaving ? " is-leaving" : ""}${finished&&skipRef.current ? " is-resolved" : ""}`}
      onClick={onClick}
      aria-label={WORD_OF[displayTier](copy)}
    >
      <div className="bigwin-scrim pointer-events-none absolute inset-0" />
      {/* One particle pool per rung, within the approved desktop/lite caps. */}
      {!reduced&&!skipRef.current&&!lite&&<CeleConfetti key={`confetti-${stepKey}`} tier={displayTier} />}
      <div
        className={`cele-float relative z-10 flex flex-col items-center${anticipate ? " is-anticipate" : ""}`}
      >
        {!reduced&&!skipRef.current&&lite&&<CeleSparkField count={LITE_SPARKS[displayTier]} />}
        <div key={stepKey} className="bigwin-tier-step cele-word-row">
          <CeleWord variant={displayTier}>{WORD_OF[displayTier](copy)}</CeleWord>
        </div>
        <CeleSplat>
          <span className="tabular-nums">{copy.money(shown)}</span>
        </CeleSplat>
      </div>
    </button>
  );
}
