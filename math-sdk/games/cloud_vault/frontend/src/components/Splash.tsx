import { t } from "../i18n";
import { Logo } from "./Overlays";

/** Start screen: logo and three framed feature cards; press to continue (also unlocks audio). */
export function Splash({ ready, error, onStart }: { ready: boolean; error: string | null; onStart: () => void }) {
  return (
    <div className={`splash ${ready ? "ready" : ""}`} onClick={() => ready && onStart()}>
      <img className="sky" src="./art/bg.jpg" alt="" aria-hidden draggable={false} />
      <div className="splash-cards">
        <div className="s-card side" style={{ ["--i" as string]: 0 }}>
          <div className="s-art portraits">
            {[0, 1, 2].map((i) => (
              <img key={i} src="./art/portrait.png" alt="" />
            ))}
          </div>
          <h3>{t.intro.epic[0]}</h3>
          <p>{t.intro.epic[1]}</p>
          <img className="s-frame" src="./art/frame.png" alt="" />
        </div>
        <div className="s-card mid" style={{ ["--i" as string]: 1 }}>
          <div className="s-art s-chests">
            {[0, 1, 2].map((i) => (
              <img key={i} src="./art/chest_open.png" alt="" />
            ))}
          </div>
          <h3>{t.intro.chest[0]}</h3>
          <p>{t.intro.chest[1]}</p>
          <img className="s-frame" src="./art/frame.png" alt="" />
        </div>
        <div className="s-card side" style={{ ["--i" as string]: 2 }}>
          <div className="s-art max">
            <b>MAX WIN</b>
            <img src="./art/chest_open.png" alt="" />
          </div>
          <h3>{t.intro.max[0]}</h3>
          <p>{t.intro.max[1]}</p>
          <img className="s-frame" src="./art/frame.png" alt="" />
        </div>
        <Logo className="splash-logo" />
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
