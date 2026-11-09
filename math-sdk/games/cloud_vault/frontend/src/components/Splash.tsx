import { useEffect, useRef, type ReactNode } from "react";
import { t } from "../i18n";
import { MAX_WIN } from "../game/modes";
import { GlyphNumber, Logo } from "./Overlays";
import { SpineCharacter } from "../spine/SpineCharacter";

const WAVE = { name: "intro_wave", noBird: true };

/** Multipliers the lotuses really reveal; the numbers are only an example of the mechanic. */
const LOTUS_X = [2, 5, 3, 10, 25, 100];

/** Six game lotuses (up to the top ×100) open one after another and show what they multiply by; then the maximum win lights up. */
function LotusRow() {
  return (
    <div className="pb-row" aria-hidden>
      {LOTUS_X.map((x, i) => (
        <span className="pb-lotus" key={i} style={{ ["--i" as string]: i }}>
          <img className="shut" src="./art/bloom/lotus_closed.webp" alt="" draggable={false} />
          <img className="open" src="./art/bloom/lotus_open.webp" alt="" draggable={false} />
          <b>×{x}</b>
        </span>
      ))}
    </div>
  );
}

/**
 * Start screen: a poster with the heroine, the logo and the lotus mechanic at work; press to continue (also unlocks audio).
 * It is mounted under the provider intro while that is still playing (`held`: entrance animations wait), decodes
 * its own images and reports `onPainted`, so the intro lifts off a start screen that is already fully drawn.
 */
export function Splash({ ready, error, onStart, replay = false, replayCard, held = false, onPainted }: {
  ready: boolean; error: string | null; onStart: () => void; replay?: boolean;
  /** Replays open on the replay card (ReplayCard.tsx); its Start button starts the game and the round. */
  replayCard?: ReactNode; held?: boolean; onPainted?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const painted = useRef(onPainted);
  painted.current = onPainted;
  useEffect(() => {
    let done = false;
    // Two frames after the decode the images are on screen; the cap keeps a broken image from holding the intro.
    const finish = () => {
      if (done) return;
      done = true;
      requestAnimationFrame(() => requestAnimationFrame(() => painted.current?.()));
    };
    const imgs = [...(host.current?.querySelectorAll("img") ?? [])];
    void Promise.all([...imgs.map((img) => img.decode().catch(() => undefined)), document.fonts.ready]).then(finish);
    const cap = setTimeout(finish, 3000);
    return () => {
      done = true;
      clearTimeout(cap);
    };
  }, []);
  if (replay) {
    return (
      <div ref={host} className={`splash replay-splash ${held ? "held" : ""}`}>
        <picture>
          <source media="(max-aspect-ratio: 3/4)" srcSet="./art/bg_portrait.jpg" />
          <img className="sky" src="./art/bg.jpg" alt="" aria-hidden draggable={false} />
        </picture>
        <div className="replay-welcome">
          <Logo />
          {error ? <p className="replay-status" role="alert">{error}</p> : ready && replayCard ? replayCard
            : <p className="replay-status" role="status">{t.loading}</p>}
        </div>
      </div>
    );
  }
  return (
    <div ref={host} className={`splash ${ready ? "ready" : ""} ${held ? "held" : ""}`} onClick={() => ready && !held && onStart()}>
      <picture>
        <source media="(max-aspect-ratio: 3/4)" srcSet="./art/bg_portrait.jpg" />
        <img className="sky" src="./art/bg.jpg" alt="" aria-hidden draggable={false} />
      </picture>
      <div className="pb-dim" />
      <SpineCharacter className="pb-heroine" loop={WAVE} qa={false} />
      <div className="pb-copy">
        <Logo className="pb-logo" />
        <LotusRow />
        <div className="pb-max">
          <small>{t.maxWin}</small>
          <GlyphNumber text={`${MAX_WIN.toLocaleString("en-US")}×`} />
        </div>
        <p className="pb-line">{t.clusterRule}<br />{t.intro.chest[1]}</p>
      </div>
      {error ? (
        <p className="splash-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="press">{ready ? t.tapToContinue : t.loading}</p>
      )}
    </div>
  );
}
