import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";

const LOGO = "./art/provider/ruby_gaming.png";

/** True when the logo is already decoded: index.html preloads it and its static loader shows it from the first paint. */
const logoCached = () => {
  const img = new Image();
  img.src = LOGO;
  return img.complete && img.naturalWidth > 0;
};

/**
 * A brief provider ident; it never starts a round or skips unfinished artwork preparation. It takes over from the
 * static loader in index.html: when the logo is already on screen it stays put (no second fade-in from black) and
 * only the shine plays; the text fallback shows only if the image fails.
 */
export function ProviderIntro({ ready, error, onComplete }: { ready: boolean; error: string | null; onComplete: () => void }) {
  const [carried] = useState(logoCached);
  const [logoReady, setLogoReady] = useState(carried);
  const [failed, setFailed] = useState(false);
  const [seen, setSeen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!logoReady) return;
    const timer = setTimeout(() => setSeen(true), reduced ? 180 : 1800);
    return () => clearTimeout(timer);
  }, [logoReady, reduced]);

  useEffect(() => {
    if (!ready || !seen || error) { setExiting(false); return; }
    setExiting(true);
    const timer = setTimeout(() => complete.current(), reduced ? 120 : 280);
    return () => clearTimeout(timer);
  }, [ready, seen, error, reduced]);

  return (
    <div className={`provider-intro ${exiting ? "exiting" : ""}`}>
      <div className="provider-content">
        <div className={`provider-mark ${logoReady ? "revealed" : ""} ${carried ? "carried" : ""}`} role="img" aria-label="Ruby Gaming">
          {failed && <span className="provider-fallback" aria-hidden>RUBY<small>GAMING</small></span>}
          <img
            src={LOGO}
            alt=""
            onLoad={(e) => { if (!carried) void e.currentTarget.decode().then(() => setLogoReady(true)).catch(() => setLogoReady(true)); }}
            onError={() => { setFailed(true); setLogoReady(true); }}
          />
          <span className="provider-shine" aria-hidden style={{ maskImage: `url("${LOGO}")`, WebkitMaskImage: `url("${LOGO}")` }}><i /></span>
        </div>
        {error && <div className="provider-error" role="alert"><p>{error}</p><button onClick={() => location.reload()}>{t.recovery.reload}</button></div>}
      </div>
    </div>
  );
}
