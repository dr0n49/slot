import { memo, type CSSProperties } from "react";

/**
 * Día de Muertos candle shrine — left flank, bases sitting right on the HUD.
 * Flat-cartoon velas with a melted CRATER top (sunken wax pool inside a white
 * rim) and stylised teardrop flames. Candles themselves are static (no sway);
 * only the fire dances. No smoke, no tip curl. Compositor-only motion
 * (vibrant.css section 19). Hidden in portrait; frozen under lite-fx /
 * reduced-motion.
 */
export const CandleShrine = memo(function CandleShrine() {
  return (
    <div className="candle-shrine" aria-hidden>
      <i className="shrine-halo" />
      <i className="shrine-floor-light" />

      <div
        className="shrine-candle c1"
        style={
          {
            "--sway-d": "1.35s",
            "--sway-t": "-0.2s",
            "--glow-d": "2.9s",
            "--glow-t": "0s",
          } as CSSProperties
        }
      >
        <i className="cshadow" />
        <span className="wick" />
        <svg className="flame" viewBox="0 0 48 68">
          <path
            className="flame-outer"
            d="M22 3 C17 13 9 23 9 38 a13 14.5 0 0 0 26 0 C35 23 27 13 22 3 Z"
          />
          <g className="flame-inner">
            <path
              className="flame-core"
              d="M22 23 C19 29 15 34 15 41 a7 8 0 0 0 14 0 C29 34 25 29 22 23 Z"
            />
            <ellipse className="flame-base" cx="22" cy="48" rx="5" ry="3.4" />
          </g>
        </svg>
        <i className="flame-halo" />
      </div>

      <div
        className="shrine-candle c2"
        style={
          {
            "--sway-d": "1.62s",
            "--sway-t": "-0.75s",
            "--glow-d": "3.6s",
            "--glow-t": "-1.2s",
          } as CSSProperties
        }
      >
        <i className="cshadow" />
        <span className="wick" />
        <svg className="flame" viewBox="0 0 48 68">
          <path
            className="flame-outer"
            d="M22 3 C17 13 9 23 9 38 a13 14.5 0 0 0 26 0 C35 23 27 13 22 3 Z"
          />
          <g className="flame-inner">
            <path
              className="flame-core"
              d="M22 23 C19 29 15 34 15 41 a7 8 0 0 0 14 0 C29 34 25 29 22 23 Z"
            />
            <ellipse className="flame-base" cx="22" cy="48" rx="5" ry="3.4" />
          </g>
        </svg>
        <i className="flame-halo" />
      </div>

      <div
        className="shrine-candle c3"
        style={
          {
            "--sway-d": "1.18s",
            "--sway-t": "-0.5s",
            "--glow-d": "2.4s",
            "--glow-t": "-0.7s",
          } as CSSProperties
        }
      >
        <i className="cshadow" />
        <span className="wick" />
        <svg className="flame" viewBox="0 0 48 68">
          <path
            className="flame-outer"
            d="M22 3 C17 13 9 23 9 38 a13 14.5 0 0 0 26 0 C35 23 27 13 22 3 Z"
          />
          <g className="flame-inner">
            <path
              className="flame-core"
              d="M22 23 C19 29 15 34 15 41 a7 8 0 0 0 14 0 C29 34 25 29 22 23 Z"
            />
            <ellipse className="flame-base" cx="22" cy="48" rx="5" ry="3.4" />
          </g>
        </svg>
        <i className="flame-halo" />
      </div>
    </div>
  );
});
