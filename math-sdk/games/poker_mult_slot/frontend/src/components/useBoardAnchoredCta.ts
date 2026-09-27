import { useEffect, useState, type CSSProperties } from "react";

/**
 * Portrait-only placement for "TAP TO CONTINUE" hints (TOTAL WIN screen,
 * bonus trigger card): horizontally centered on the board, vertically in the
 * empty strip between the last card row and the board frame's bottom border.
 * If that strip is too small on a given screen, just below the frame — but
 * never overlapping any HUD control.
 *
 * All measurements are live rects (no hard-coded px). The app stage
 * (.game-stage) carries a transform, which makes it the containing block for
 * fixed-position descendants — so the screen-space target (measured from
 * getBoundingClientRect) is converted into stage-local CSS coordinates via
 * the stage's effective scale. Landscape returns undefined → the existing
 * layout is untouched.
 */
export function useBoardAnchoredCta(): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useEffect(() => {
    const compute = () => {
      if (!window.matchMedia("(orientation: portrait)").matches) {
        setStyle(undefined);
        return;
      }
      const stage = document.querySelector(".game-stage");
      const cta = document.querySelector(".total-win-cta, .cele-hint");
      const board = document.querySelector(".playfield-board")?.getBoundingClientRect();
      const grid = document.querySelector(".godot-board")?.getBoundingClientRect();
      const hudTop =
        document.querySelector(".hud-bar")?.getBoundingClientRect().top ?? window.innerHeight;
      if (!stage || !board || board.width < 40) {
        setStyle(undefined);
        return;
      }
      const stageRect = stage.getBoundingClientRect();
      const scale =
        stage instanceof HTMLElement && stage.offsetWidth > 0
          ? stageRect.width / stage.offsetWidth
          : 1;

      // Strip between the last card row (≈ the Godot canvas box bottom) and
      // the board frame's bottom border — all in SCREEN space.
      const stripTop = grid ? grid.bottom : board.bottom - 24;
      const stripBottom = board.bottom;
      const hintScreenH = ((cta instanceof HTMLElement ? cta.offsetHeight : 24) * scale) || 24 * scale;
      let screenTop: number;
      if (stripBottom - stripTop >= hintScreenH + 6) {
        screenTop = (stripTop + stripBottom - hintScreenH) / 2; // centered in the strip
      } else {
        screenTop = stripBottom + 6; // strip too small: just below the frame
        if (screenTop + hintScreenH > hudTop - 6) screenTop = hudTop - 6 - hintScreenH; // never over the HUD
      }

      // Screen space → stage-local CSS space (the transformed ancestor is the
      // containing block for position: fixed).
      setStyle({
        position: "fixed",
        left: (board.left - stageRect.left) / scale,
        width: board.width / scale,
        top: (screenTop - stageRect.top) / scale,
        bottom: "auto",
        margin: 0,
      });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    // The board rect settles a beat after mount (scale/layout transitions).
    const t = window.setInterval(compute, 500);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
      window.clearInterval(t);
    };
  }, []);

  return style;
}
