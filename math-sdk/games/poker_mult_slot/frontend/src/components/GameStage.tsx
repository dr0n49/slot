import { useEffect, useState, type ReactNode } from "react";

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
};

/**
 * Uniform scale that fills the viewport on both axes (no letterbox bars).
 * Width stays the design unit; height stretches to the real aspect ratio.
 */
export function computeStageFit(vw: number, vh: number): StageFit {
  const portrait = vh > vw;
  const w = portrait ? DESIGN_PORTRAIT.w : DESIGN_LANDSCAPE.w;
  const scale = vw > 0 ? vw / w : 1;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const h = safeScale > 0 ? vh / safeScale : portrait ? DESIGN_PORTRAIT.h : DESIGN_LANDSCAPE.h;
  return {
    orient: (portrait ? "portrait" : "landscape") as StageOrient,
    w,
    h: Number.isFinite(h) && h > 0 ? h : portrait ? DESIGN_PORTRAIT.h : DESIGN_LANDSCAPE.h,
    scale: safeScale,
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
      ? { orient: "landscape", w: 1200, h: 675, scale: 1 }
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
        style={{
          width: fit.w,
          height: fit.h,
          transform: `scale(${fit.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
    </div>
  );
}
