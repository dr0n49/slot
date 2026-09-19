import type { CSSProperties } from "react";
import type { Card } from "../game/engine";
import { assetUrl } from "../game/assets";

type SuitPipProps = {
  suit: Card["suit"];
  className?: string;
  style?: CSSProperties;
};

/** Classic French pips: two-lobe heart/spade, three-lobe club, faceted diamond. */
function SuitGlyph({ suit }: { suit: Card["suit"] }) {
  if (suit === "H") {
    return (
      <>
        <path
          fill="currentColor"
          d="M12 21.55C5.15 16.05 2.35 12.2 2.35 8.2 2.35 5.05 4.7 2.7 7.7 2.7c1.75 0 3.28.92 4.3 2.42C13.02 3.62 14.55 2.7 16.3 2.7c3 0 5.35 2.35 5.35 5.5 0 4-2.8 7.85-9.65 13.35Z"
        />
        <path
          fill="#fff"
          opacity="0.34"
          d="M8.05 4.55c-1.55 0-2.85 1.2-2.85 2.85 0 .55.45.7.7.28.55-.95 1.55-1.7 2.95-1.7.4 0 .72-.18.72-.55 0-.5-.62-.88-1.52-.88Z"
        />
      </>
    );
  }
  if (suit === "D") {
    return (
      <>
        <path fill="currentColor" d="M12 1.55 22.45 12 12 22.45 1.55 12Z" />
        <path fill="#fff" opacity="0.28" d="M12 4.2 18.6 12 12 10.2 5.4 12Z" />
      </>
    );
  }
  if (suit === "S") {
    return (
      <>
        <path
          fill="currentColor"
          d="M12 1.7C18.7 7.85 21.45 11.4 21.45 14.85c0 2.7-2.05 4.65-4.75 4.65-1.2 0-2.28-.48-3.05-1.28v1.55c0 1.12 1.28 2.12 3.15 2.48H7.2c1.87-.36 3.15-1.36 3.15-2.48v-1.55c-.77.8-1.85 1.28-3.05 1.28-2.7 0-4.75-1.95-4.75-4.65C2.55 11.4 5.3 7.85 12 1.7Z"
        />
        <path
          fill="#fff"
          opacity="0.3"
          d="M12 3.85c-2.6 2.45-4.55 4.7-5.55 6.55 1.15-1.7 3.05-2.55 5.55-2.55Z"
        />
      </>
    );
  }
  return (
    <>
      <g fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4.55" />
        <circle cx="8.15" cy="12.15" r="4.55" />
        <circle cx="15.85" cy="12.15" r="4.55" />
        <circle cx="12" cy="10.35" r="2.6" />
        <rect x="9.55" y="13.35" width="4.9" height="4.4" rx="1.4" />
        <path d="M10.75 16.2c-.18 2.55-1.85 4.35-4.05 5.55h10.6c-2.2-1.2-3.87-3-4.05-5.55z" />
      </g>
      <path
        fill="#fff"
        opacity="0.34"
        d="M9.4 4.2c-1.5 0-2.7 1.15-2.7 2.6 0 .5.42.64.66.26.52-.9 1.45-1.55 2.78-1.55.38 0 .7-.16.7-.5 0-.46-.6-.81-1.44-.81Z"
      />
    </>
  );
}

export function SuitPip({ suit, className, style }: SuitPipProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden overflow="visible">
      <SuitGlyph suit={suit} />
    </svg>
  );
}

/** Jagged storm bolt — used on the intro CTA and card backs. */
export function BoltMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden={!title} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M18.4 1.2 7.2 16.6h6.4L11.6 30.8 24.8 14.2h-6.6L18.4 1.2Zm-1.6 6.6-1.1 6.4h4.9L13.8 24.2l1.6-7.2H10.8l5.9-9.2Z"
        opacity="0.35"
      />
      <path fill="currentColor" d="M18.4 1.2 7.2 16.6h6.4L11.6 30.8 24.8 14.2h-6.6L18.4 1.2Z" />
    </svg>
  );
}

