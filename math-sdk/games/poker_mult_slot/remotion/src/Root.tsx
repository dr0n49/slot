import React from "react";
import { Composition } from "remotion";
import "./index.css";
import { BigWin } from "./compositions/BigWin";
import { WonSpins } from "./compositions/WonSpins";

const fps = 30;
const hd = { width: 1280, height: 720, fps };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Nice"
        component={BigWin}
        durationInFrames={2.2 * fps}
        {...hd}
        defaultProps={{ word: "NICE!", amount: "12.50" }}
      />
      <Composition
        id="Super"
        component={BigWin}
        durationInFrames={2.2 * fps}
        {...hd}
        defaultProps={{ word: "SUPER!", amount: "42.00" }}
      />
      <Composition
        id="Sensational"
        component={BigWin}
        durationInFrames={2.4 * fps}
        {...hd}
        defaultProps={{ word: "SENSATIONAL!", amount: "128.00" }}
      />
      <Composition
        id="MaxWin"
        component={BigWin}
        durationInFrames={2.6 * fps}
        {...hd}
        defaultProps={{ word: "MAX WIN!", amount: "50,000.00" }}
      />
      <Composition
        id="WonTenSpins"
        component={WonSpins}
        durationInFrames={3 * fps}
        {...hd}
        defaultProps={{ kicker: "JOB BONUS", hero: "10", caption: "FREE SPINS" }}
      />
      <Composition
        id="BonusComplete"
        component={WonSpins}
        durationInFrames={3 * fps}
        {...hd}
        defaultProps={{ kicker: "JOB BONUS", hero: "84.00", caption: "TOTAL WIN" }}
      />
    </>
  );
};
