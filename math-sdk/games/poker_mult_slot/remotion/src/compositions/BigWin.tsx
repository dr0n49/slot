import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { StormStage } from "./StormStage";
import { CloudSplat, ExtrudedWord, popScale, usePop } from "./splat";

export type BigWinProps = {
  word: string;
  amount: string;
};

export const BigWin: React.FC<BigWinProps> = ({ word, amount }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = usePop(0, 12, 0.7);
  const splat = usePop(4, 14);
  const dropPop = usePop(9, 10, 0.6);
  const drift = interpolate(frame, [0, 90], [0, -10], { extrapolateRight: "clamp" });

  return (
    <StormStage>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <div style={{ scale: popScale(pop), opacity: interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" }) }}>
          <ExtrudedWord size={word.length > 10 ? 86 : 120}>{word}</ExtrudedWord>
        </div>
        <div
          style={{
            width: 560,
            marginTop: -14,
            translateY: drift,
            scale: popScale(splat, 0.7),
            opacity: interpolate(frame, [4, 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            filter: "drop-shadow(0 16px 34px rgba(0,0,0,0.55))",
          }}
        >
          <CloudSplat
            hero={amount}
            tone="gold"
          />
        </div>
        <div
          style={{
            marginTop: -6,
            scale: popScale(dropPop, 0.9),
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 6,
            color: "#9be8ff",
            opacity: interpolate(frame, [9, 16], [0, 0.85], { extrapolateRight: "clamp" }),
          }}
        >
          TAP TO CONTINUE
        </div>
      </AbsoluteFill>
    </StormStage>
  );
};
