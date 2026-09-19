import React from "react";
import { AbsoluteFill } from "remotion";

/** Night-storm plate shared by celebration comps. Not the live slot runtime. */
export const StormStage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 70% 55% at 50% 40%, #2a1458 0%, #120824 45%, #07040f 100%)",
        fontFamily: "Impact, 'Arial Black', sans-serif",
        color: "#fff8dc",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 40% 80% at 8% 50%, rgba(88, 24, 150, 0.45), transparent 60%), radial-gradient(ellipse 40% 80% at 92% 48%, rgba(0, 200, 255, 0.18), transparent 62%)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};
