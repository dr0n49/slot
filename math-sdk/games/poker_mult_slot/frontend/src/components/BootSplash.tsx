import { useEffect, useRef, useState } from "react";
import { assetUrl, cardImageUrls, jokerFaceUrl } from "../game/assets";
import { BgPicture, SERIES_BG, SERIES_BG_PORTRAIT } from "./CosmicBackground";
import { mathConfig } from "../game/engine";
import type { Copy } from "../game/social";
import { FitText } from "./FitText";

/** Boot lockup. Change here if the game gets a new name. */
const GAME_TITLE = ["MUERTA", "POKER"] as const;

type Props = {
  onContinue: () => void;
  copy: Copy;
};

const SOUND_PRELOAD: string[] = [
  assetUrl("assets/sounds/button_click.wav"),
  assetUrl("assets/sounds/card_deal.wav"),
  assetUrl("assets/sounds/music_muerta.wav"),
];

const IMAGE_PRELOAD: string[] = [assetUrl(SERIES_BG), assetUrl(SERIES_BG_PORTRAIT), ...cardImageUrls()];

const PRELOAD_TIMEOUT_MS = 2500;
/** Boot floor: real preload still gates completion — this only guarantees the
    eased bar has time to fill before the tap-to-continue appears. */
const MIN_SPLASH_MS = 2600;

function withTimeout(p: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = window.setTimeout(resolve, ms);
    p.then(() => {
      window.clearTimeout(t);
      resolve();
    }).catch(() => {
      window.clearTimeout(t);
      resolve();
    });
  });
}

function preloadOne(url: string): Promise<void> {
  const lower = url.toLowerCase();
  if (lower.includes(".webm") || lower.includes(".mp4")) {
    return new Promise((resolve) => {
      const v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;
      const done = () => {
        v.oncanplaythrough = null;
        v.onerror = null;
        v.removeAttribute("src");
        v.load();
        resolve();
      };
      v.oncanplaythrough = done;
      v.onerror = done;
      v.src = url;
      v.load();
    });
  }
  if (lower.includes(".wav") || lower.includes(".mp3") || lower.includes(".ogg")) {
    return new Promise((resolve) => {
      const a = new Audio();
      a.preload = "auto";
      const done = () => resolve();
      a.oncanplaythrough = done;
      a.onerror = done;
      a.src = url;
      a.load();
    });
  }
  if (lower.includes(".jpg") || lower.includes(".jpeg") || lower.includes(".png") || lower.includes(".webp")) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    });
  }
  return Promise.resolve();
}

/**
 * Single boot screen (Cloudy Poker): sky, wordmark, three feature tickets,
 * preload bar that swaps to tap-to-continue at 100%. Tap before 100% is a no-op.
 */
export function BootSplash({ onContinue, copy }: Props) {
  const [progress, setProgress] = useState(0);
  const [shown, setShown] = useState(0);
  const progressRef = useRef(0);
  const onDoneRef = useRef(onContinue);
  onDoneRef.current = onContinue;
  const ready = Math.round(shown) >= 100;

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    const urls = [...SOUND_PRELOAD, ...IMAGE_PRELOAD];

    (async () => {
      const total = Math.max(1, urls.length);
      let done = 0;
      await Promise.all(
        urls.map(async (url) => {
          await withTimeout(preloadOne(url), PRELOAD_TIMEOUT_MS);
          if (cancelled) return;
          done += 1;
          progressRef.current = Math.round((done / total) * 100);
          setProgress(progressRef.current);
        }),
      );
      if (cancelled) return;
      progressRef.current = 100;
      setProgress(100);
      const wait = Math.max(0, MIN_SPLASH_MS - (performance.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      if (!cancelled) progressRef.current = 100;
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Ease the displayed % toward the real preload — the bar fills smoothly over
  // the boot floor instead of jumping 0 → 100 when the (small) preloads finish.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setShown((s) => {
        const target = progressRef.current;
        if (target - s <= 0.4) return target;
        return s + (target - s) * 0.06;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const shownPct = Math.round(shown);

  return (
    <div
      role="button"
      aria-label="Enter game"
      className={`boot-splash fixed inset-0 z-[120] flex flex-col items-center px-4 text-center ${ready ? "is-ready cursor-pointer" : ""}`}
      onClick={() => {
        if (ready) onDoneRef.current();
      }}
    >
      <BgPicture className="boot-sky pointer-events-none absolute inset-0 z-0" />
      <div className="boot-vignette pointer-events-none absolute inset-0 z-[1]" />

      <div className="boot-wordmark relative z-10" aria-label={GAME_TITLE.join(" ")}>
        <span className="boot-wordmark-cloudy">{GAME_TITLE[0]}</span>
        <span className="boot-wordmark-poker">{GAME_TITLE[1]}</span>
      </div>

      <div className="boot-cards relative z-10 my-auto flex items-stretch justify-center">
        <div className="boot-card boot-float-a">
          <div className="boot-card-inner">
            <div className="boot-card-icon">
              <span className="boot-icon-cloud">
                <img
                  src={assetUrl("assets/ui/ink-plate.svg")}
                  alt=""
                  className="boot-icon-cloud-img"
                  draggable={false}
                  aria-hidden
                />
                <span className="boot-icon-cloud-x">×2</span>
              </span>
            </div>
            <FitText className="boot-card-title" maxLines={2} oneLine>{copy.bootMultTitle}</FitText>
            <FitText className="boot-card-caption" maxLines={3} min={0.6}>{copy.bootMultCaption}</FitText>
          </div>
        </div>

        <div className="boot-card boot-float-b">
          <div className="boot-card-inner">
            <div className="boot-card-icon">
              <span className="boot-icon-ace">
                <img
                  src={jokerFaceUrl()}
                  alt=""
                  className="boot-icon-ace-img"
                  draggable={false}
                  aria-hidden
                />
              </span>
            </div>
            <FitText className="boot-card-title" maxLines={2} oneLine>{copy.stormBonus}</FitText>
            <FitText className="boot-card-caption" maxLines={3} min={0.6}>{copy.bootBonusCaption(mathConfig.fsCount)}</FitText>
          </div>
        </div>

        <div className="boot-card boot-float-c">
          <div className="boot-card-inner">
            <div className="boot-card-icon boot-card-icon-max">
              <span className="boot-maxwin" aria-hidden>
                <span className="boot-maxwin-line" data-text="MAX">
                  MAX
                </span>
                <span className="boot-maxwin-line" data-text="WIN">
                  WIN
                </span>
              </span>
            </div>
            <FitText className="boot-card-caption" maxLines={3} min={0.6}>{copy.bootMaxCaption}</FitText>
          </div>
        </div>
      </div>

      <div className="boot-bottom relative z-10 mb-6 flex min-h-[4.6rem] w-80 flex-col items-center justify-end">
        {!ready ? (
          <>
            <div className="loading-bar w-full">
              <div className="loading-bar-fill" style={{ width: `${shown}%` }} />
            </div>
            <div className="loading-pct mt-3 font-display text-[11px] font-bold tracking-[0.3em] tabular-nums">
              {shownPct}%
            </div>
          </>
        ) : (
          <FitText className="cta-hint boot-continue" maxLines={1} min={0.4}>{copy.tapToContinue}</FitText>
        )}
      </div>
    </div>
  );
}