/** Simple filled bolt — turbo HUD icon from the reference shot. */
export function HudBoltMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="currentColor" d="M13.4 1.6 5.2 13.4h5.4L8.3 22.4 19.1 9.5h-5.6L13.4 1.6z" />
    </svg>
  );
}

/**
 * Two chasing circular arrows — same glyph as before, sitting near the ring
 * with a larger inner hole.
 */
/** Spin icon of the reference HUD: two ~130° clockwise arcs at 0.69 of the black
   core radius (width ~0.19R, gaps before each tail) with solid heads at the sweep
   end. Traced from the mock; viewBox maps to the disc area inside the white ring. */
export function SpinArrowMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden={!title} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        d="M20.29 12.29A8.3 8.3 0 0 1 6.55 18.26"
      />
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeLinejoin="round"
        d="M2.53 14.57 7.94 15.62 3.84 19.65z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        d="M3.71 11.71A8.3 8.3 0 0 1 17.45 5.74"
      />
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeLinejoin="round"
        d="M21.47 9.43 16.06 8.38 20.16 4.35z"
      />
    </svg>
  );
}

export function StopMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden={!title} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="1.6" fill="currentColor" />
    </svg>
  );
}

export function MenuMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="currentColor" d="M4 5.4h16v2.1H4zm0 5.55h12.2v2.1H4zM4 16.5h16v2.1H4z" />
    </svg>
  );
}

/** Speaker — HUD master mute. */
export function SpeakerMark({ className, muted }: { className?: string; muted?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M3.4 8.6h3.15L10.9 4.8v14.4L6.55 15.4H3.4c-.7 0-1.15-.48-1.15-1.18V9.78c0-.7.45-1.18 1.15-1.18Z"
      />
      {muted ? (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          d="M13.6 8.4 20.4 16.4M20.4 8.4 13.6 16.4"
        />
      ) : (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            d="M14.15 9.2a3.15 3.15 0 0 1 0 5.6"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            d="M16.85 6.85a6.05 6.05 0 0 1 0 10.3"
          />
        </>
      )}
    </svg>
  );
}

/** Info “i” — Cook Out-style left HUD control. */
export function InfoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path fill="currentColor" d="M11.05 10.2h1.9V17.4h-1.9z" />
      <circle cx="12" cy="7.35" r="1.15" fill="currentColor" />
    </svg>
  );
}

/** Same dual circular arrows as spin, for the auto HUD square. */
export function AutoMark({ className }: { className?: string }) {
  return <SpinArrowMark className={className} />;
}

export function MinusMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="4.5" y="10.4" width="15" height="3.2" rx="0.6" fill="currentColor" />
    </svg>
  );
}

export function PlusMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="currentColor" d="M10.4 4.5h3.2v15h-3.2zM4.5 10.4h15v3.2h-15z" />
    </svg>
  );
}

export function CloseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M6.2 5.1 12 10.9l5.8-5.8 1.9 1.9L13.9 12l5.8 5.8-1.9 1.9L12 13.9l-5.8 5.8-1.9-1.9 5.8-5.8-5.8-5.8z"
      />
    </svg>
  );
}

/** Hand-drawn card back (see ASSETS_LICENSE.md). Stretched to the tile. */
export function CardBackArt() {
  return (
    <img
      src={assetUrl("assets/cards/card_back.png")}
      alt=""
      className="card-back-img"
      draggable={false}
      aria-hidden
    />
  );
}

type Glyph = { w: number; d: string; evenodd?: boolean };

