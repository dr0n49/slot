import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { StormStage } from "./StormStage";
import { CloudSplat, ExtrudedWord, popScale } from "./splat";

export type WonSpinsProps = {
  kicker: string;
  hero: string;
  caption: string;
};

/** Bonus trigger / complete plate — same cloud splat, framed in storm metal. */
export const WonSpins: React.FC<WonSpinsProps> = ({ kicker, hero, caption }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame, fps, config: { damping: 16 } });
  const n = spring({ frame: frame - 6, fps, config: { damping: 12, mass: 0.7 } });
  const isMoney = hero.includes(".");

  return (
    <StormStage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            scale: popScale(card, 0.82),
            width: 560,
            borderRadius: 30,
            padding: "30px 30px 22px",
            textAlign: "center",
            background:
              "radial-gradient(ellipse 90% 44% at 50% -10%, rgba(96,42,170,0.5), transparent 60%), linear-gradient(180deg, #251244 0%, #140a28 52%, #0a0516 100%)",
            boxShadow:
              "0 0 0 1.5px rgba(8,4,16,0.9), 0 0 0 3px rgba(240,193,75,0.28), 0 28px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.22)",
            border: "1.5px solid rgba(148,108,220,0.55)",
            position: "relative",
          }}
        >
          {/* gold corner brackets */}
          <div
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              width: 22,
              height: 22,
              borderTop: "3px solid rgba(240,193,75,0.85)",
              borderLeft: "3px solid rgba(240,193,75,0.85)",
              borderTopLeftRadius: 10,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 10,
              bottom: 10,
              width: 22,
              height: 22,
              borderBottom: "3px solid rgba(240,193,75,0.85)",
              borderRight: "3px solid rgba(240,193,75,0.85)",
              borderBottomRightRadius: 10,
            }}
          />
          <div
            style={{
              display: "inline-block",
              padding: "4px 18px",
              borderRadius: 999,
              border: "1px solid rgba(240,193,75,0.75)",
              background: "linear-gradient(180deg, rgba(74,32,130,0.75), rgba(30,12,58,0.75))",
              color: "#ffe9ad",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 5,
              marginBottom: 8,
            }}
          >
            {kicker}
          </div>
          <div style={{ scale: popScale(card, 0.9) }}>
            <ExtrudedWord size={44}>CONGRATULATIONS</ExtrudedWord>
          </div>
          <div style={{ marginTop: 8, fontSize: 15, letterSpacing: 7, color: "#9be8ff", fontWeight: 800 }}>
            YOU HAVE WON
          </div>
          <div
            style={{
              margin: "6px auto 0",
              width: 380,
              scale: popScale(n, 0.6),
              filter: "drop-shadow(0 12px 26px rgba(0,0,0,0.5))",
            }}
          >
            <CloudSplat hero={hero} tone={isMoney ? "gold" : "ivory"} />
          </div>
          <div
            style={{
              fontSize: 19,
              letterSpacing: 8,
              fontWeight: 800,
              color: "#ffe9ad",
              textShadow: "0 2px 12px rgba(240,193,75,0.35)",
            }}
          >
            {caption}
          </div>
        </div>
      </AbsoluteFill>
    </StormStage>
  );
};
