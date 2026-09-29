import { useEffect, useState, type CSSProperties } from "react";

/**
 * Portrait-only placement for "TAP TO CONTINUE" hints (TOTAL WIN screen,
 * bonus trigger card): horizontally centered on the board, vertically in the
 * empty strip between the last card row and the board frame's bottom border.
 * If that strip is too small on a given screen, just below the frame — but
 * never overlapping any HUD control.
 *
 * All measurements are live screen-space rects (no hard-coded px) and are
 * re-measured on resize / orientation change / board settle. These helpers
 * assume the consumer is rendered OUTSIDE the scaled .game-stage (e.g. in a
 * body portal) so position: fixed maps 1:1 to viewport coordinates. In
 * landscape they return undefined → the existing layout is untouched.
 *
 * The stage scale (.game-stage fits the viewport via a transform) is returned
 * alongside so portaled panels can match the in-stage visual size.
 */

function stageScale(): number {
  const stage = document.querySelector(".game-stage");
  if (stage instanceof HTMLElement && stage.offsetWidth > 0) {
    const r = stage.getBoundingClientRect();
    if (r.width > 0) return r.width / stage.offsetWidth;
  }
  return 1;
}

export function useBoardAnchoredCta(): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useEffect(() => {
    const compute = () => {
      if (!window.matchMedia("(orientation: portrait)").matches) {
        setStyle(undefined);
        return;
      }
      const board = document.querySelector(".playfield-board")?.getBoundingClientRect();
      const grid = document.querySelector(".godot-board")?.getBoundingClientRect();
      const hudTop =
        document.querySelector(".hud-bar")?.getBoundingClientRect().top ?? window.innerHeight;
      if (!board || board.width < 40) {
        setStyle(undefined);
        return;
      }
      // Strip between the last card row (≈ the Godot canvas box bottom) and
      // the board frame's bottom border — all in SCREEN space.
      // B5 gaps: 12 px below the frame, never closer than 8 px to the HUD.
      const stripTop = grid ? grid.bottom : board.bottom - 24;
      const stripBottom = board.bottom;
      const hintScreenH = 20 * stageScale(); // .cele-hint/.total-win-cta line height
      let top: number;
      if (stripBottom - stripTop >= hintScreenH + 6) {
        top = (stripTop + stripBottom - hintScreenH) / 2; // centered in the strip
      } else {
        top = stripBottom + 12; // strip too small: 12 px below the frame
        if (top + hintScreenH > hudTop - 8) top = hudTop - 8 - hintScreenH; // 8 px to the HUD
      }
      setStyle({
        position: "fixed",
        left: board.left,
        width: board.width,
        top,
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

/**
 * Portrait-only centering for modal panels (error states): the panel is
 * centered on the BOARD rect instead of the viewport, so it never sits under
 * the HUD buttons. Landscape returns undefined → the existing viewport
 * centering stays. Pair with transform: translate(-50%, -50%) — the returned
 * transform also applies the stage scale so portaled panels match the
 * in-stage visual size.
 */
export function useBoardCenteredPanel(): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useEffect(() => {
    const compute = () => {
      if (!window.matchMedia("(orientation: portrait)").matches) {
        setStyle(undefined);
        return;
      }
      const board = document.querySelector(".playfield-board")?.getBoundingClientRect();
      const hudTop =
        document.querySelector(".hud-bar")?.getBoundingClientRect().top ?? window.innerHeight;
      if (!board || board.width < 40) {
        setStyle(undefined);
        return;
      }
      // Centering via explicit left/top on the panel's MEASURED size — the
      // panel's slam-in animation owns the transform property, so a
      // translate(-50%,-50%) would be overridden by it.
      const panel = document.querySelector(".confirm-panel");
      const MARGIN = 8;
      // Once this panel is `position: fixed` (set below), its `w-full`
      // Tailwind class resolves against the viewport, not the old flex
      // container's padded box — so the RAW measured offsetWidth is often
      // exactly window.innerWidth, with no room left for MARGIN on either
      // side. Clamping here and re-asserting `width` in the style below
      // keeps the two consistent, so the panel can never render wider than
      // the box the left/top clamp below assumes.
      const rawW = panel instanceof HTMLElement ? panel.offsetWidth : 340;
      const w = Math.min(rawW, window.innerWidth - MARGIN * 2);
      const h = panel instanceof HTMLElement ? panel.offsetHeight : 210;
      // Center on the board, clamped so the panel never covers the HUD and
      // never leaves the viewport.
      const screenX = board.left + board.width / 2;
      const screenY = Math.min(
        board.top + board.height / 2,
        Math.max(board.top + 140, (hudTop + board.top) / 2),
      );
      const left = Math.max(MARGIN, Math.min(screenX - w / 2, window.innerWidth - w - MARGIN));
      const top = Math.max(MARGIN, Math.min(screenY - h / 2, hudTop - h - MARGIN));
      setStyle({ position: "fixed", left, top, width: w, margin: 0 });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    const t = window.setInterval(compute, 500);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
      window.clearInterval(t);
    };
  }, []);

  return style;
}
