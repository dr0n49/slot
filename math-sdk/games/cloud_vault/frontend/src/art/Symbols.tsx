import type React from "react";
/**
 * Original placeholder symbol art (vector). Swap for the project's own painted
 * symbols by dropping PNGs into public/symbols/<NAME>.png — those win when present.
 */
import { useState } from "react";

const grad = (id: string, a: string, b: string) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stopColor={a} />
    <stop offset="1" stopColor={b} />
  </linearGradient>
);

function Crystal({ id, a, b, edge, points }: { id: string; a: string; b: string; edge: string; points: string }) {
  return (
    <svg viewBox="0 0 100 100">
      <defs>{grad(id, a, b)}</defs>
      <polygon points={points} fill={`url(#${id})`} stroke={edge} strokeWidth="4" strokeLinejoin="round" />
      <polygon points={points} fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.5" transform="translate(50 50) scale(.72) translate(-50 -50)" />
      <ellipse cx="38" cy="32" rx="9" ry="5" fill="#fff" opacity=".55" transform="rotate(-30 38 32)" />
    </svg>
  );
}

const ART: Record<string, () => React.ReactElement> = {
  L1: () => <Crystal id="gL1" a="#7ff3e6" b="#139a9a" edge="#0b5d63" points="50,10 85,30 85,70 50,90 15,70 15,30" />,
  L2: () => <Crystal id="gL2" a="#ffd88a" b="#e2781c" edge="#8a400c" points="50,8 88,50 50,92 12,50" />,
  L3: () => <Crystal id="gL3" a="#d9b4ff" b="#7a3fd1" edge="#43207a" points="50,10 90,84 10,84" />,
  L4: () => (
    <svg viewBox="0 0 100 100">
      <defs>{grad("gL4", "#b8f59a", "#3f9b2c")}</defs>
      <circle cx="50" cy="52" r="36" fill="url(#gL4)" stroke="#215a17" strokeWidth="4" />
      <circle cx="50" cy="52" r="24" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1.5" />
      <ellipse cx="38" cy="36" rx="10" ry="6" fill="#fff" opacity=".55" transform="rotate(-30 38 36)" />
    </svg>
  ),
  H4: () => (
    <svg viewBox="0 0 100 100">
      <defs>{grad("gH4", "#ffffff", "#8fd6ff")}</defs>
      <path d="M72 10 C40 18 22 46 26 82 L32 88 C40 70 54 52 80 30 C70 30 62 34 56 38 C64 28 70 20 72 10Z" fill="url(#gH4)" stroke="#2c6f9e" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M30 86 L64 34" stroke="#2c6f9e" strokeWidth="2.5" />
    </svg>
  ),
  H3: () => (
    <svg viewBox="0 0 100 100">
      <defs>
        {grad("gH3", "#ffc2e0", "#e0408a")}
        <linearGradient id="tH3" x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff9dce" stopOpacity=".9" />
          <stop offset="1" stopColor="#ff9dce" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M58 66 L8 18 L20 12 Z M66 58 L14 6 L26 4Z" fill="url(#tH3)" />
      <circle cx="64" cy="64" r="24" fill="url(#gH3)" stroke="#8a1d4f" strokeWidth="4" />
      <circle cx="56" cy="56" r="7" fill="#fff" opacity=".6" />
    </svg>
  ),
  H2: () => (
    <svg viewBox="0 0 100 100">
      <defs>{grad("gH2", "#e9f1ff", "#6f8fe6")}</defs>
      <path d="M62 10 A40 40 0 1 0 90 66 A32 32 0 1 1 62 10Z" fill="url(#gH2)" stroke="#2b3f8f" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="78" cy="22" r="4" fill="#fff" />
      <circle cx="88" cy="40" r="2.5" fill="#fff" />
    </svg>
  ),
  H1: () => (
    <svg viewBox="0 0 100 100">
      <defs>{grad("gH1", "#fff3a8", "#f0a400")}</defs>
      {Array.from({ length: 12 }, (_, i) => (
        <polygon key={i} points="50,2 55,22 45,22" fill="#ffd34d" stroke="#a86400" strokeWidth="2" transform={`rotate(${i * 30} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="27" fill="url(#gH1)" stroke="#a86400" strokeWidth="4" />
      <path d="M36 52 L42 40 L50 50 L58 40 L64 52 Z" fill="#fff8d0" stroke="#a86400" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  ),
  S: () => (
    <svg viewBox="0 0 100 100">
      <defs>
        <radialGradient id="gS" cx=".5" cy=".5" r=".5">
          <stop offset=".55" stopColor="#fff6c2" stopOpacity="0" />
          <stop offset=".75" stopColor="#ffe066" stopOpacity=".9" />
          <stop offset="1" stopColor="#ffb400" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#gS)" />
      <ellipse cx="50" cy="50" rx="32" ry="32" fill="none" stroke="#ffd34d" strokeWidth="9" />
      <ellipse cx="50" cy="50" rx="32" ry="32" fill="none" stroke="#fff7cc" strokeWidth="3" />
      <path d="M50 30 L54 46 L70 50 L54 54 L50 70 L46 54 L30 50 L46 46Z" fill="#fff" />
    </svg>
  ),
};

export function SymbolArt({ sym }: { sym: string }) {
  const [png, setPng] = useState(true);
  return png ? (
    <img
      className="sym-img"
      src={`./symbols/${sym}.png`}
      alt=""
      draggable={false}
      onError={() => setPng(false)}
    />
  ) : (
    (ART[sym] ?? ART.L1)()
  );
}

export function VaultArt({ open, unlocked }: { open: boolean; unlocked: boolean }) {
  return (
    <svg viewBox="0 0 100 80" className="vault-art">
      <defs>
        {grad("gV", unlocked ? "#ffe9a3" : "#c9d6ea", unlocked ? "#d48a00" : "#6d7f9e")}
      </defs>
      <rect x="8" y={open ? 30 : 24} width="84" height="48" rx="8" fill="url(#gV)" stroke="#3a2a10" strokeWidth="3" />
      <path
        d={open ? "M8 26 L92 26 L82 6 L18 6Z" : "M8 30 Q50 6 92 30 Z"}
        fill="url(#gV)"
        stroke="#3a2a10"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="50" r="9" fill={unlocked ? "#fff2b0" : "#3a4a66"} stroke="#3a2a10" strokeWidth="2.5" />
      {!unlocked && <rect x="47" y="48" width="6" height="10" rx="2" fill="#c9d6ea" />}
    </svg>
  );
}
