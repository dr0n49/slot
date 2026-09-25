import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/** Landscape layout width in design pixels. Height follows the real viewport. */
export const DESIGN_LANDSCAPE = { w: 1200, h: 675 } as const;

/** Portrait layout width in design pixels. Height follows the real viewport. */
export const DESIGN_PORTRAIT = { w: 675, h: 1200 } as const;

export type StageOrient = "landscape" | "portrait";

export type StageFit = {
  orient: StageOrient;
  w: number;
  h: number;
  scale: number;
  /** Landscape, but real vw/vh is much squarer than the 1200×675 design ratio
   *  (e.g. a boxed desktop window) — the stretched canvas gives the right-side
   *  Hand Pays plaque nowhere to sit without clipping. Portrait is unaffected. */
  narrow: boolean;
};

/** Below this real width/height ratio, a landscape stage is "narrow" (see StageFit.narrow). */
const NARROW_LANDSCAPE_ASPECT = 1.35;

/** Landscape never renders below this scale. Scale is normally vw/1200, so a
 *  narrow desktop window shrinks the whole HUD continuously as it's dragged
 *  in — past this floor the HUD reads too thin to use. Below the vw where
 *  vw/1200 would drop under it, the design canvas itself narrows instead
 *  (fewer design px shown, not just a smaller px-for-px render) so scale can
 *  stay pinned at the floor while width×scale still lands exactly on vw —
 *  no overflow, no cropping. The HUD/board CSS (already flex/grid-based, see
 *  the [data-narrow] rules) reflows to the narrower canvas like any other
 *  responsive width change. Portrait is unaffected: its 675 design width is
 *  already sized for phones. */
const MIN_LANDSCAPE_SCALE = 0.62;

/**
 * Uniform scale that fills the viewport on both axes (no letterbox bars).
 * Width stays the design unit (floored in landscape, see MIN_LANDSCAPE_SCALE);
 * height stretches to the real aspect ratio.
 */
export function computeStageFit(vw: number, vh: number): StageFit {
  const portrait = vh > vw;
  const designW = portrait ? DESIGN_PORTRAIT.w : DESIGN_LANDSCAPE.w;
  const w = !portrait && vw > 0 ? Math.min(designW, vw / MIN_LANDSCAPE_SCALE) : designW;
  const scale = vw > 0 && w > 0 ? vw / w : 1;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const h = safeScale > 0 ? vh / safeScale : portrait ? DESIGN_PORTRAIT.h : DESIGN_LANDSCAPE.h;
  const narrow = !portrait && vh > 0 && vw / vh < NARROW_LANDSCAPE_ASPECT;
  return {
    orient: (portrait ? "portrait" : "landscape") as StageOrient,
    w,
    h: Number.isFinite(h) && h > 0 ? h : portrait ? DESIGN_PORTRAIT.h : DESIGN_LANDSCAPE.h,
    scale: safeScale,
    narrow,
  };
}

function readViewport() {
  const vv = typeof window === "undefined" ? undefined : window.visualViewport;
  return {
    vw: vv?.width ?? window.innerWidth,
    vh: vv?.height ?? window.innerHeight,
    ox: vv?.offsetLeft ?? 0,
    oy: vv?.offsetTop ?? 0,
  };
}

/** Full-viewport stage: storm + HUD pin to the real window edges. */
export function GameStage({ children }: { children: ReactNode }) {
  const [fit, setFit] = useState<StageFit>(() =>
    typeof window === "undefined"
      ? { orient: "landscape", w: 1200, h: 675, scale: 1, narrow: false }
      : computeStageFit(window.innerWidth, window.innerHeight),
  );
  const [origin, setOrigin] = useState(() =>
    typeof window === "undefined"
      ? { ox: 0, oy: 0, vw: 0, vh: 0 }
      : readViewport(),
  );

  useEffect(() => {
    const update = () => {
      const { vw, vh, ox, oy } = readViewport();
      setFit(computeStageFit(vw, vh));
      setOrigin({ ox, oy, vw, vh });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div
      className="game-stage-host"
      style={{
        left: origin.ox,
        top: origin.oy,
        width: origin.vw || "100%",
        height: origin.vh || "100%",
      }}
    >
      <div
        className="game-stage"
        data-orient={fit.orient}
        data-narrow={fit.narrow ? "1" : undefined}
        style={{
          width: fit.w,
          height: fit.h,
          transform: `scale(${fit.scale})`,
          transformOrigin: "0 0",
          // HUD constant-height pass: the landscape bar counter-scales by
          // 1/scale so its px render 1:1 real (see vibrant.css section 18).
          "--stage-scale": `${fit.scale}`,
          "--hud-unscale": `${fit.scale > 0 && fit.scale < 1 ? Number((1 / fit.scale).toFixed(4)) : 1}`,
        } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