/** Angular stencil glyphs for the lockup — not a licensed/display webfont. */
const GLYPH: Record<string, Glyph> = {
  L: { w: 16, d: "M0 0h6.6v17.2H16v6.8H0z" },
  I: { w: 8, d: "M0 0h8v24H0z" },
  G: { w: 18, d: "M16.2 2.2H7.4L2 8.2v7.6l5.4 6H16.2v-5.4h-6.2v2.2H8.6l-3.2-3.4V10l3.2-3.4h7.6V2.2z" },
  H: { w: 20, d: "M0 0h6.6v8.8h6.8V0H20v24h-6.6v-8.8H6.6V24H0z" },
  T: { w: 18, d: "M0 0h18v5.4h-5.7V24H5.7V5.4H0z" },
  N: { w: 20, d: "M0 0h6.6v24H0zm13.4 0H20v24h-6.6zM5.4 0h6.6L14.6 24H8z" },
  P: {
    w: 18,
    evenodd: true,
    d: "M0 0h12.2C15.8 0 18 2.6 18 6.6s-2.2 6.6-5.8 6.6H6.6V24H0zm6.6 4.4h5.2c1.7 0 2.8 1.2 2.8 2.4S13.5 9.2 11.8 9.2H6.6z",
  },
  O: {
    w: 20,
    evenodd: true,
    d: "M10 0c5.7 0 10 4.6 10 12S15.7 24 10 24 0 19.4 0 12 4.3 0 10 0zm0 5.2c-3.2 0-5.2 2.8-5.2 6.8s2 6.8 5.2 6.8 5.2-2.8 5.2-6.8-2-6.8-5.2-6.8z",
  },
  K: { w: 20, d: "M0 0h6.6v8.6L14.8 0H20L11.2 10.6 20 24h-5.4l-8-10.6V24H0z" },
  E: { w: 16, d: "M0 0h16v5.2H6.6v4.2h7.6v4.8H6.6v4.4H16V24H0z" },
  R: {
    w: 18,
    evenodd: true,
    d: "M0 0h12C15.6 0 18 2.4 18 6.2c0 2.8-1.6 5.2-4.4 6.1L18 24h-7.2l-4.2-8.4H6.6V24H0zm6.6 4.2h5c1.6 0 2.6 1.1 2.6 2.2S13.2 8.6 11.6 8.6h-5z",
  },
};

function StencilWord({
  text,
  fill,
  gap = 2.4,
}: {
  text: string;
  fill: string;
  gap?: number;
}) {
  let x = 0;
  const nodes = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " ") {
      x += 7;
      continue;
    }
    const g = GLYPH[ch];
    if (!g) continue;
    nodes.push(
      <path
        key={`${ch}-${i}`}
        transform={`translate(${x} 0)`}
        d={g.d}
        fill={fill}
        fillRule={g.evenodd ? "evenodd" : "nonzero"}
      />,
    );
    x += g.w + gap;
  }
  return <g>{nodes}</g>;
}

function wordWidth(text: string, gap = 2.4): number {
  let x = 0;
  for (const ch of text) {
    if (ch === " ") {
      x += 7;
      continue;
    }
    const g = GLYPH[ch];
    if (!g) continue;
    x += g.w + gap;
  }
  return Math.max(0, x - gap);
}

type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

/** Stencil wordmark LIGHTNING (white) over POKER (gold) — intro / loading. */
export function BrandMark({ size = "lg", className }: BrandMarkProps) {
  const lightningW = wordWidth("LIGHTNING");
  const pokerW = wordWidth("POKER", 3);
  const vbW = 248;
  const scaleL = vbW / lightningW;
  const pokerScaled = 132;
  const scaleP = pokerScaled / pokerW;
  const vbH = 73;
  // Aspect 248:73 — heights follow width so the wordmark never letterboxes.
  const dim =
    size === "lg"
      ? "h-[5.2rem] w-[17.5rem] sm:h-[6.6rem] sm:w-[22.5rem]"
      : size === "md"
        ? "h-[4.4rem] w-[15rem]"
        : "h-[2.9rem] w-40";

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className={`${dim} ${className ?? ""}`} role="img" aria-label="Lightning Poker">
      <title>Lightning Poker</title>
      <g transform={`scale(${scaleL})`}>
        <StencilWord text="LIGHTNING" fill="#f4fbff" />
      </g>
      <g transform={`translate(${(vbW - pokerScaled) / 2} 42) scale(${scaleP})`}>
        <StencilWord text="POKER" fill="#f0c14b" gap={3} />
      </g>
    </svg>
  );
}
